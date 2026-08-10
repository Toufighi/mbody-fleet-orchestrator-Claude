/**
 * Defense against prompt injection for parseHospitalLogWithLLM.
 *
 * The threat model here is real, not theoretical: this parser takes free-text input
 * from hospital staff and its output (zone, priority, sq ft) feeds DIRECTLY into
 * scheduling decisions. A malicious or careless dispatch note could try to manipulate
 * the LLM into fabricating a fake CRITICAL priority for an arbitrary zone, or into
 * ignoring its instructions entirely and emitting something unexpected.
 *
 * The primary defense is OUTPUT validation (validateParsedDispatchLog below) — never
 * trust the LLM's JSON without checking it against real, known-good values. Input
 * pre-screening (screenForInjectionAttempt) is defense-in-depth on top of that, not a
 * replacement for it: heuristic phrase-matching on the input alone is not reliable
 * enough to be the sole defense against injection.
 */

const VALID_ZONE_IDS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8', 'AD-HOC'];
const VALID_PRIORITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const MAX_STRING_FIELD_LENGTH = 500;
const MAX_SQFT_ESTIMATE = 60000; // larger than any real zone, to allow ad-hoc events, but bounded
const MAX_INPUT_LENGTH = 800;

export interface ParsedDispatchLog {
  affectedZoneId: string;
  zoneName: string;
  priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  suggestedAction: string;
  sqFtEstimate: number;
}

const SAFE_FALLBACK: ParsedDispatchLog = {
  affectedZoneId: 'Z2',
  zoneName: 'ED Hallways',
  priorityLevel: 'HIGH',
  reason: 'Could not confidently parse the dispatch note — defaulted to a safe, non-critical review state.',
  suggestedAction: 'Have a human operator review the original note before acting on it.',
  sqFtEstimate: 3800
};

/** Truncates and lightly screens the raw input before it ever reaches the LLM. */
export function screenInput(logText: string): { text: string; flagged: boolean; flagReason?: string } {
  const truncated = (logText || '').slice(0, MAX_INPUT_LENGTH);
  const injectionPatterns = [
    /ignore (all )?(previous|prior|above) instructions/i,
    /you are now/i,
    /system prompt/i,
    /disregard (the )?(system|above)/i,
    /new instructions?:/i
  ];
  const hit = injectionPatterns.find(p => p.test(truncated));
  if (hit) {
    console.warn('[SECURITY] Dispatch log flagged for possible prompt-injection pattern:', hit.source);
    return { text: truncated, flagged: true, flagReason: `matched pattern: ${hit.source}` };
  }
  return { text: truncated, flagged: false };
}

/**
 * The real defense: validates the LLM's parsed output against known-good values
 * before it's allowed anywhere near actual scheduling logic. Returns null (not a
 * throw) when validation fails, so callers fall back to a safe default rather than
 * propagate an error that might itself leak information.
 */
export function validateParsedDispatchLog(raw: any): ParsedDispatchLog | null {
  if (!raw || typeof raw !== 'object') return null;

  const zoneId = String(raw.affectedZoneId || '').toUpperCase();
  if (!VALID_ZONE_IDS.includes(zoneId)) {
    console.warn('[SECURITY] Rejected parsed log: unknown zone id', zoneId);
    return null;
  }

  const priority = String(raw.priorityLevel || '').toUpperCase();
  if (!VALID_PRIORITY_LEVELS.includes(priority)) {
    console.warn('[SECURITY] Rejected parsed log: invalid priority level', priority);
    return null;
  }

  const sqFt = Number(raw.sqFtEstimate);
  if (!Number.isFinite(sqFt) || sqFt < 0 || sqFt > MAX_SQFT_ESTIMATE) {
    console.warn('[SECURITY] Rejected parsed log: sqFtEstimate out of bounds', raw.sqFtEstimate);
    return null;
  }

  const zoneName = typeof raw.zoneName === 'string' ? raw.zoneName.slice(0, MAX_STRING_FIELD_LENGTH) : 'Hospital Zone';
  const reason = typeof raw.reason === 'string' ? raw.reason.slice(0, MAX_STRING_FIELD_LENGTH) : 'No reason provided.';
  const suggestedAction = typeof raw.suggestedAction === 'string' ? raw.suggestedAction.slice(0, MAX_STRING_FIELD_LENGTH) : 'Route to human review.';

  return {
    affectedZoneId: zoneId,
    zoneName,
    priorityLevel: priority as ParsedDispatchLog['priorityLevel'],
    reason,
    suggestedAction,
    sqFtEstimate: sqFt
  };
}

export function safeFallbackDispatchLog(): ParsedDispatchLog {
  return { ...SAFE_FALLBACK };
}
