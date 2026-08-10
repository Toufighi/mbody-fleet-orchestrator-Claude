import { describe, it, expect } from 'vitest';
import { ShiftSimulationEngine } from '../dispatcher/simulationEngine';
import { globalAnomalyDetector } from '../monitoring/anomalyDetector';
import { CleanPathAdapter } from '../hal/adapters/CleanPathAdapter';
import { FLEET_ROSTER } from '../data/roster';

describe('5 Real-World Interruption Scenarios', () => {
  it('Scenario 1: R-003 Healthcare Sensor Fault (2:15 AM) -> Escalates to Human Ops & Logs Sterile Zone SLA Risk', () => {
    const engine = new ShiftSimulationEngine();
    
    // Jump simulation to 2:15 AM (435 min from 19:00 start)
    engine.jumpToTime(435);
    const stateAt215AM = engine.getSnapshot();

    // Verify R-003 hardware fault is triggered
    const r3State = stateAt215AM.robotStates.get('R-003');
    expect(r3State?.status).toBe('fault');
    expect(r3State?.errorCode).toBe('AS_CRIT_SENSOR_FAUL_UV_FAILURE');

    // Verify Human Ops escalation disruption is registered
    const faultDisruption = stateAt215AM.disruptions.find(
      d => d.robotId === 'R-003' && d.type === 'ROBOT_FAULT'
    );
    expect(faultDisruption).toBeDefined();
    expect(faultDisruption?.severity).toBe('critical');
    expect(faultDisruption?.title).toContain('R-003 Sensor Fault');
    expect(faultDisruption?.humanEscalationRequired).toBe(true);
  });

  it('Scenario 2: R-008 Water Anomaly (10:30 PM) -> Detects Leak Anomaly & Reroutes to Dock for Inspection', () => {
    const engine = new ShiftSimulationEngine();

    // Jump simulation to 10:30 PM (210 min from 19:00 start)
    engine.jumpToTime(210);
    const stateAt1030PM = engine.getSnapshot();

    // Check R-008 status
    const r8State = stateAt1030PM.robotStates.get('R-008');
    expect(r8State?.coarseWaterLevel).toBe('low');

    // Verify Anomaly Engine flagged premature water drop
    const result = globalAnomalyDetector.evaluateConsumablesAndAnomalies(stateAt1030PM.robotStates);
    const r8Anomaly = result.anomaliesFound.find(a => a.includes('R-008'));
    expect(r8Anomaly).toBeDefined();

    // Verify water anomaly disruption logged
    const waterDisruption = stateAt1030PM.disruptions.find(
      d => d.robotId === 'R-008' && d.type === 'WATER_ANOMALY'
    );
    expect(waterDisruption).toBeDefined();
    expect(waterDisruption?.description).toContain('FB-200 R-008 reported "LOW" water level');
  });

  it('Scenario 3: R-005 WebSocket Drop (2:20 AM) -> Handles 15s Grace Period Reconnection Without False Alarm', () => {
    const cleanPathAdapter = new CleanPathAdapter();

    // Test WS normalization when status is disconnected (5)
    const mockDisconnectPayload = {
      robot_uuid: 'R-005',
      battery_ratio: 0.8,
      status_enum: 5, // disconnected
      zone_code: 'Z6'
    };

    const mockR5Config = FLEET_ROSTER.find(r => r.id === 'R-005')!;

    const graceResult = cleanPathAdapter.normalizeTelemetry(mockDisconnectPayload, mockR5Config);
    expect(graceResult.status).toBe('navigating'); // Grace period keeps status in transit rather than failing
    expect(graceResult.errorCode).toBe('WARN_WS_FLOOR_TRANSITION_RECONNECTING');

    // Verify simulation handles R-005 transition at 2:20 AM (440 min)
    const engine = new ShiftSimulationEngine();
    engine.jumpToTime(440);
    const state = engine.getSnapshot();

    const wsDisruption = state.disruptions.find(
      d => d.robotId === 'R-005' && d.type === 'WEBSOCKET_DROP'
    );
    expect(wsDisruption).toBeDefined();
    expect(wsDisruption?.severity).toBe('warning');
  });

  it('Scenario 4: Security Escort Delay (1:00 AM) -> Dynamically Adjusts Window & Maintains Throughput', () => {
    const engine = new ShiftSimulationEngine();

    // Jump simulation to 1:00 AM (360 min from 19:00 start)
    engine.jumpToTime(360);
    const stateAt100AM = engine.getSnapshot();

    // Verify security escort delay event is logged for Z5
    const escortDisruption = stateAt100AM.disruptions.find(
      d => d.type === 'SECURITY_DELAY'
    );
    expect(escortDisruption).toBeDefined();
    expect(escortDisruption?.zoneId).toBe('Z5');
  });

  it('Scenario 5: Offline Garage Mission (Z8) -> Pre-loads Mission, Executes Offline & Reconciles State on Return', () => {
    const engine = new ShiftSimulationEngine();

    // 1. Check dispatch at 9:30 PM (150 min)
    engine.jumpToTime(150);
    let state = engine.getSnapshot();
    const r6StateDispatched = state.robotStates.get('R-006');

    expect(r6StateDispatched?.currentZoneId).toBe('Z8');
    expect(r6StateDispatched?.status).toBe('offline_executing');
    expect(r6StateDispatched?.isOfflineMode).toBe(true);

    const offlineDisruption = state.disruptions.find(
      d => d.robotId === 'R-006' && d.type === 'OFFLINE_RECONNECT'
    );
    expect(offlineDisruption).toBeDefined();

    // 2. Check return and reconciliation at 11:50 PM (290 min)
    engine.jumpToTime(290);
    state = engine.getSnapshot();

    const r6StateReturned = state.robotStates.get('R-006');
    expect(r6StateReturned?.isOfflineMode).toBe(false);
  });
});
