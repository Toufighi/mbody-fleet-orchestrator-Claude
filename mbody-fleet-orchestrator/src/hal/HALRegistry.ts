import { IHALAdapter, HALCommandResult, CommandAck } from './types';
import { AutoScrubAdapter } from './adapters/AutoScrubAdapter';
import { CleanPathAdapter } from './adapters/CleanPathAdapter';
import { FloorBotAdapter } from './adapters/FloorBotAdapter';
import { CyberCleanAdapter } from './adapters/CyberCleanAdapter';
import { NormalizedTelemetry, OEMBrand, RobotConfig } from '../types';

export class HALRegistry {
  private adapters: Map<OEMBrand, IHALAdapter> = new Map();

  constructor() {
    // Register standard 3 OEM adapters + 1 extensible 4th OEM adapter
    this.registerAdapter(new AutoScrubAdapter());
    this.registerAdapter(new CleanPathAdapter());
    this.registerAdapter(new FloorBotAdapter());
    this.registerAdapter(new CyberCleanAdapter());
  }

  public registerAdapter(adapter: IHALAdapter): void {
    this.adapters.set(adapter.getOEMBrand(), adapter);
  }

  public getAdapter(oem: OEMBrand): IHALAdapter {
    const adapter = this.adapters.get(oem);
    if (!adapter) {
      throw new Error(`No HAL Adapter registered for OEM: ${oem}`);
    }
    return adapter;
  }

  /**
   * Outbound HAL Command Adapter methods for downstream OEM calls
   */
  public async sendReroute(robotId: string, oem: OEMBrand, targetZoneId: string): Promise<CommandAck> {
    return this.getAdapter(oem).sendReroute(robotId, targetZoneId);
  }

  public async sendWaterDumpAndRefill(robotId: string, oem: OEMBrand): Promise<CommandAck> {
    return this.getAdapter(oem).sendWaterDumpAndRefill(robotId);
  }

  public async sendEmergencyStop(robotId: string, oem: OEMBrand, reason: string): Promise<CommandAck> {
    return this.getAdapter(oem).sendEmergencyStop(robotId, reason);
  }

  /**
   * Normalizes raw OEM payload from MQTT, WebSocket, or HTTP XML into internal common schema
   */
  public normalizeTelemetry(rawPayload: any, robotConfig: RobotConfig): NormalizedTelemetry {
    const adapter = this.getAdapter(robotConfig.oem);
    return adapter.normalizeTelemetry(rawPayload, robotConfig);
  }

  /**
   * Dispatches unified internal command through OEM adapter
   */
  public dispatchCommand(
    oem: OEMBrand,
    command: 'start_mission' | 'pause' | 'resume' | 'return_to_dock' | 'status_query' | 'ota_update',
    args: any
  ): HALCommandResult {
    const adapter = this.getAdapter(oem);
    return adapter.translateCommand(command, args);
  }

  /**
   * Returns list of currently supported OEM brands
   */
  public getRegisteredOEMs(): OEMBrand[] {
    return Array.from(this.adapters.keys());
  }
}

// Global Singleton Instance
export const globalHALRegistry = new HALRegistry();
