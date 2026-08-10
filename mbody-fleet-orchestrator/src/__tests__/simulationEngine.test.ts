import { describe, it, expect } from 'vitest';
import { ShiftSimulationEngine } from '../dispatcher/simulationEngine';

describe('Live proactive-risk monitor (evaluateProactiveRiskMonitoring)', () => {
  it('fires a PROACTIVE_ML_WARNING for R-003 well before its scripted 2:15 AM fault, since no backup sterile-certified robot exists', () => {
    const engine = new ShiftSimulationEngine();
    engine.jumpToTime(370); // just after R-003 crosses the 0.5 risk threshold (~t=365)

    const snap = engine.getSnapshot();
    const warning = snap.disruptions.find(d => d.type === 'PROACTIVE_ML_WARNING' && d.robotId === 'R-003');

    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('critical'); // Z2 is a sterile zone
    expect(warning?.humanEscalationRequired).toBe(true);
    expect(warning?.timestampMinutes).toBeLessThan(435); // strictly before the reactive fault

    // the reactive fault itself should NOT have fired yet at t=370
    const reactiveFault = snap.disruptions.find(d => d.id === 'DISRUPT-FAULT-R003');
    expect(reactiveFault).toBeUndefined();
  });

  it('does not prevent or duplicate the original reactive fault once the shift reaches 2:15 AM', () => {
    const engine = new ShiftSimulationEngine();
    engine.jumpToTime(435);

    const snap = engine.getSnapshot();
    const proactiveWarnings = snap.disruptions.filter(d => d.type === 'PROACTIVE_ML_WARNING' && d.robotId === 'R-003');
    const reactiveFaults = snap.disruptions.filter(d => d.id === 'DISRUPT-FAULT-R003');

    expect(proactiveWarnings.length).toBe(1); // fired once, not spammed every tick
    expect(reactiveFaults.length).toBe(1); // existing scripted disruption still fires normally
  });

  it('does not fire at all for robots whose modeled risk never crosses the threshold (no false positives)', () => {
    const engine = new ShiftSimulationEngine();
    engine.jumpToTime(720); // run the full shift

    const snap = engine.getSnapshot();
    const falsePositives = snap.disruptions.filter(
      d => (d.type === 'PROACTIVE_ML_WARNING' || d.type === 'PROACTIVE_REPLAN') && !['R-003', 'R-008'].includes(d.robotId)
    );
    expect(falsePositives.length).toBe(0);
  });
});
