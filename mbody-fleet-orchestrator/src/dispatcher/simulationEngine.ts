import { FLEET_ROSTER } from '../data/roster';
import { FACILITY_ZONES } from '../data/facility';
import { globalHALRegistry } from '../hal/HALRegistry';
import { globalFleetScheduler } from '../scheduler/optimizer';
import { globalFailurePredictor, PROACTIVE_RISK_WARNING_THRESHOLD } from '../ml/failurePredictor';
import { findEligibleAlternativeRobot } from '../scheduler/proactiveReplanner';
import { 
  DisruptionEvent, 
  NormalizedTelemetry, 
  RobotConfig,
  RobotState, 
  SchedulePlan, 
  ZoneState 
} from '../types';

export interface SimulationStepState {
  currentMinutesFrom1900: number; // 0 to 720
  timeDisplay: string; // "02:15 AM"
  isPlaying: boolean;
  speedMultiplier: number; // 1, 10, 60
  schedulePlan: SchedulePlan;
  robotStates: Map<string, RobotState>;
  zoneStates: Map<string, ZoneState>;
  disruptions: DisruptionEvent[];
  activeAlertsCount: number;
  latestNormalizedTelemetry: NormalizedTelemetry[];
  offlineBatchLogs: Record<string, any[]>;
}

export class ShiftSimulationEngine {
  private currentMin = 0; // Starts at 7:00 PM
  private isPlaying = false;
  private speedMultiplier = 10;
  private schedulePlan: SchedulePlan;
  private robotStates = new Map<string, RobotState>();
  private zoneStates = new Map<string, ZoneState>();
  private disruptions: DisruptionEvent[] = [];
  private telemetryHistory: NormalizedTelemetry[] = [];
  private offlineBatchLogs: Record<string, any[]> = {};
  private listeners: (() => void)[] = [];
  // Robots that have already had a proactive-risk check fired this shift, so the
  // live monitor evaluates each robot's crossing of PROACTIVE_RISK_WARNING_THRESHOLD
  // exactly once (not every 5-min tick while risk stays elevated).
  private proactivelyMonitoredRobotIds = new Set<string>();

