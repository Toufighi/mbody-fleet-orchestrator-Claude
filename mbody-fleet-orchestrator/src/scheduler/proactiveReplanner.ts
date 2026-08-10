import { FLEET_ROSTER } from '../data/roster';
import { globalFailurePredictor, PROACTIVE_RISK_WARNING_THRESHOLD } from '../ml/failurePredictor';
import { ZoneConfig, RobotConfig, ScheduledTask } from '../types';

/**
 * Finds a robot eligible to take over `zone`'s upcoming task from `excludeRobotId`,
 * given the current simulation clock and the full task list (to check for conflicts).
 * Pulled out as a standalone pure-ish function (only side effect: reads the global
 * failure predictor) so it's independently testable without needing a full
 * ShiftSimulationEngine instance and a real generated schedule to happen to produce
 * the right conditions — see src/__tests__/proactiveReplanner.test.ts.
 *
 * Eligibility rules mirror optimizer.ts's static candidate filter:
 *   - sterile zones require a sterile-certified robot
 *   - carpet zones require a CP-V2/CP-X1 (dry-only) robot
 *   - the alternative must not itself be in an elevated-risk state right now
 *   - the alternative must not already have a conflicting task at that time
 */
export function findEligibleAlternativeRobot(
  excludeRobotId: string,
  zone: ZoneConfig,
  currentMin: number,
  tasks: ScheduledTask[],
  windowStartMin: number,
  windowEndMin: number
): RobotConfig | null {
  return (
    FLEET_ROSTER.find(r => {
      if (r.id === excludeRobotId) return false;
      if (zone.requiresSterileRobot && !r.isSterileCertified) return false;
      if (zone.floorType === 'Carpet' && r.model !== 'CP-V2' && r.model !== 'CP-X1') return false;

      const altRisk = globalFailurePredictor.predictRobotFailureAtTime(r.id, currentMin);
      if (altRisk.failureProbability >= PROACTIVE_RISK_WARNING_THRESHOLD) return false;

      const hasConflict = tasks.some(
        t => t.robotId === r.id && t.startTimeMinutes < windowEndMin && t.endTimeMinutes > windowStartMin
      );
      return !hasConflict;
    }) || null
  );
}
