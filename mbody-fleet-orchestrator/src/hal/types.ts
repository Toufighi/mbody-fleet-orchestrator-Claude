import { NormalizedTelemetry, OEMBrand, RobotConfig, RobotState } from '../types';

export interface HALCommandResult {
  success: boolean;
  message: string;
  nativePayload: any;
  protocol: string;
}

export interface CommandAck {
  commandId: string;
  robotId: string;
  status: 'ACK' | 'NACK' | 'QUEUED';
  protocol: 'MQTT/JSON' | 'WebSocket/Protobuf' | 'HTTP/XML' | 'REST/JSON';
  timestamp: string;
  nativeMessage: any;
}

export interface IHALCommandAdapter {
  sendReroute(robotId: string, targetZoneId: string): Promise<CommandAck>;
  sendWaterDumpAndRefill(robotId: string): Promise<CommandAck>;
  sendEmergencyStop(robotId: string, reason: string): Promise<CommandAck>;
}

export interface IHALAdapter extends IHALCommandAdapter {
  getOEMBrand(): OEMBrand;
  getProtocolFormat(): 'MQTT/JSON' | 'WebSocket/Protobuf' | 'HTTP/XML' | 'REST/JSON';
  
  /**
   * Normalizes OEM raw telemetry payload into internal unified telemetry schema
   */
  normalizeTelemetry(rawPayload: any, robotConfig: RobotConfig): NormalizedTelemetry;
  
  /**
   * Translates unified internal command into OEM-specific API protocol call payload
   */
  translateCommand(command: 'start_mission' | 'pause' | 'resume' | 'return_to_dock' | 'status_query' | 'ota_update', args: any): HALCommandResult;
  
  /**
   * Handles OEM specific quirk (e.g. GPS smoothing, WS drop timers, coarse bucket estimation)
   */
  applyQuirkFilter(telemetry: NormalizedTelemetry): NormalizedTelemetry;
}
