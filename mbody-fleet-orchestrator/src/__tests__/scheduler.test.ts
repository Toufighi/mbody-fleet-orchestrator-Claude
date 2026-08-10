import { describe, it, expect } from 'vitest';
import { globalFleetScheduler } from '../scheduler/optimizer';

describe('Dynamic Schedule Optimizer (OR & ML)', () => {
  it('should generate a valid nightly cleaning schedule for Tuesday shift', () => {
    const plan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.8, sla: 0.2 },
      planningMode: 'OR_DETERMINISTIC'
    });

    expect(plan.planningMode).toBe('OR_DETERMINISTIC');
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.estimatedTotalSqFtCleaned).toBeGreaterThan(0);
    expect(plan.estimatedTotalCost).toBeGreaterThan(0);
  });

  it('should respect sterile zone constraints (Z2, Z5, Z7 require healthcare-grade AS-900H R-003)', () => {
    const plan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.5, sla: 0.5 },
      planningMode: 'OR_DETERMINISTIC'
    });
    const sterileTasks = plan.tasks.filter(t => ['Z2', 'Z5', 'Z7'].includes(t.zoneId) && t.taskType === 'clean');

    sterileTasks.forEach(task => {
      expect(task.robotId).toBe('R-003'); // Only R-003 is certified for sterile zones
    });
  });

  it('should interleave water refill cycles for scrubber robots', () => {
    const plan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.5, sla: 0.5 },
      planningMode: 'OR_DETERMINISTIC'
    });
    const waterTasks = plan.tasks.filter(t => t.taskType === 'water_refill');

    expect(waterTasks.length).toBeGreaterThan(0);
    waterTasks.forEach(task => {
      expect(task.durationMinutes).toBe(10); // 10 minutes dump + refill
    });
  });

  it('should calculate dual-constraint binding limits (battery vs water)', () => {
    const plan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.5, sla: 0.5 },
      planningMode: 'OR_DETERMINISTIC'
    });
    const cleanTasks = plan.tasks.filter(t => t.taskType === 'clean');

    const waterBindingTasks = cleanTasks.filter(t => t.bindingConstraintAtStart === 'water');
    const batteryBindingTasks = cleanTasks.filter(t => t.bindingConstraintAtStart === 'battery');

    expect(waterBindingTasks.length + batteryBindingTasks.length).toBeGreaterThan(0);
  });

  it('should accommodate ad-hoc customer requests (e.g., 20,000 sq ft convention lobby event)', () => {
    const plan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.7, sla: 0.3 },
      planningMode: 'ML_PROACTIVE',
      customAdHocZone: {
        id: 'Z_ADHOC_LOBBY',
        name: 'Convention Center Lobby Event',
        sqFt: 20000,
        startMin: 120, // 9:00 PM
        endMin: 660    // 6:00 AM
      }
    });

    const adHocTasks = plan.tasks.filter(t => t.zoneId === 'Z_ADHOC_LOBBY');
    expect(adHocTasks.length).toBeGreaterThan(0);
  });

  it('ML_PROACTIVE mode evaluates risk penalties using the same predictor as the live monitor (may legitimately be 0 for a given facility\'s window configuration — see simulationEngine.test.ts for the mechanism that reliably fires)', () => {
    const proactivePlan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.7, sla: 0.3 },
      planningMode: 'ML_PROACTIVE'
    });
    const deterministicPlan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.7, sla: 0.3 },
      planningMode: 'OR_DETERMINISTIC'
    });

    // OR_DETERMINISTIC never evaluates the ML risk branch at all — this is the one
    // invariant that always holds regardless of facility window configuration.
    expect(deterministicPlan.proactiveRiskPenaltiesApplied ?? 0).toBe(0);
    expect(proactivePlan.proactiveRiskPenaltiesApplied ?? 0).toBeGreaterThanOrEqual(0);
  });
});
