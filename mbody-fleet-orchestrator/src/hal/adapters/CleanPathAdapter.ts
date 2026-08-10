import { IHALAdapter, HALCommandResult, CommandAck } from '../types';
import { NormalizedTelemetry, OEMBrand, RobotConfig } from '../../types';

export class CleanPathAdapter implements IHALAdapter {
  private wsDisconnectTracker: Record<string, number> = {};

  getOEMBrand(): OEMBrand {
    return 'CleanPath';
  }

  getProtocolFormat(): 'WebSocket/Protobuf' | 'MQTT/JSON' | 'HTTP/XML' | 'REST/JSON' {
    return 'WebSocket/Protobuf';
  }

  async sendReroute(robotId: string, targetZoneId: string): Promise<CommandAck> {
    return {
      commandId: `CMD-REROUTE-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'WebSocket/Protobuf',
      timestamp: new Date().toISOString(),
      nativeMessage: { protobufFrame: `08011208${robotId}18042202${targetZoneId}`, opCode: 'REROUTE_NAV_GOAL' }
    };
  }

  async sendWaterDumpAndRefill(robotId: string): Promise<CommandAck> {
    return {
      commandId: `CMD-WATER-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'WebSocket/Protobuf',
      timestamp: new Date().toISOString(),
      nativeMessage: { protobufFrame: `08011208${robotId}1809`, opCode: 'SERVICE_WATER_REFILL' }
    };
  }

  async sendEmergencyStop(robotId: string, reason: string): Promise<CommandAck> {
    return {
      commandId: `CMD-ESTOP-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'WebSocket/Protobuf',
      timestamp: new Date().toISOString(),
      nativeMessage: { protobufFrame: `08011208${robotId}1899`, opCode: 'EMERGENCY_STOP', reason }
    };
  }

  normalizeTelemetry(rawPayload: any, robotConfig: RobotConfig): NormalizedTelemetry {
    // Simulated Protobuf decoded message:
    // { robot_uuid: "CP-X1-005", battery_ratio: 0.82, pos_m: {x: 35.1, y: 18.2}, status_enum: 2, zone_code: "Z6", fault_code: 0, ws_dropped: false }
    const robotId = rawPayload.robot_uuid || robotConfig.id;
    const batteryPct = Math.round((rawPayload.battery_ratio ?? 0.8) * 100);
    const errorCode = rawPayload.fault_code && rawPayload.fault_code !== 0 ? `CP_ERR_${rawPayload.fault_code}` : null;

    let status = 'idle';
    switch (rawPayload.status_enum) {
      case 2: status = 'cleaning'; break;
      case 3: status = 'charging'; break;
      case 4: status = 'navigating'; break;
      case 5: status = 'disconnected'; break;
      case 9: status = 'fault'; break;
      default: status = 'idle';
    }

    const telemetry: NormalizedTelemetry = {
      robotId,
      oem: 'CleanPath',
      timestamp: new Date().toISOString(),
      batteryPct,
      waterPct: null, // Dry clean only!
      coarseWaterLevel: null,
      waterMinutesEst: null,
      position: {
        x: rawPayload.pos_m?.x ?? 0,
        y: rawPayload.pos_m?.y ?? 0,
        zoneId: rawPayload.zone_code || null,
        uncertaintyMeters: 0.3
      },
      status: status as any,
      errorCode,
      rawPayload: `Protobuf<CleanPathTelemetry>{uuid:"${robotId}", battery:${batteryPct}%, status:${rawPayload.status_enum}}`,
      protocolFormat: 'WebSocket/Protobuf'
    };

    return this.applyQuirkFilter(telemetry);
  }

  applyQuirkFilter(telemetry: NormalizedTelemetry): NormalizedTelemetry {
    // Handle WebSocket floor transition drop quirk (auto-reconnect in ~15s)
    if (telemetry.status === 'disconnected') {
      const robotId = telemetry.robotId;
      if (!this.wsDisconnectTracker[robotId]) {
        this.wsDisconnectTracker[robotId] = Date.now();
      }

      const disconnectDurationSec = (Date.now() - this.wsDisconnectTracker[robotId]) / 1000;
      
      // If disconnected for less than 20 seconds, flag as transition grace period rather than hard failure
      if (disconnectDurationSec < 20) {
        return {
          ...telemetry,
          status: 'navigating', // Treat as in transit / reconnecting
          errorCode: 'WARN_WS_FLOOR_TRANSITION_RECONNECTING'
        };
      }
    } else {
      delete this.wsDisconnectTracker[telemetry.robotId];
    }

    return telemetry;
  }

  translateCommand(command: 'start_mission' | 'pause' | 'resume' | 'return_to_dock' | 'status_query' | 'ota_update', args: any): HALCommandResult {
    // Translate command to gRPC RPC Call
    const grpcCall = `CleanPathFleetService/DispatchTask(RobotUUID="${args.robotId}", Mode=${command.toUpperCase()}, Zone="${args.zoneId || 'NONE'}")`;
    const protobufBufferHex = "08011208522d303035180222025a36";

    return {
      success: true,
      message: `gRPC OK: ${grpcCall}`,
      nativePayload: { protobuf_hex: protobufBufferHex, service: "CleanPathFleetService", method: "DispatchTask" },
      protocol: 'gRPC/Protobuf'
    };
  }
}
