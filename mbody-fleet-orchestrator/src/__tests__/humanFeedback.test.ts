import { describe, it, expect } from 'vitest';
import { HumanFeedbackController, FeedbackStore } from '../monitoring/humanFeedback';

/** Minimal in-test store so each test gets an isolated, deterministic starting point. */
class TestStore implements FeedbackStore {
  private data = new Map<string, string>();
  async get(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('Human-in-the-loop feedback controller (scoped, not a trained model)', () => {
  it('defaults to a bias of 1.0 (no adjustment) when no feedback has been recorded', async () => {
    const controller = new HumanFeedbackController(new TestStore());
    expect(await controller.getWaterBias()).toBe(1.0);
  });

  it('"too_aggressive" feedback lowers the bias (more conservative)', async () => {
    const controller = new HumanFeedbackController(new TestStore());
    const next = await controller.recordFeedback('too_aggressive');
    expect(next).toBe(0.95);
    expect(await controller.getWaterBias()).toBe(0.95);
  });

  it('"too_conservative" feedback raises the bias (less conservative)', async () => {
    const controller = new HumanFeedbackController(new TestStore());
    const next = await controller.recordFeedback('too_conservative');
    expect(next).toBe(1.05);
  });

  it('clamps the bias within [0.6, 1.3] regardless of how much feedback is recorded', async () => {
    const controller = new HumanFeedbackController(new TestStore());
    for (let i = 0; i < 20; i++) await controller.recordFeedback('too_conservative');
    expect(await controller.getWaterBias()).toBeLessThanOrEqual(1.3);

    const controller2 = new HumanFeedbackController(new TestStore());
    for (let i = 0; i < 20; i++) await controller2.recordFeedback('too_aggressive');
    expect(await controller2.getWaterBias()).toBeGreaterThanOrEqual(0.6);
  });

  it('persists across separate controller instances sharing the same store', async () => {
    const store = new TestStore();
    const first = new HumanFeedbackController(store);
    await first.recordFeedback('too_conservative');

    const second = new HumanFeedbackController(store);
    expect(await second.getWaterBias()).toBe(1.05);
  });
});
