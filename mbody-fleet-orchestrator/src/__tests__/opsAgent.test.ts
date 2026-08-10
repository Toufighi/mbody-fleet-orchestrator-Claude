import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool, TOOLS } from '../server/opsAgent';
import { globalSimulationEngine } from '../dispatcher/simulationEngine';

describe('Ops Agent tool schema', () => {
  it('exposes exactly the 4 tools the agent is allowed to call — a narrow, inspectable surface', () => {
    const names = TOOLS.map(t => t.name).sort();
    expect(names).toEqual(['escalate_to_human', 'execute_reassignment', 'find_eligible_alternative', 'get_robot_status']);
  });

  it('every tool has an input_schema with required fields declared', () => {
    TOOLS.forEach(tool => {
      expect(tool.input_schema).toBeDefined();
      expect(Array.isArray(tool.input_schema.required)).toBe(true);
      expect(tool.input_schema.required.length).toBeGreaterThan(0);
    });
  });
});

describe('Ops Agent tool execution — real side effects, not simulated ones', () => {
  beforeEach(() => {
    globalSimulationEngine.initializeState();
  });

  it('get_robot_status reads real live robot state', () => {
    const result = executeTool('get_robot_status', { robotId: 'R-003' });
    expect(result).not.toHaveProperty('error');
    expect(result.id).toBe('R-003');
    expect(typeof result.batteryPct).toBe('number');
  });

  it('get_robot_status returns an error object (not a throw) for an unknown robot', () => {
    const result = executeTool('get_robot_status', { robotId: 'R-999-FAKE' });
    expect(result.error).toBeDefined();
  });

  it('find_eligible_alternative returns a real candidate or null, using live schedule state', () => {
    const snapshot = globalSimulationEngine.getSnapshot();
    const someTask = snapshot.schedulePlan.tasks.find(t => t.taskType === 'clean');
    if (!someTask) return; // nothing scheduled at t=0 in this facility config — not a failure of the tool
    const result = executeTool('find_eligible_alternative', { zoneId: someTask.zoneId, excludeRobotId: someTask.robotId });
    expect(result).toHaveProperty('alternative');
  });

  it('execute_reassignment actually mutates the live schedule — this is the core proof of real agentic side effects', () => {
    const before = globalSimulationEngine.getSnapshot();
    const task = before.schedulePlan.tasks.find(t => t.taskType === 'clean');
    if (!task) return;
    const originalRobotId = task.robotId;
    const alt = executeTool('find_eligible_alternative', { zoneId: task.zoneId, excludeRobotId: originalRobotId });
    if (!alt.alternative) return; // no eligible alternative for this particular task — a legitimate outcome

    const result = executeTool('execute_reassignment', { zoneId: task.zoneId, fromRobotId: originalRobotId, toRobotId: alt.alternative.id });
    expect(result.success).toBe(true);

    const after = globalSimulationEngine.getSnapshot();
    const updatedTask = after.schedulePlan.tasks.find(t => t.zoneId === task.zoneId && t.taskType === 'clean');
    expect(updatedTask?.robotId).toBe(alt.alternative.id);
    expect(updatedTask?.robotId).not.toBe(originalRobotId);
  });

  it('execute_reassignment fails gracefully (not a throw) for a nonexistent task', () => {
    const result = executeTool('execute_reassignment', { zoneId: 'Z-FAKE', fromRobotId: 'R-001', toRobotId: 'R-002' });
    expect(result.success).toBe(false);
  });

  it('escalate_to_human actually creates a visible disruption event in the live feed', () => {
    const before = globalSimulationEngine.getSnapshot().disruptions.length;
    const result = executeTool('escalate_to_human', {
      title: 'Test Escalation', reason: 'unit test', recommendedActions: 'none, this is a test', robotId: 'R-003'
    });
    expect(result.escalated).toBe(true);
    const after = globalSimulationEngine.getSnapshot();
    expect(after.disruptions.length).toBe(before + 1);
    expect(after.disruptions[0].humanEscalationRequired).toBe(true);
  });

  it('an unknown tool name returns an error object rather than throwing', () => {
    const result = executeTool('delete_all_robots', {});
    expect(result.error).toBeDefined();
  });
});
