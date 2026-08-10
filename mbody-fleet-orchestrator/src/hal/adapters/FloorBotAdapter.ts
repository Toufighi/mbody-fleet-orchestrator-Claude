import { IHALAdapter, HALCommandResult, CommandAck } from '../types';
import { CoarseWaterBucket, NormalizedTelemetry, OEMBrand, RobotConfig } from '../../types';

export class FloorBotAdapter implements IHALAdapter {
  getOEMBrand(): OEMBrand {
    return 'FloorBot';
  }

  getProtocolFormat(): 'HTTP/XML' | 'MQTT/JSON' | 'WebSocket/Protobuf' | 'REST/JSON' {
    return 'HTTP/XML';
  }

  async sendReroute(robotId: string, targetZoneId: string): Promise<CommandAck> {
    return {
      commandId: `CMD-REROUTE-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'HTTP/XML',
      timestamp: new Date().toISOString(),
      nativeMessage: `<command><type>REROUTE</type><robot>${robotId}</robot><zone>${targetZoneId}</zone></command>`
    };
  }

  async sendWaterDumpAndRefill(robotId: string): Promise<CommandAck> {
    return {
      commandId: `CMD-WATER-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'HTTP/XML',
      timestamp: new Date().toISOString(),
      nativeMessage: `<command><type>WATER_CYCLE</type><robot>${robotId}</robot><action>DUMP_AND_FILL</action></command>`
    };
  }

  async sendEmergencyStop(robotId: string, reason: string): Promise<CommandAck> {
    return {
      commandId: `CMD-ESTOP-${Date.now()}`,
      robotId,
      status: 'ACK',
      protocol: 'HTTP/XML',
      timestamp: new Date().toISOString(),
      nativeMessage: `<command><type>HALT</type><robot>${robotId}</robot><reason>${reason}</reason></command>`
    };
  }

  normalizeTelemetry(rawPayload: any, robotConfig: RobotConfig): NormalizedTelemetry {
    // Expected raw FloorBot XML parsed object or XML string:
    // <floorbot><id>R-006</id><bat>88</bat><water>med</water><zone>Z8</zone><state>CLEANING</state><err>0</err></floorbot>
    
    let rawXml = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
    const robotId = this.extractXmlTag(rawXml, 'id') || robotConfig.id;
    const batteryPct = parseInt(this.extractXmlTag(rawXml, 'bat') || '85', 10);
    const waterBucket = (this.extractXmlTag(rawXml, 'water') || 'med').toLowerCase() as CoarseWaterBucket;
    const zoneId = this.extractXmlTag(rawXml, 'zone') || null;
    const rawState = this.extractXmlTag(rawXml, 'state') || 'IDLE';
    const rawErr = this.extractXmlTag(rawXml, 'err') || '0';

    let status = 'idle';
    switch (rawState) {
      case 'CLEANING': status = 'cleaning'; break;
      case 'CHARGING': status = 'charging'; break;
      case 'WATER_SERVICE': status = 'refilling_water'; break;
      case 'TRANSIT': status = 'navigating'; break;
      case 'OFFLINE_JOB': status = 'offline_executing'; break;
      case 'ERROR': status = 'fault'; break;
      default: status = 'idle';
    }

    const telemetry: NormalizedTelemetry = {
      robotId,
      oem: 'FloorBot',
      timestamp: new Date().toISOString(),
      batteryPct,
      waterPct: this.coarseBucketToEstimatedPct(waterBucket),
      coarseWaterLevel: waterBucket,
      waterMinutesEst: this.coarseBucketToMinutesRange(waterBucket),
      position: {
        x: parseFloat(this.extractXmlTag(rawXml, 'pos_x') || '20.0'),
        y: parseFloat(this.extractXmlTag(rawXml, 'pos_y') || '15.0'),
        zoneId,
        uncertaintyMeters: 1.0
      },
      status: status as any,
      errorCode: rawErr !== '0' ? `FB_ERR_${rawErr}` : null,
      rawPayload: rawXml,
      protocolFormat: 'HTTP/XML'
    };

    return this.applyQuirkFilter(telemetry);
  }

  applyQuirkFilter(telemetry: NormalizedTelemetry): NormalizedTelemetry {
    // FloorBot coarse water uncertainty handling:
    // If bucket is "low", nominal remaining is ~20m, but uncertainty range is [10m, 30m].
    // Scheduler must handle this uncertainty range to prevent running dry mid-zone!
    return telemetry;
  }

  translateCommand(command: 'start_mission' | 'pause' | 'resume' | 'return_to_dock' | 'status_query' | 'ota_update', args: any): HALCommandResult {
    // Legacy HTTP CGI GET command endpoint
    const cgiCmd = command === 'start_mission' ? 'START' : command.toUpperCase();
    const url = `http://192.168.10.100/fb/control.cgi?robot=${args.robotId}&action=${cgiCmd}&zone=${args.zoneId || ''}`;

    return {
      success: true,
      message: `HTTP GET 200 OK -> ${url}`,
      nativePayload: { url, method: 'GET', legacy_http: true },
      protocol: 'HTTP/GET'
    };
  }

  private extractXmlTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private coarseBucketToEstimatedPct(bucket: CoarseWaterBucket): number {
    switch (bucket) {
      case 'high': return 90;
      case 'med': return 55;
      case 'low': return 25;
      case 'empty': return 0;
      default: return 50;
    }
  }

  private coarseBucketToMinutesRange(bucket: CoarseWaterBucket): { min: number; nominal: number; max: number } {
    switch (bucket) {
      case 'high': return { min: 60, nominal: 80, max: 90 };
      case 'med': return { min: 30, nominal: 45, max: 60 };
      case 'low': return { min: 10, nominal: 20, max: 30 }; // High uncertainty!
      case 'empty': return { min: 0, nominal: 0, max: 5 };
      default: return { min: 20, nominal: 40, max: 60 };
    }
  }
}
