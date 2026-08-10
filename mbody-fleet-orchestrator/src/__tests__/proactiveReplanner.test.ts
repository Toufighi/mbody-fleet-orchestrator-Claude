import { describe, it, expect } from 'vitest';
import { findEligibleAlternativeRobot } from '../scheduler/proactiveReplanner';
import { ZoneConfig, ScheduledTask } from '../types';

const NON_STERILE_ZONE: ZoneConfig = {
  id: 'Z3', name: 'Cafeteria', sqFt: 2600, floorType: 'Mixed', classification: 'Standard',
  cleaningWindowStart: '22:00', cleaningWindowEnd: '05:00', allowedDays: ['daily'],
  requiresSterileRobot: false, requiresSecurityEscort: false, hasWifi: true
};

const STERILE_ZONE: ZoneConfig = {
  id: 'Z2', name: 'ED Hallways', sqFt: 3800, floorType: 'Hard', classification: 'Sterile',
  cleaningWindowStart: '03:00', cleaningWindowEnd: '05:00', allowedDays: ['daily'],
  requiresSterileRobot: true, requiresSecurityEscort: false, hasWifi: true
};

const CARPET_ZONE: ZoneConfig = {
  id: 'Z4', name: 'Admin Wing', sqFt: 5100, floorType: 'Carpet', classification: 'Standard',
  cleaningWindowStart: '19:00', cleaningWindowEnd: '23:00', allowedDays: ['Mon', 'Wed', 'Fri'],
  requiresSterileRobot: false, requiresSecurityEscort: false, hasWifi: true
};

describe('findEligibleAlternativeRobot (extracted proactive re-plan eligibility logic)', () => {
  it('finds a free, non-elevated-risk robot for a standard zone', () => {
    const alt = findEligibleAlternativeRobot('R-005', NON_STERILE_ZONE, 100, [], 100, 160);
    expect(alt).not.toBeNull();
    expect(alt?.id).not.toBe('R-005');
  });

  it('returns null for a sterile zone when the only sterile-certified robot is the one being replaced', () => {
    // R-003 is the only isSterileCertified robot in the roster — excluding it should
    // leave no eligible candidate for a sterile zone, regardless of conflicts.
    const alt = findEligibleAlternativeRobot('R-003', STERILE_ZONE, 435, [], 480, 546);
    expect(alt).toBeNull();
  });

  it('restricts carpet zones to CP-V2/CP-X1 (dry-only) robots', () => {
    const alt = findEligibleAlternativeRobot('R-004', CARPET_ZONE, 60, [], 60, 120);
    // whichever robot is returned, it must be a CleanPath dry-clean model
    expect(alt === null || alt?.model === 'CP-V2' || alt?.model === 'CP-X1').toBe(true);
  });

  it('excludes a robot that already has a conflicting task in the requested window', () => {
    const conflictingTasks: ScheduledTask[] = [
      { id: 'T1', robotId: 'R-005', zoneId: 'Z1', taskType: 'clean', startTimeMinutes: 90, durationMinutes: 60, endTimeMinutes: 150, bindingConstraintAtStart: 'none', sqFtTarget: 1000 }
    ];
    // Ask for a replacement in a window that overlaps R-005's existing commitment —
    // R-005 itself should never be offered back as the "alternative" in that slot.
    const alt = findEligibleAlternativeRobot('R-007', NON_STERILE_ZONE, 100, conflictingTasks, 100, 160);
    expect(alt?.id).not.toBe('R-005');
  });
});