  constructor() {
    this.schedulePlan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.7, sla: 0.3 }
    });
    this.initializeState();
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  public initializeState(): void {
    this.currentMin = 0;
    this.disruptions = [];
    this.robotStates.clear();
    this.zoneStates.clear();
    this.offlineBatchLogs = {};
    this.proactivelyMonitoredRobotIds.clear();

    FLEET_ROSTER.forEach(r => {
      this.robotStates.set(r.id, {
        id: r.id,
        batteryPct: 100,
        waterPct: r.hasWaterTank ? 100 : null,
        coarseWaterLevel: r.hasWaterTank ? (r.oem === 'FloorBot' ? 'high' : null) : null,
        waterMinutesRemainingEst: r.hasWaterTank ? { min: 80, nominal: 90, max: 100 } : null,
        status: 'idle',
        currentZoneId: null,
        x: 10 + Math.random() * 5,
        y: 10 + Math.random() * 5,
        positionUncertaintyMeters: 0.5,
        lastTelemetryTimestamp: new Date().toISOString(),
        activeMissionId: null,
        errorCode: null,
        isOfflineMode: false,
        bindingConstraint: 'none',
        totalSqFtCleanedShift: 0,
        waterCyclesCompleted: 0,
        chargeCyclesCompleted: 0
      });
    });

    FACILITY_ZONES.forEach(z => {
      this.zoneStates.set(z.id, {
        id: z.id,
        status: 'pending',
        pctCompleted: 0,
        assignedRobotId: null,
        startTime: null,
        endTime: null,
        actualSqFtCleaned: 0,
        notes: ''
      });
    });

    this.notify();
  }

  public stepMinutes(mins: number = 5): void {
    this.currentMin = Math.min(720, this.currentMin + mins);
    this.evaluateProactiveRiskMonitoring();
    this.evaluateDisruptions();
    this.updateRobotPositionsAndTelemetry();
    this.notify();
  }

  public jumpToTime(minFrom1900: number): void {
    this.currentMin = Math.min(720, Math.max(0, minFrom1900));
    this.evaluateProactiveRiskMonitoring();
    this.evaluateDisruptions();
    this.updateRobotPositionsAndTelemetry();
    this.notify();
  }

  public setSpeedMultiplier(mult: number): void {
    this.speedMultiplier = mult;
    this.notify();
  }

  public togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    this.notify();
  }

  public setPlanningMode(mode: 'OR_DETERMINISTIC' | 'ML_PROACTIVE'): void {
    this.schedulePlan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.7, sla: 0.3 },
      planningMode: mode
    });
    this.notify();
  }

  public injectHospitalLogDisruption(parsedLog: {
    affectedZoneId: string;
    zoneName: string;
    priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    reason: string;
    suggestedAction: string;
    sqFtEstimate?: number;
  }): void {
    const sqFt = parsedLog.sqFtEstimate || 4000;
    const startMin = Math.max(0, this.currentMin + 15);
    const endMin = Math.min(720, startMin + 180);

    // Re-generate schedule with ad-hoc emergency zone
    this.schedulePlan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.5, sla: 0.5 },
      customAdHocZone: {
        id: `Z_LOG_${Date.now().toString().slice(-4)}`,
        name: `${parsedLog.zoneName} (${parsedLog.reason})`,
        sqFt,
        startMin,
        endMin
      }
    });

    const event: DisruptionEvent = {
      id: `DISRUPT-LOG-${Date.now()}`,
      timestampMinutes: this.currentMin,
      timeDisplay: this.minToTimeString(this.currentMin),
      type: 'HOSPITAL_LOG_DISPATCH',
      robotId: 'FLEET',
      zoneId: parsedLog.affectedZoneId,
      severity: parsedLog.priorityLevel === 'CRITICAL' ? 'critical' : 'warning',
      title: `LLM Log Parsed: ${parsedLog.zoneName} Priority Update`,
      description: `Hospital Staff Message Parsed: "${parsedLog.reason}". Required Action: ${parsedLog.suggestedAction}`,
      status: 'resolved',
      actionTaken: `Dynamic Reprioritization: Schedule updated to accommodate ${sqFt.toLocaleString()} sq ft emergency area.`,
      humanEscalationRequired: false
    };

    this.disruptions.unshift(event);
    this.notify();
  }

  public injectCustomerAdHocRequest(zoneName: string, sqFt: number, startMin: number, endMin: number): void {
    // Re-generate schedule with ad-hoc request
    this.schedulePlan = globalFleetScheduler.generateSchedule({
      shiftDay: 'Tue',
      objectiveWeight: { cost: 0.6, sla: 0.4 },
      customAdHocZone: {
        id: 'Z_ADHOC_LOBBY',
        name: zoneName,
        sqFt,
        startMin,
        endMin
      }
    });

    const event: DisruptionEvent = {
      id: `DISRUPT-ADHOC-${Date.now()}`,
      timestampMinutes: this.currentMin,
      timeDisplay: this.minToTimeString(this.currentMin),
      type: 'CUSTOMER_AD_HOC_REQ',
      robotId: 'FLEET',
      severity: 'info',
      title: 'Customer On-Demand Request',
      description: `Hospital requested immediate cleaning of ${zoneName} (${sqFt.toLocaleString()} sq ft). Schedule re-optimized in real time.`,
      status: 'resolved',
      actionTaken: 'Re-balanced dry/wet non-critical robot schedules to cover ad-hoc area.',
      humanEscalationRequired: false
    };

    this.disruptions.unshift(event);
    this.notify();
  }

  /**
   * LIVE proactive-risk monitor. Unlike the static scheduler's ML_PROACTIVE cost
   * penalty (optimizer.ts), which only ever evaluates risk at whatever moment a
   * zone's window happens to open — and can legitimately never fire for a given
   * facility's window configuration — this checks every robot's CURRENT predicted
   * failure risk against the live simulation clock on every tick. The first time a
   * robot crosses PROACTIVE_RISK_WARNING_THRESHOLD, one of two things happens:
   *   1. If an eligible alternative robot is free to take its next upcoming task,
   *      the task is actually reassigned (a real re-plan, not just a log line).
   *   2. If no alternative exists (R-003's case — it's the only sterile-certified
   *      robot), a PROACTIVE_ML_WARNING disruption fires ahead of the eventual
   *      hard fault, giving human ops early visibility instead of only finding out
   *      at the moment of failure.
   */
  private evaluateProactiveRiskMonitoring(): void {
    const LOOKAHEAD_MIN = 150; // wide enough to catch R-003's real sanitize+clean commitment (t=480/495), which crossed the initial 120-min window in testing

    FLEET_ROSTER.forEach(robot => {
      if (this.proactivelyMonitoredRobotIds.has(robot.id)) return;

      const prediction = globalFailurePredictor.predictRobotFailureAtTime(robot.id, this.currentMin);
      if (prediction.failureProbability < PROACTIVE_RISK_WARNING_THRESHOLD) return;

      this.proactivelyMonitoredRobotIds.add(robot.id);

      const upcomingTask = this.schedulePlan.tasks
        .filter(t => t.robotId === robot.id && (t.taskType === 'clean' || t.taskType === 'sanitize') && t.startTimeMinutes >= this.currentMin && t.startTimeMinutes <= this.currentMin + LOOKAHEAD_MIN)
        .sort((a, b) => a.startTimeMinutes - b.startTimeMinutes)[0];

      if (!upcomingTask) return; // nothing scheduled soon for this robot — nothing to protect

      const zone = FACILITY_ZONES.find(z => z.id === upcomingTask.zoneId);
      if (!zone) return;

      const alternative = findEligibleAlternativeRobot(
        robot.id, zone, this.currentMin, this.schedulePlan.tasks,
        upcomingTask.startTimeMinutes, upcomingTask.endTimeMinutes
      );

      if (alternative) {
        upcomingTask.robotId = alternative.id;
        this.disruptions.unshift({
          id: `DISRUPT-PROACTIVE-REPLAN-${robot.id}-${this.currentMin}`,
          timestampMinutes: this.currentMin,
          timeDisplay: this.minToTimeString(this.currentMin),
          type: 'PROACTIVE_REPLAN',
          robotId: robot.id,
          zoneId: zone.id,
          severity: 'info',
          title: `Proactive Re-Plan: ${robot.id} Rerouted Ahead of Predicted Risk`,
          description: `ML model predicts ${robot.id}'s failure risk at ${(prediction.failureProbability * 100).toFixed(0)}% (${prediction.primaryRiskFactor}), rising toward its upcoming ${zone.name} task. An eligible, lower-risk robot was available.`,
          status: 'resolved',
          actionTaken: `${zone.id} (${zone.name}) task reassigned from ${robot.id} to ${alternative.id} before risk escalated further. No human intervention required.`,
          humanEscalationRequired: false,
          predictedMTTRMinutes: prediction.predictedMTTRMinutes
        });
      } else {
        this.disruptions.unshift({
          id: `DISRUPT-PROACTIVE-WARNING-${robot.id}-${this.currentMin}`,
          timestampMinutes: this.currentMin,
          timeDisplay: this.minToTimeString(this.currentMin),
          type: 'PROACTIVE_ML_WARNING',
          robotId: robot.id,
          zoneId: zone.id,
          severity: zone.requiresSterileRobot ? 'critical' : 'warning',
          title: `Proactive ML Warning: ${robot.id} Elevated Failure Risk, No Backup Available`,
          description: `ML model predicts ${robot.id}'s failure risk has reached ${(prediction.failureProbability * 100).toFixed(0)}% (${prediction.primaryRiskFactor}), ahead of its scheduled ${zone.name} task at ${this.minToTimeString(upcomingTask.startTimeMinutes)}. No eligible alternative robot is available to reassign this task.`,
          status: 'active',
          actionTaken: 'Flagged for early human ops awareness. No re-plan possible — monitoring continues; escalation will follow automatically if the robot actually faults.',
          humanEscalationRequired: zone.requiresSterileRobot,
          escalationDetails: zone.requiresSterileRobot ? `Recommend proactive technician inspection of ${robot.id} before its ${zone.name} window opens, given no backup sterile-certified robot exists.` : undefined,
          predictedMTTRMinutes: prediction.predictedMTTRMinutes
        });
      }
    });
  }

  private evaluateDisruptions(): void {
    // 1. t = 150m (9:30 PM): R-006 dispatched to Z8 Parking Garage (Offline mode)
    if (this.currentMin >= 150 && !this.disruptions.some(d => d.id === 'DISRUPT-OFFLINE-GARAGE')) {
      const r006 = this.robotStates.get('R-006');
      if (r006) {
        r006.isOfflineMode = true;
        r006.status = 'offline_executing';
        r006.currentZoneId = 'Z8';
      }
      this.disruptions.unshift({
        id: 'DISRUPT-OFFLINE-GARAGE',
        timestampMinutes: 150,
        timeDisplay: '09:30 PM',
        type: 'OFFLINE_RECONNECT',
        robotId: 'R-006',
        zoneId: 'Z8',
        severity: 'info',
        title: 'Offline Mission Dispatched (Z8 Garage)',
        description: 'R-006 dispatched to Parking Garage L1 (No WiFi). Pre-loaded offline mission package stored in robot local flash memory.',
        status: 'active',
        actionTaken: 'HAL pre-loaded task waypoints & buffer telemetry locally.',
        humanEscalationRequired: false
      });
    }

    // 2. t = 210m (10:30 PM): R-008 FloorBot Water Anomaly
    if (this.currentMin >= 210 && !this.disruptions.some(d => d.id === 'DISRUPT-WATER-ANOMALY-R008')) {
      const r008 = this.robotStates.get('R-008');
      if (r008) {
        r008.coarseWaterLevel = 'low';
        r008.waterPct = 20;
        r008.errorCode = 'FB_WARN_WATER_LOW_UNEXPECTED';
      }
      this.disruptions.unshift({
        id: 'DISRUPT-WATER-ANOMALY-R008',
        timestampMinutes: 210,
        timeDisplay: '10:30 PM',
        type: 'WATER_ANOMALY',
        robotId: 'R-008',
        zoneId: 'Z6',
        severity: 'warning',
        title: 'Water Level Anomaly Detected (R-008)',
        description: 'FB-200 R-008 reported "LOW" water level after only 20 min of cleaning. Possible tank leak, coarse sensor lag, or valve issue.',
        status: 'active',
        actionTaken: 'Anomaly Engine flagged leak risk (Score 82/100). Auto-routed R-008 to dock for 10-min inspection and refill.',
        humanEscalationRequired: false
      });
    }

    // 3. t = 290m (11:50 PM): R-006 returns from Z8 Parking Garage & syncs batch logs
    if (this.currentMin >= 290 && !this.disruptions.some(d => d.id === 'DISRUPT-OFFLINE-SYNC')) {
      const r006 = this.robotStates.get('R-006');
      if (r006) {
        r006.isOfflineMode = false;
        r006.status = 'idle';
        r006.totalSqFtCleanedShift += 12000;
      }
      const z8 = this.zoneStates.get('Z8');
      if (z8) {
        z8.status = 'completed';
        z8.pctCompleted = 100;
        z8.actualSqFtCleaned = 12000;
        z8.notes = 'Offline mission executed seamlessly. Reconciled 140 telemetry frames on WiFi reconnect.';
      }

      this.disruptions.unshift({
        id: 'DISRUPT-OFFLINE-SYNC',
        timestampMinutes: 290,
        timeDisplay: '11:50 PM',
        type: 'OFFLINE_RECONNECT',
        robotId: 'R-006',
        zoneId: 'Z8',
        severity: 'info',
        title: 'Offline Mission Reconnected & Reconciled',
        description: 'R-006 returned from Z8 Parking Garage. Synchronized 140 offline batch telemetry frames and reconciled 12,000 sq ft cleaned.',
        status: 'resolved',
        actionTaken: 'Reconciliation Protocol validated zero collision events and 100% completion.',
        humanEscalationRequired: false
      });
    }

    // 4. t = 360m (1:00 AM): Security Escort Delay at Z5 Patient Halls
    if (this.currentMin >= 360 && !this.disruptions.some(d => d.id === 'DISRUPT-SECURITY-ESCORT')) {
      this.disruptions.unshift({
        id: 'DISRUPT-SECURITY-ESCORT',
        timestampMinutes: 360,
        timeDisplay: '01:00 AM',
        type: 'SECURITY_DELAY',
        robotId: 'R-003',
        zoneId: 'Z5',
        severity: 'warning',
        title: 'Security Escort Delay (Z5 Patient Halls)',
        description: 'Robot arrived at Z5 Patient Halls at 1:00 AM, but security escort was delayed 25 minutes. Escort arrived at 1:25 AM.',
        status: 'resolved',
        actionTaken: 'Dynamic Window Compressor verified remaining 215 mins is sufficient for 85 min clean. Queue adjusted without SLA breach.',
        humanEscalationRequired: false
      });
    }

    // 5. t = 435m (2:15 AM): R-003 Healthcare Scrubber Hardware Sensor Fault! (CRITICAL)
    if (this.currentMin >= 435 && !this.disruptions.some(d => d.id === 'DISRUPT-FAULT-R003')) {
      const r003 = this.robotStates.get('R-003');
      if (r003) {
        r003.status = 'fault';
        r003.errorCode = 'AS_CRIT_SENSOR_FAUL_UV_FAILURE';
      }
      this.disruptions.unshift({
        id: 'DISRUPT-FAULT-R003',
        timestampMinutes: 435,
        timeDisplay: '02:15 AM',
        type: 'ROBOT_FAULT',
        robotId: 'R-003',
        zoneId: 'Z2',
        severity: 'critical',
        title: 'CRITICAL: R-003 Sensor Fault (Sterile Certified Robot)',
        description: 'The ONLY healthcare-grade sterile robot (AS-900H R-003) reported a critical UV/sensor fault and halted. Sterile zones Z2 (3:00 AM-5:00 AM) and Z5 at risk.',
        status: 'escalated',
        actionTaken: 'Triggered Human Ops Escalation Alert. Logged potential SLA breach. Presented manual human sanitization escort override option.',
        humanEscalationRequired: true,
        escalationDetails: 'ML MTTR Model predicts 180 mins repair time. Recommend dispatching hospital facilities technician for manual UV sanitization override or extending Z2 cleaning window to morning shift.',
        predictedMTTRMinutes: 180
      });
    }

    // 6. t = 440m (2:20 AM): R-005 WebSocket Drop in Z6
    if (this.currentMin >= 440 && !this.disruptions.some(d => d.id === 'DISRUPT-WS-DROP-R005')) {
      this.disruptions.unshift({
        id: 'DISRUPT-WS-DROP-R005',
        timestampMinutes: 440,
        timeDisplay: '02:20 AM',
        type: 'WEBSOCKET_DROP',
        robotId: 'R-005',
        zoneId: 'Z6',
        severity: 'warning',
        title: 'CleanPath WebSocket Connection Dropped (R-005)',
        description: 'CleanPath CP-X1 R-005 dropped WebSocket stream during floor transition in Zone Z6.',
        status: 'resolved',
        actionTaken: 'CleanPath HAL Grace Period Timer held connection for 15s. Auto-reconnected in 14.2s without triggering false system alert.',
        humanEscalationRequired: false
      });
    }
  }

  private updateRobotPositionsAndTelemetry(): void {
    const currentTasksAtTime = this.schedulePlan.tasks.filter(t => 
      this.currentMin >= t.startTimeMinutes && this.currentMin <= t.endTimeMinutes
    );

    const latestTelemetry: NormalizedTelemetry[] = [];

    this.robotStates.forEach((state, robotId) => {
      const config = FLEET_ROSTER.find(r => r.id === robotId)!;
      const activeTask = currentTasksAtTime.find(t => t.robotId === robotId);

      if (state.status !== 'fault' && !state.isOfflineMode) {
        if (activeTask) {
          state.currentZoneId = activeTask.zoneId;
          if (activeTask.taskType === 'clean') {
            state.status = 'cleaning';
            state.totalSqFtCleanedShift += Math.round(config.coverageSqFtHr * (5 / 60));
            
            // Deduct battery & water
            state.batteryPct = Math.max(10, state.batteryPct - 1.2);
            if (config.hasWaterTank && state.waterPct !== null) {
              state.waterPct = Math.max(0, state.waterPct - 2.5);
              if (config.oem === 'FloorBot') {
                state.coarseWaterLevel = state.waterPct > 70 ? 'high' : state.waterPct > 35 ? 'med' : state.waterPct > 10 ? 'low' : 'empty';
              }
            }
          } else if (activeTask.taskType === 'charge') {
            state.status = 'charging';
            state.batteryPct = Math.min(100, state.batteryPct + 5.5);
          } else if (activeTask.taskType === 'water_refill') {
            state.status = 'refilling_water';
            if (config.hasWaterTank) {
              state.waterPct = 100;
              if (config.oem === 'FloorBot') state.coarseWaterLevel = 'high';
            }
          } else if (activeTask.taskType === 'sanitize') {
            state.status = 'sanitizing';
          }
        } else {
          state.status = 'idle';
        }
      }

      // Generate raw telemetry via HAL Registry
      const rawPayloadMock = this.buildMockRawPayload(config, state);
      const normalized = globalHALRegistry.normalizeTelemetry(rawPayloadMock, config);
      latestTelemetry.push(normalized);
    });

    this.telemetryHistory = latestTelemetry;
  }

  private buildMockRawPayload(config: RobotConfig, state: RobotState): any {
    if (config.oem === 'AutoScrub') {
      return {
        device_id: config.id,
        bat_lvl: Math.round(state.batteryPct),
        h2o_lvl: Math.round(state.waterPct ?? 100),
        pos_x: Number(state.x.toFixed(1)),
        pos_y: Number(state.y.toFixed(1)),
        status_code: state.status === 'cleaning' ? 'SCRUBBING' : state.status === 'charging' ? 'DOCK_CHARGING' : state.status === 'fault' ? 'FAULT' : 'IDLE',
        active_zone: state.currentZoneId,
        err: state.errorCode
      };
    } else if (config.oem === 'CleanPath') {
      return {
        robot_uuid: config.id,
        battery_ratio: Number((state.batteryPct / 100).toFixed(2)),
        pos_m: { x: Number(state.x.toFixed(1)), y: Number(state.y.toFixed(1)) },
        status_enum: state.status === 'cleaning' ? 2 : state.status === 'charging' ? 3 : 1,
        zone_code: state.currentZoneId,
        fault_code: state.status === 'fault' ? 99 : 0
      };
    } else {
      // FloorBot XML string
      return `<floorbot><id>${config.id}</id><bat>${Math.round(state.batteryPct)}</bat><water>${state.coarseWaterLevel || 'med'}</water><zone>${state.currentZoneId || ''}</zone><state>${state.status.toUpperCase()}</state><err>${state.errorCode ? '1' : '0'}</err></floorbot>`;
    }
  }

  /**
   * Real state mutation used by the Ops Agent's `execute_reassignment` tool
   * (src/server/opsAgent.ts). Unlike the automatic live monitor
   * (evaluateProactiveRiskMonitoring), this is invoked when Claude, acting as an
   * agent, decides a reassignment is the right action after reasoning over tool
   * results — this method is the actual side effect that decision produces.
   */
  public reassignTask(zoneId: string, fromRobotId: string, toRobotId: string): { success: boolean; message: string } {
    const task = this.schedulePlan.tasks.find(
      t => t.zoneId === zoneId && t.robotId === fromRobotId && (t.taskType === 'clean' || t.taskType === 'sanitize')
    );
    if (!task) {
      return { success: false, message: `No active task found for ${fromRobotId} in ${zoneId}.` };
    }
    const toRobot = FLEET_ROSTER.find(r => r.id === toRobotId);
    if (!toRobot) {
      return { success: false, message: `Unknown robot ${toRobotId}.` };
    }
    task.robotId = toRobotId;
    this.notify();
    return { success: true, message: `Reassigned ${zoneId} from ${fromRobotId} to ${toRobotId}.` };
  }

  /**
   * Real state mutation used by the Ops Agent's `escalate_to_human` tool. Pushes an
   * actual disruption event into the live feed — the escalation the agent decided on
   * genuinely appears in the Disruption Console, not just in a chat transcript.
   */
  public logEscalation(robotId: string, zoneId: string | undefined, title: string, description: string, recommendedActions: string, mttr?: number): DisruptionEvent {
    const event: DisruptionEvent = {
      id: `DISRUPT-AGENT-ESCALATION-${robotId}-${this.currentMin}`,
      timestampMinutes: this.currentMin,
      timeDisplay: this.minToTimeString(this.currentMin),
      type: 'PROACTIVE_ML_WARNING',
      robotId,
      zoneId,
      severity: 'critical',
      title,
      description,
      status: 'escalated',
      actionTaken: 'Escalated by the Ops Agent after autonomous tool-driven reasoning — see agent transcript for the decision trail.',
      humanEscalationRequired: true,
      escalationDetails: recommendedActions,
      predictedMTTRMinutes: mttr
    };
    this.disruptions.unshift(event);
    this.notify();
    return event;
  }

  /** Read-only status lookup used by the Ops Agent's `get_robot_status` tool. */
  public getRobotStatus(robotId: string): RobotState | null {
    return this.robotStates.get(robotId) || null;
  }

  public getSnapshot(): SimulationStepState {
    const activeAlerts = this.disruptions.filter(d => d.status === 'active' || d.status === 'escalated').length;
    return {
      currentMinutesFrom1900: this.currentMin,
      timeDisplay: this.minToTimeString(this.currentMin),
      isPlaying: this.isPlaying,
      speedMultiplier: this.speedMultiplier,
      schedulePlan: this.schedulePlan,
      robotStates: new Map(this.robotStates),
      zoneStates: new Map(this.zoneStates),
      disruptions: [...this.disruptions],
      activeAlertsCount: activeAlerts,
      latestNormalizedTelemetry: [...this.telemetryHistory],
      offlineBatchLogs: { ...this.offlineBatchLogs }
    };
  }

  private minToTimeString(minFrom19: number): string {
    let totalMins = (19 * 60 + minFrom19) % (24 * 60);
    let h = Math.floor(totalMins / 60);
    let m = totalMins % 60;
    const hStr = h < 10 ? `0${h}` : `${h}`;
    const mStr = m < 10 ? `0${m}` : `${m}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH < 10 ? '0' + displayH : displayH}:${mStr} ${ampm}`;
  }
}

export const globalSimulationEngine = new ShiftSimulationEngine();
