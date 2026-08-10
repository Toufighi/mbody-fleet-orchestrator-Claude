/**
 * #3 — Scoped human-in-the-loop tuning.
 *
 * Honest framing, read this before extending it: this module adjusts ONE persisted
 * numeric parameter (a multiplier on the FloorBot conservative water-minutes bound).
 * It is NOT a trained model, and it does not "continuously tune" anything beyond that
 * single number. What it does demonstrate for real:
 *
 *   1. Operator feedback is captured (thumbs up/down on a scheduling call).
 *   2. That feedback is persisted (here: in-memory + a pluggable store; swap
 *      `FeedbackStore` for a real DB in production).
 *   3. The persisted value changes scheduler BEHAVIOR on the next computation —
 *      a genuine closed loop, just a small and clearly-bounded one.
 *
 * This is intentionally the smallest honest version of "outcomes from future shifts
 * evaluate and correct the system's decisions." A real ML-tuned model would need a
 * labeled dataset of outcomes (did the conservative pull actually avoid a dry-run?)
 * and a training pipeline — out of scope for this MVP; see README roadmap.
 */

export interface FeedbackStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** Default in-memory store. Swap for a real persistence layer (Postgres, Redis, a
 * simple JSON file) in production — the interface is intentionally tiny. */
class InMemoryFeedbackStore implements FeedbackStore {
  private data = new Map<string, string>();
  async get(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
  }
}

const BIAS_KEY = 'floorbot-conservatism-bias';
const BIAS_MIN = 0.6;
const BIAS_MAX = 1.3;
const BIAS_STEP = 0.05;
const BIAS_DEFAULT = 1.0;

export class HumanFeedbackController {
  constructor(private store: FeedbackStore = new InMemoryFeedbackStore()) {}

  /** Current multiplier applied to FloorBot's conservative water-minutes bound. */
  async getWaterBias(): Promise<number> {
    const raw = await this.store.get(BIAS_KEY);
    if (raw === null) return BIAS_DEFAULT;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : BIAS_DEFAULT;
  }

  /**
   * Records operator feedback and nudges the bias.
   * direction 'too_aggressive' -> system should have pulled the robot earlier -> lower the bound (more conservative)
   * direction 'too_conservative' -> system pulled a robot that had plenty of water left -> raise the bound (less conservative)
   */
  async recordFeedback(direction: 'too_aggressive' | 'too_conservative'): Promise<number> {
    const current = await this.getWaterBias();
    const delta = direction === 'too_aggressive' ? -BIAS_STEP : BIAS_STEP;
    const next = Math.round(Math.min(BIAS_MAX, Math.max(BIAS_MIN, current + delta)) * 100) / 100;
    await this.store.set(BIAS_KEY, String(next));
    return next;
  }
}

export const globalHumanFeedback = new HumanFeedbackController();
