import { getAnthropicClient } from './anthropicClient';
import { globalSimulationEngine } from '../dispatcher/simulationEngine';
import { findEligibleAlternativeRobot } from '../scheduler/proactiveReplanner';
import { FACILITY_ZONES } from '../data/facility';

/**
 * The Ops Agent — a genuine agentic tool-use loop, not a single-shot prompt.
 *
 * Every other "AI" feature in this codebase (advisor, log parser, explain, assistant)
 * is a single Claude call: prompt in, text out. This is different: Claude is given a
 * set of tools that read AND mutate live simulation state, and it autonomously decides
 * which tools to call, in what sequence, based on what earlier tool results tell it —
 * a real perceive -> reason -> act loop, not a fixed deterministic script with an LLM
 * bolted on for narration.
 *
 * Concretely, for a disruption like "R-003 is down, Z5 needs a sterile robot": the
 * agent decides for itself whether to check robot status first, whether an eligible
 * alternative exists, whether to execute a reassignment, or whether to escalate to a
 * human — and the tools it calls have REAL side effects (reassignTask/logEscalation
 * actually mutate globalSimulationEngine's live state), not simulated ones.
 *
 * Safety boundary: the agent can only call the 4 tools defined below. It cannot run
 * arbitrary code, cannot touch anything outside the fleet-scheduling domain, and every
 * tool call is logged in the returned transcript for audit — this is deliberately a
 * narrow, inspectable agent, not a general-purpose one.
 */

const MAX_AGENT_TURNS = 6;

const AGENT_SYSTEM_PROMPT = `You are the Ops Agent for a multi-OEM autonomous cleaning robot fleet at a hospital.
You are given a disruption event and must decide how to handle it using ONLY the tools provided.
Reason step by step: check the robot's actual status first if you need to confirm anything, look for an eligible
alternative robot before assuming none exists, execute a reassignment if a safe one is available, and escalate to
a human only when no automated resolution is possible (e.g. no eligible alternative for a sterile zone).
Do not fabricate robot IDs, zone IDs, or outcomes — only act on what the tools actually return.
When you are done acting, give a short final summary of what you did and why.`;

export const TOOLS: any[] = [
  {
    name: 'get_robot_status',
    description: 'Get the live status of a specific robot (battery, water, current zone, fault state).',
    input_schema: {
      type: 'object',
      properties: { robotId: { type: 'string', description: 'e.g. R-003' } },
      required: ['robotId']
    }
  },
  {
    name: 'find_eligible_alternative',
    description: 'Find a robot eligible to take over a zone task from a given robot (respects sterile-certification, floor-type, current risk, and scheduling conflicts). Returns null if none exists.',
    input_schema: {
      type: 'object',
      properties: {
        zoneId: { type: 'string', description: 'e.g. Z5' },
        excludeRobotId: { type: 'string', description: 'the robot currently assigned, to exclude from candidates' }
      },
      required: ['zoneId', 'excludeRobotId']
    }
  },
  {
    name: 'execute_reassignment',
    description: 'Reassign a zone task from one robot to another. Only call this after confirming the target robot is actually eligible via find_eligible_alternative.',
    input_schema: {
      type: 'object',
      properties: {
        zoneId: { type: 'string' },
        fromRobotId: { type: 'string' },
        toRobotId: { type: 'string' }
      },
      required: ['zoneId', 'fromRobotId', 'toRobotId']
    }
  },
  {
    name: 'escalate_to_human',
    description: 'Escalate to human ops when no automated resolution is possible. This creates a real, visible escalation in the Disruption Console.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        reason: { type: 'string' },
        recommendedActions: { type: 'string' }
      },
      required: ['title', 'reason', 'recommendedActions']
    }
  }
];

export function executeTool(name: string, input: any): any {
  switch (name) {
    case 'get_robot_status': {
      const status = globalSimulationEngine.getRobotStatus(input.robotId);
      return status || { error: `No robot found with id ${input.robotId}` };
    }
    case 'find_eligible_alternative': {
      const snapshot = globalSimulationEngine.getSnapshot();
      const task = snapshot.schedulePlan.tasks.find(
        t => t.zoneId === input.zoneId && t.robotId === input.excludeRobotId && (t.taskType === 'clean' || t.taskType === 'sanitize')
      );
      const zone = FACILITY_ZONES.find(z => z.id === input.zoneId);
      if (!zone) return { error: `Unknown zone ${input.zoneId}` };
      if (!task) return { alternative: null, note: `No active task found for ${input.excludeRobotId} in ${input.zoneId} — nothing to reassign.` };
      const alt = findEligibleAlternativeRobot(
        input.excludeRobotId, zone, snapshot.currentMinutesFrom1900, snapshot.schedulePlan.tasks,
        task.startTimeMinutes, task.endTimeMinutes
      );
      return { alternative: alt ? { id: alt.id, oem: alt.oem, model: alt.model, isSterileCertified: alt.isSterileCertified } : null };
    }
    case 'execute_reassignment': {
      return globalSimulationEngine.reassignTask(input.zoneId, input.fromRobotId, input.toRobotId);
    }
    case 'escalate_to_human': {
      const event = globalSimulationEngine.logEscalation(
        input.robotId || 'UNKNOWN', input.zoneId, input.title, input.reason, input.recommendedActions
      );
      return { escalated: true, eventId: event.id };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export interface AgentStep {
  type: 'tool_call' | 'final_response';
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  text?: string;
}

export interface AgentRunResult {
  steps: AgentStep[];
  finalSummary: string;
  toolCallCount: number;
}

/**
 * Runs the agent loop against a disruption context. Returns the full step-by-step
 * transcript (for audit/UI display) plus the agent's final summary.
 */
export async function runOpsAgent(disruptionContext: any): Promise<AgentRunResult> {
  const ai = getAnthropicClient();
  const steps: AgentStep[] = [];
  let toolCallCount = 0;

  const messages: any[] = [
    { role: 'user', content: `Handle this disruption:\n${JSON.stringify(disruptionContext, null, 2)}` }
  ];

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const response = await ai.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 800,
      system: AGENT_SYSTEM_PROMPT,
      tools: TOOLS,
      messages
    });

    const toolUseBlocks = response.content.filter((b): b is any => b.type === 'tool_use');
    const textBlocks = response.content.filter((b): b is any => b.type === 'text');

    if (toolUseBlocks.length === 0) {
      const finalText = textBlocks.map(b => b.text).join('\n').trim() || 'Agent completed without further action.';
      steps.push({ type: 'final_response', text: finalText });
      return { steps, finalSummary: finalText, toolCallCount };
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: any[] = [];
    for (const block of toolUseBlocks) {
      toolCallCount += 1;
      const result = executeTool(block.name, block.input);
      steps.push({ type: 'tool_call', toolName: block.name, toolInput: block.input, toolResult: result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result)
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  const timeoutMsg = `Agent reached the ${MAX_AGENT_TURNS}-turn safety cap without a final decision — treat as an unresolved escalation.`;
  steps.push({ type: 'final_response', text: timeoutMsg });
  return { steps, finalSummary: timeoutMsg, toolCallCount };
}
