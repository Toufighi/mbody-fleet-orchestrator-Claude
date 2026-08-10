/**
 * Multi-OEM Fleet Orchestration System - Type Definitions
 */

export type OEMBrand = 'AutoScrub' | 'CleanPath' | 'FloorBot' | 'CyberClean';

export type RobotModel = 'AS-900' | 'AS-900H' | 'CP-V2' | 'CP-X1' | 'FB-200' | 'CC-1000';

export type FloorType = 'Hard' | 'Carpet' | 'Mixed' | 'Concrete';

export type ZoneClassification = 'High-traffic' | 'Sterile' | 'Standard';

export type RobotStatus = 
  | 'idle' 
  | 'navigating' 
  | 'cleaning' 
  | 'charging' 
  | 'refilling_water' 
  | 'sanitizing' 
  | 'offline_executing' 
  | 'fault' 
  | 'disconnected';

export type CoarseWaterBucket = 'high' | 'med' | 'low' | 'empty';

export interface RobotConfig {
  id: string;
  oem: OEMBrand;
  model: RobotModel;
  coverageSqFtHr: number; // e.g. 8000
  batteryCapacityHours: number; // e.g. 4
  waterTankHours: number | null; // null for dry-only
  capabilities: string[];
  isSterileCertified: boolean;
  hasWaterTank: boolean;
  quirkDescription: string;
}

export interface RobotState {
  id: string;
  batteryPct: number; // 0 - 100
  waterPct: number | null; // 0 - 100 or null
  coarseWaterLevel: CoarseWaterBucket | null;
  waterMinutesRemainingEst: { min: number; nominal: number; max: number } | null;
  status: RobotStatus;
  currentZoneId: string | null;
  x: number;
  y: number;
  positionUncertaintyMeters: number;
  lastTelemetryTimestamp: string;
  activeMissionId: string | null;
  errorCode: string | null;
  isOfflineMode: boolean;
  bindingConstraint: 'battery' | 'water' | 'none';
  totalSqFtCleanedShift: number;
  waterCyclesCompleted: number;
  chargeCyclesCompleted: number;
}

export interface ZoneConfig {
  id: string; // e.g. Z1
  name: string; // Main Lobby
  sqFt: number; // 4200
  floorType: FloorType;
  floorMaterial?: string; // e.g. "Porous Unsealed Concrete", "High-Gloss Epoxy Tile", "Standard VCT Vinyl"
  waterMultiplier?: number; // e.g. 1.4 for Concrete, 0.85 for Epoxy, 1.0 for VCT
  classification: ZoneClassification;
  cleaningWindowStart: string; // "21:00"
  cleaningWindowEnd: string; // "06:00"
  allowedDays: string[]; // ['daily'] or ['Tue', 'Sat'] etc.
  requiresSterileRobot: boolean;
  requiresSecurityEscort: boolean;
  hasWifi: boolean;
}

export interface ZoneState {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'missed';
  pctCompleted: number;
  assignedRobotId: string | null;
  startTime: string | null;
  endTime: string | null;
  actualSqFtCleaned: number;
  notes: string;
}

export interface ScheduledTask {
  id: string;
  robotId: string;
  zoneId: string;
  taskType: 'clean' | 'charge' | 'water_refill' | 'sanitize' | 'offline_transit';
  startTimeMinutes: number; // minutes from 19:00 (0 = 7:00 PM)
  durationMinutes: number;
  endTimeMinutes: number;
  bindingConstraintAtStart: 'battery' | 'water' | 'none';
  sqFtTarget: number;
  isAdHoc?: boolean;
  predictedFailureRiskAtStart?: number; // ML predicted P(failure | t)
  riskPenaltyApplied?: number;
}

export type PlanningMode = 'OR_DETERMINISTIC' | 'ML_PROACTIVE';

export interface SchedulePlan {
  id: string;
  generatedAt: string;
  planningMode: PlanningMode;
  objectiveWeight: { cost: number; sla: number }; // cost weight vs SLA weight
  tasks: ScheduledTask[];
  unassignedZones: string[];
  estimatedTotalCost: number;
  estimatedSLACompliancePct: number;
  estimatedTotalSqFtCleaned: number;
  proactiveRiskPenaltiesApplied?: number;
  confidenceThresholdPct?: number; // e.g. 95
}

export interface DisruptionEvent {
  id: string;
  timestampMinutes: number; // minutes from 7:00 PM
  timeDisplay: string; // "02:15 AM"
  type: 
    | 'ROBOT_FAULT'
    | 'WATER_ANOMALY'
    | 'WEBSOCKET_DROP'
    | 'SECURITY_DELAY'
    | 'OFFLINE_RECONNECT'
    | 'CUSTOMER_AD_HOC_REQ'
    | 'HOSPITAL_LOG_DISPATCH'
    | 'PROACTIVE_ML_WARNING'
    | 'PROACTIVE_REPLAN';
  robotId: string;
  zoneId?: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  status: 'active' | 'investigating' | 'resolved' | 'escalated';
  actionTaken: string;
  humanEscalationRequired: boolean;
  escalationDetails?: string;
  predictedMTTRMinutes?: number; // ML predicted mean time to repair
}

export interface NormalizedTelemetry {
  robotId: string;
  oem: OEMBrand;
  timestamp: string;
  batteryPct: number;
  waterPct: number | null;
  coarseWaterLevel: CoarseWaterBucket | null;
  waterMinutesEst: { min: number; nominal: number; max: number } | null;
  position: { x: number; y: number; zoneId: string | null; uncertaintyMeters: number };
  status: RobotStatus;
  errorCode: string | null;
  rawPayload: string;
  protocolFormat: 'MQTT/JSON' | 'WebSocket/Protobuf' | 'HTTP/XML' | 'REST/JSON';
}

export interface ConsumableMetric {
  robotId: string;
  waterUsedGallons: number;
  waterRefillCount: number;
  expectedWaterMinutes: number;
  actualWaterMinutes: number;
  leakRiskScore: number; // 0 - 100
  batteryHealthPct: number; // 0 - 100
}

export interface ShiftSummaryReport {
  shiftDate: string;
  totalZonesScheduled: number;
  zonesCompletedOnTime: number;
  zonesPartial: number;
  zonesMissed: number;
  slaCompliancePct: number;
  totalSqFtCleaned: number;
  totalFleetOperatingHours: number;
  waterRefillsCompleted: number;
  disruptionsEncountered: number;
  humanEscalationsCount: number;
  oemErrorBreakdown: Record<OEMBrand, number>;
  anomaliesDetected: string[];
}
