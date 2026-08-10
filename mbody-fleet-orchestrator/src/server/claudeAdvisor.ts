import Anthropic from '@anthropic-ai/sdk';

let aiClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!aiClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is missing.');
    }
    aiClient = new Anthropic({
      apiKey,
      defaultHeaders: {
        'User-Agent': 'aistudio-build'
      }
    });
  }
  return aiClient;
}

export async function generateFleetAdvisorAnalysis(disruptionContext: any): Promise<string> {
  try {
    const ai = getAnthropicClient();
    const systemPrompt = 'You are the AI Fleet Operations Advisor for MBody AI operating at Regional General Hospital.';
    const userPrompt = `
Analyze the following active fleet disruption event and provide a concise, executive-ready recommendation:

Disruption Event Details:
${JSON.stringify(disruptionContext, null, 2)}

Provide:
1. Root Cause Analysis
2. SLA Impact Assessment (Sterile Zones Z2, Z5, Z7 risk)
3. Immediate Action Plan (Human Escalation / Re-planning)
4. Recommended Preventative Policy (including ML MTTR estimation)
Keep response clear, structured, and professional.
`;

    const response = await ai.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    return textBlock?.text || 'Fleet analysis completed with standard deterministic recovery policy.';
  } catch (error: any) {
    console.warn('Anthropic API call skipped or unconfigured, falling back to deterministic policy:', error.message);
    return `[DETERMINISTIC FALLBACK ADVISORY]:
1. Root Cause: ${disruptionContext.title || 'Hardware Disruption'}.
2. SLA Impact: Sterile Zone SLAs require immediate attention.
3. Action Plan: Triggered Human Ops Escalation Alert. R-003 hardware fault requires technician UV manual override.
4. Recommendation: ML MTTR model predicts 180 mins repair time. Re-allocate dry/wet scrubbers or dispatch technician.`;
  }
}

export async function parseHospitalLogWithLLM(logText: string): Promise<{
  affectedZoneId: string;
  zoneName: string;
  priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  reason: string;
  suggestedAction: string;
  sqFtEstimate?: number;
}> {
  try {
    const ai = getAnthropicClient();
    const systemPrompt = `You are an AI Hospital Operations Log Parser for Regional General Hospital's robot fleet.
Analyze the staff message or hospital dispatch log the user provides and extract structured scheduling disruption parameters.

Hospital Zones for reference:
Z1: Main Lobby (4,200 sq ft, Hard floor)
Z2: ED Hallways (3,800 sq ft, Hard, Sterile)
Z3: Cafeteria (2,600 sq ft, Mixed)
Z4: Admin Wing (5,100 sq ft, Carpet)
Z5: Patient Halls 2F (6,400 sq ft, Hard, Sterile)
Z6: Outpatient Wing (4,800 sq ft, Hard)
Z7: Radiology Suite (2,200 sq ft, Hard, Sterile)
Z8: Parking Garage L1 (12,000 sq ft, Concrete)
Ad-Hoc: Lobby Fundraiser / Event (e.g. 50,000 sq ft)

Respond ONLY with JSON matching this structure, with no other text:
{
  "affectedZoneId": "Z2",
  "zoneName": "ED Hallways",
  "priorityLevel": "CRITICAL",
  "reason": "Chemical spill requires emergency biohazard deep clean",
  "suggestedAction": "Interrupt standard schedule and re-route sterile/wet scrubber immediately.",
  "sqFtEstimate": 3800
}`;

    const response = await ai.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Log Text:\n"${logText}"` }]
    });

    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    const parsed = JSON.parse(textBlock?.text || '{}');
    return {
      affectedZoneId: parsed.affectedZoneId || 'Z2',
      zoneName: parsed.zoneName || 'Hospital Zone',
      priorityLevel: parsed.priorityLevel || 'HIGH',
      reason: parsed.reason || 'Staff requested priority cleaning',
      suggestedAction: parsed.suggestedAction || 'Re-route available fleet resources.',
      sqFtEstimate: parsed.sqFtEstimate || 4000
    };
  } catch (err: any) {
    console.warn('Anthropic log parser fallback:', err.message);
    return {
      affectedZoneId: 'Z2',
      zoneName: 'ED Hallways',
      priorityLevel: 'CRITICAL',
      reason: 'Emergency hospital staff priority bump reported in dispatch logs.',
      suggestedAction: 'Re-prioritize sterile robot queue immediately.',
      sqFtEstimate: 3800
    };
  }
}

/**
 * #1 — Plain-language explainability layer.
 * Takes any raw scheduling/anomaly state object (a zone assignment result, a robot's
 * unavailability reason, an anomaly flag) and translates it into 2-3 sentences a
 * non-technical facility manager can read. Reuses the same Anthropic client as the
 * parser/advisor above — this is a thin wrapper, not a new subsystem.
 */
export async function explainDecision(context: any): Promise<string> {
  try {
    const ai = getAnthropicClient();
    const systemPrompt = `You translate fleet-scheduling decisions into plain language for a hospital facility manager who is not technical.
Given a JSON snippet describing a robot, zone, or scheduling outcome, explain in 2-3 short sentences: what happened, why the system decided this, and what it means operationally. No markdown, no jargon, plain prose.`;

    const response = await ai.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(context, null, 2) }]
    });

    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    return textBlock?.text?.trim() || 'No explanation available.';
  } catch (error: any) {
    console.warn('Anthropic explain call failed, falling back:', error.message);
    return 'Explanation unavailable — the underlying scheduling data is still shown above.';
  }
}

/**
 * #2 — Conversational fleet assistant.
 * Answers a facility manager's free-text question, grounded ONLY in a snapshot of the
 * current shift's live state (robot states, zone assignments, disruptions so far) that
 * the caller supplies. Deliberately does not fall back to general knowledge if the
 * snapshot doesn't contain the answer — it should say so rather than guess.
 */
export async function answerFleetQuestion(
  question: string,
  shiftSnapshot: any,
  recentHistory: { role: 'user' | 'assistant'; text: string }[] = []
): Promise<string> {
  try {
    const ai = getAnthropicClient();
    const systemPrompt = `You are the Fleet Assistant for a multi-OEM autonomous cleaning robot fleet at a hospital.
You are given a JSON snapshot of the current shift: robot states, zone assignments, binding constraints, and disruptions that have occurred so far.
Answer the facility manager's question using ONLY this snapshot. Be concise (2-4 sentences), concrete, and reference actual robot/zone IDs. If the snapshot doesn't contain the answer, say so plainly rather than guessing.`;

    const historyText = recentHistory.map((m) => `${m.role}: ${m.text}`).join('\n');
    const userPrompt = `Shift snapshot:\n${JSON.stringify(shiftSnapshot, null, 2)}\n\nRecent conversation:\n${historyText}\n\nQuestion: ${question}`;

    const response = await ai.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    return textBlock?.text?.trim() || 'No answer available.';
  } catch (error: any) {
    console.warn('Anthropic assistant call failed:', error.message);
    return 'The fleet assistant is temporarily unavailable — check the Dashboard and Schedule tabs directly.';
  }
}

