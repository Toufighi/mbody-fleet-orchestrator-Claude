import { IHALAdapter, HALCommandResult, CommandAck } from '../types';
import { NormalizedTelemetry, OEMBrand, RobotConfig } from '../../types';

export class CyberCleanAdapter implements IHALAdapter {
  getOEMBrand(): OEMBrand {
    return 'CyberClean';
  }

  getProtocolFormat(): 'REST/JSON' | 'MQTT/JSON' | 'WebSocket/Protobuf' | 'HTTP/XML' {
    return 'REST/JSON';
  }

  async sendReroute(robotId: string, targetZoneId: string): Promise<CommandAck> {
    return {
      commandId: `CMD-REROUTE-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'REST/JSON',
      timestamp: new Date().toISOString(),
      nativeMessage: { url: `/oem/cyberclean/v2/robots/${robotId}/reroute`, method: 'POST', body: { targetZoneId } }
    };
  }

  async sendWaterDumpAndRefill(robotId: string): Promise<CommandAck> {
    return {
      commandId: `CMD-WATER-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'REST/JSON',
      timestamp: new Date().toISOString(),
      nativeMessage: { url: `/oem/cyberclean/v2/robots/${robotId}/refill`, method: 'POST', body: { service: 'WATER_TANK_REFILL' } }
    };
  }

  async sendEmergencyStop(robotId: string, reason: string): Promise<CommandAck> {
    return {
      commandId: `CMD-ESTOP-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'REST/JSON',
      timestamp: new Date().toISOString(),
      nativeMessage: { url: `/oem/cyberclean/v2/robots/${robotId}/estop`, method: 'POST', body: { reason } }
    };
  }

  normalizeTelemetry(rawPayload: any, robotConfig: RobotConfig): NormalizedTelemetry {
    // 4th OEM CyberClean payload
    const robotId = rawPayload.id || robotConfig.id;
    return {
      robotId,
      oem: 'CyberClean',
      timestamp: new Date().toISOString(),
      batteryPct: rawPayload.battery_level ?? 95,
      waterPct: rawPayload.fluid_level ?? 80,
      coarseWaterLevel: null,
      waterMinutesEst: { min: 60, nominal: 75, max: 85 },
      position: { x: rawPayload.x || 0, y: rawPayload.y || 0, zoneId: rawPayload.zone || null, uncertaintyMeters: 0.2 },
      status: (rawPayload.state || 'idle').toLowerCase(),
      errorCode: rawPayload.error || null,
      rawPayload: JSON.stringify(rawPayload),
      protocolFormat: 'REST/JSON'
    };
  }

  applyQuirkFilter(telemetry: NormalizedTelemetry): NormalizedTelemetry {
    return telemetry;
  }

  translateCommand(command: 'start_mission' | 'pause' | 'resume' | 'return_to_dock' | 'status_query' | 'ota_update', args: any): HALCommandResult {
    return {
      success: true,
      message: `REST API 200 OK -> CyberClean Fleet Hub /v2/robots/${args.robotId}/${command}`,
      nativePayload: { api: "CyberClean Cloud", command, target: args.zoneId },
      protocol: 'REST/JSON'
    };
  }
}
