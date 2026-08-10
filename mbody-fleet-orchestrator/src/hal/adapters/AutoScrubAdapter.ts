import { IHALAdapter, HALCommandResult, CommandAck } from '../types';
import { NormalizedTelemetry, OEMBrand, RobotConfig } from '../../types';

export class AutoScrubAdapter implements IHALAdapter {
  private lastPositionHistory: Record<string, { x: number; y: number }[]> = {};

  getOEMBrand(): OEMBrand {
    return 'AutoScrub';
  }

  getProtocolFormat(): 'MQTT/JSON' | 'WebSocket/Protobuf' | 'HTTP/XML' | 'REST/JSON' {
    return 'MQTT/JSON';
  }

  async sendReroute(robotId: string, targetZoneId: string): Promise<CommandAck> {
    return {
      commandId: `CMD-REROUTE-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'MQTT/JSON',
      timestamp: new Date().toISOString(),
      nativeMessage: { topic: `/autoscrub/${robotId}/cmd/reroute`, payload: { target_zone: targetZoneId, priority: 1 } }
    };
  }

  async sendWaterDumpAndRefill(robotId: string): Promise<CommandAck> {
    return {
      commandId: `CMD-WATER-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'MQTT/JSON',
      timestamp: new Date().toISOString(),
      nativeMessage: { topic: `/autoscrub/${robotId}/cmd/water_service`, payload: { action: 'DRAIN_AND_REFILL' } }
    };
  }

  async sendEmergencyStop(robotId: string, reason: string): Promise<CommandAck> {
    return {
      commandId: `CMD-ESTOP-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'MQTT/JSON',
      timestamp: new Date().toISOString(),
      nativeMessage: { topic: `/autoscrub/${robotId}/cmd/estop`, payload: { state: 'ESTOP', reason } }
    };
  }

  normalizeTelemetry(rawPayload: any, robotConfig: RobotConfig): NormalizedTelemetry {
    // Expected raw AutoScrub MQTT JSON:
    // { device_id: "R-001", ts: 1723000000, bat_lvl: 85, h2o_lvl: 70, pos_x: 12.4, pos_y: 8.2, status_code: "SCRUBBING", active_zone: "Z1", err: null }
    const robotId = rawPayload.device_id || robotConfig.id;
    const batteryPct = rawPayload.bat_lvl ?? 100;
    const waterPct = rawPayload.h2o_lvl ?? 100;
    const rawX = rawPayload.pos_x ?? 0;
    const rawY = rawPayload.pos_y ?? 0;
    const errorCode = rawPayload.err || null;

    let status = 'idle';
    switch (rawPayload.status_code) {
      case 'SCRUBBING': status = 'cleaning'; break;
      case 'DOCK_CHARGING': status = 'charging'; break;
      case 'REFILLING_TANK': status = 'refilling_water'; break;
      case 'SANITIZING': status = 'sanitizing'; break;
      case 'TRANSIT': status = 'navigating'; break;
      case 'FAULT': status = 'fault'; break;
      default: status = 'idle';
    }

    const telemetry: NormalizedTelemetry = {
      robotId,
      oem: 'AutoScrub',
      timestamp: new Date().toISOString(),
      batteryPct,
      waterPct,
      coarseWaterLevel: null,
      waterMinutesEst: {
        min: Math.max(0, Math.round((waterPct / 100) * 80)),
        nominal: Math.round((waterPct / 100) * 90),
        max: Math.min(90, Math.round((waterPct / 100) * 100))
      },
      position: {
        x: rawX,
        y: rawY,
        zoneId: rawPayload.active_zone || null,
        uncertaintyMeters: 2.0 // AutoScrub known GPS drift quirk
      },
      status: status as any,
      errorCode,
      rawPayload: JSON.stringify(rawPayload),
      protocolFormat: 'MQTT/JSON'
    };

    return this.applyQuirkFilter(telemetry);
  }

  applyQuirkFilter(telemetry: NormalizedTelemetry): NormalizedTelemetry {
    // Smooth AutoScrub ±2m GPS drift using moving average filter over last 3 samples
    const robotId = telemetry.robotId;
    if (!this.lastPositionHistory[robotId]) {
      this.lastPositionHistory[robotId] = [];
    }

    const history = this.lastPositionHistory[robotId];
    history.push({ x: telemetry.position.x, y: telemetry.position.y });
    if (history.length > 3) history.shift();

    const smoothedX = history.reduce((acc, p) => acc + p.x, 0) / history.length;
    const smoothedY = history.reduce((acc, p) => acc + p.y, 0) / history.length;

    return {
      ...telemetry,
      position: {
        ...telemetry.position,
        x: Number(smoothedX.toFixed(2)),
        y: Number(smoothedY.toFixed(2)),
        uncertaintyMeters: 0.5 // Reduced uncertainty after smoothing
      }
    };
  }

  translateCommand(command: 'start_mission' | 'pause' | 'resume' | 'return_to_dock' | 'status_query' | 'ota_update', args: any): HALCommandResult {
    // Translate internal command to REST API Payload
    const endpoint = `/api/v1/autoscrub/devices/${args.robotId}/${command}`;
    const restPayload = {
      action: command.toUpperCase(),
      target_zone: args.zoneId || null,
      parameters: { speed: args.speed || 1.2, uv_c_active: args.isSterile || false },
      token: "AUTOSCRUB_BEARER_TOKEN_900"
    };

    return {
      success: true,
      message: `REST POST ${endpoint} HTTP/1.1 200 OK`,
      nativePayload: restPayload,
      protocol: 'REST/HTTP'
    };
  }
}
