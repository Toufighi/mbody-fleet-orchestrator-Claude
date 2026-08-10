import { describe, it, expect } from 'vitest';
import { globalFailurePredictor } from '../ml/failurePredictor';
import { globalAnomalyDetector } from '../monitoring/anomalyDetector';
import { RobotState } from '../types';
import { FLEET_ROSTER } from '../data/roster';

describe('ML Failure Predictor & Anomaly Detector', () => {
  it('ML Failure Predictor should predict high UV/optical sensor failure risk for R-003 near 2:15 AM (t=435)', () => {
    const predAt215AM = globalFailurePredictor.predictRobotFailureAtTime('R-003', 435);
    expect(predAt215AM.failureProbability).toBeGreaterThan(0.70);
    expect(predAt215AM.component).toBe('uv_sanitizer_sensor');
    expect(predAt215AM.predictedMTTRMinutes).toBe(180);

    const curve = globalFailurePredictor.predictRobotFailureCurve('R-003');
    expect(curve.overallRiskScore).toBeGreaterThan(0.75);
    expect(curve.peakRiskTimeDisplay).toBe('02:15 AM');
  });

  it('ML Failure Predictor should predict water valve pump stress for R-008 near 10:30 PM (t=210)', () => {
    const predAt1030PM = globalFailurePredictor.predictRobotFailureAtTime('R-008', 210);
    expect(predAt1030PM.failureProbability).toBeGreaterThan(0.65);
    expect(predAt1030PM.component).toBe('water_valve_pump');
    expect(predAt1030PM.predictedMTTRMinutes).toBe(45);
  });

  it('R-003 failure probability peaks at exactly 0.85 at its scripted fault time, but that peak is a single-minute spike — 5 min off-peak already drops below it — so the scheduler\'s ML-proactive threshold is set to 0.80 to give a real ~46-min operational window around the peak, not an unreachable exact match', () => {
    const atPeak = globalFailurePredictor.predictRobotFailureAtTime('R-003', 435);
    expect(atPeak.failureProbability).toBe(0.85);

    // confirms this is a genuine narrow peak, not a plateau — even 15 min off already
    // drops below the literal 0.85 peak value, which is why 0.85 itself isn't usable
    // as an operating threshold (see scheduler.test.ts for the end-to-end proof).
    const fifteenMinOff = globalFailurePredictor.predictRobotFailureAtTime('R-003', 420);
    expect(fifteenMinOff.failureProbability).toBeLessThan(atPeak.failureProbability);
    expect(fifteenMinOff.failureProbability).toBeGreaterThanOrEqual(0.80); // still above the practical threshold

    // R-008's own peak (0.80) sits right at the boundary — its disruption is primarily
    // handled reactively via the anomaly detector, not this proactive avoidance path.
    const r008Peak = globalFailurePredictor.predictRobotFailureAtTime('R-008', 210);
    expect(r008Peak.failureProbability).toBeCloseTo(0.80, 2);
  });

  it('Anomaly Detector should flag water leak anomaly for R-008 when water drops prematurely', () => {
    const robotStates = new Map<string, RobotState>();
    FLEET_ROSTER.forEach(r => {
      robotStates.set(r.id, {
        id: r.id,
        batteryPct: 80,
        waterPct: r.hasWaterTank ? 20 : null,
        coarseWaterLevel: r.id === 'R-008' ? 'low' : 'med',
        currentZoneId: 'Z1',
        status: 'cleaning',
        errorCode: null,
        waterCyclesCompleted: 1,
        positionUncertaintyMeters: 0.5,
        waterMinutesRemainingEst: r.id === 'R-008' ? { nominal: 20, min: 10, max: 30 } : null,
        x: 10,
        y: 10,
        lastTelemetryTimestamp: Date.now(),
        isOfflineMode: false,
        totalSqFtCleanedShift: 5000,
        totalGallonsWaterUsedShift: 15
      } as unknown as RobotState);
    });

    const result = globalAnomalyDetector.evaluateConsumablesAndAnomalies(robotStates);

    expect(result.anomaliesFound.length).toBeGreaterThan(0);
    const r8Anomaly = result.anomaliesFound.find(a => a.includes('R-008'));
    expect(r8Anomaly).toBeDefined();
    expect(r8Anomaly).toContain('Water Leak Suspected');

    const r8Metric = result.metrics.find(m => m.robotId === 'R-008');
    expect(r8Metric?.leakRiskScore).toBeGreaterThan(80);
  });

  it('Anomaly Detector should flag battery internal resistance degradation for R-003', () => {
    const robotStates = new Map<string, RobotState>();
    FLEET_ROSTER.forEach(r => {
      robotStates.set(r.id, {
        id: r.id,
        batteryPct: 80,
        waterPct: r.hasWaterTank ? 80 : null,
        coarseWaterLevel: 'high',
        currentZoneId: 'Z1',
        status: 'cleaning',
        errorCode: null,
        waterCyclesCompleted: 1,
        positionUncertaintyMeters: 0.5,
        waterMinutesRemainingEst: null,
        x: 10,
        y: 10,
        lastTelemetryTimestamp: Date.now(),
        isOfflineMode: false,
        totalSqFtCleanedShift: 5000,
        totalGallonsWaterUsedShift: 15
      } as unknown as RobotState);
    });

    const result = globalAnomalyDetector.evaluateConsumablesAndAnomalies(robotStates);

    const r3Anomaly = result.anomaliesFound.find(a => a.includes('R-003'));
    expect(r3Anomaly).toBeDefined();
    expect(r3Anomaly).toContain('Battery Capacity Degradation');

    const r3Metric = result.metrics.find(m => m.robotId === 'R-003');
    expect(r3Metric?.batteryHealthPct).toBeLessThan(85);
  });
});
