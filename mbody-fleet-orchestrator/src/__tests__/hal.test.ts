import { describe, it, expect } from 'vitest';
import { AutoScrubAdapter } from '../hal/adapters/AutoScrubAdapter';
import { CleanPathAdapter } from '../hal/adapters/CleanPathAdapter';
import { FloorBotAdapter } from '../hal/adapters/FloorBotAdapter';
import { CyberCleanAdapter } from '../hal/adapters/CyberCleanAdapter';
import { HALRegistry } from '../hal/HALRegistry';
import { FLEET_ROSTER } from '../data/roster';

describe('Hardware Abstraction Layer (HAL) & OEM Adapters', () => {
  const r1Config = FLEET_ROSTER.find(r => r.id === 'R-001')!;
  const r4Config = FLEET_ROSTER.find(r => r.id === 'R-004')!;
  const r5Config = FLEET_ROSTER.find(r => r.id === 'R-005')!;
  const r6Config = FLEET_ROSTER.find(r => r.id === 'R-006')!;

  it('AutoScrubAdapter should normalize MQTT/JSON telemetry and apply 3-sample GPS drift smoothing', () => {
    const adapter = new AutoScrubAdapter();
    const rawPayload = {
      device_id: 'R-001',
      bat_lvl: 85,
      h2o_lvl: 90,
      pos_x: 10.5,
      pos_y: 20.2,
      status_code: 'SCRUBBING',
      active_zone: 'Z1',
      err: null
    };

    // Feed samples to smooth GPS position
    adapter.normalizeTelemetry({ ...rawPayload, pos_x: 10.0, pos_y: 20.0 }, r1Config);
    adapter.normalizeTelemetry({ ...rawPayload, pos_x: 11.0, pos_y: 21.0 }, r1Config);
    const normalized = adapter.normalizeTelemetry(rawPayload, r1Config);

    expect(normalized.oem).toBe('AutoScrub');
    expect(normalized.protocolFormat).toBe('MQTT/JSON');
    expect(normalized.batteryPct).toBe(85);
    expect(normalized.waterPct).toBe(90);
    expect(normalized.position.uncertaintyMeters).toBe(0.5); // Uncertainty reduced after 3-sample smoothing
    expect(normalized.position.x).toBeCloseTo(10.5, 1);
  });

  it('CleanPathAdapter should normalize WebSocket/Protobuf and handle dry cleaning (null water)', () => {
    const adapter = new CleanPathAdapter();
    const rawPayload = {
      robot_uuid: 'R-004',
      battery_ratio: 0.95,
      pos_m: { x: 14.2, y: 8.7 },
      status_enum: 2,
      zone_code: 'Z4'
    };

    const normalized = adapter.normalizeTelemetry(rawPayload, r4Config);

    expect(normalized.oem).toBe('CleanPath');
    expect(normalized.protocolFormat).toBe('WebSocket/Protobuf');
    expect(normalized.batteryPct).toBe(95);
    expect(normalized.waterPct).toBeNull(); // Dry vacuum robot
    expect(normalized.coarseWaterLevel).toBeNull();
  });

  it('CleanPathAdapter should execute 15-second grace period for WebSocket floor transitions', () => {
    const adapter = new CleanPathAdapter();
    const disconnectPayload = {
      robot_uuid: 'R-005',
      battery_ratio: 0.8,
      status_enum: 5, // disconnected
      zone_code: 'Z6'
    };

    // First normalization during disconnection (< 20 sec)
    const normalized = adapter.normalizeTelemetry(disconnectPayload, r5Config);

    expect(normalized.status).toBe('navigating'); // Treated as in transit during grace period
    expect(normalized.errorCode).toBe('WARN_WS_FLOOR_TRANSITION_RECONNECTING');
  });

  it('FloorBotAdapter should normalize HTTP/XML polling and translate coarse water buckets with uncertainty', () => {
    const adapter = new FloorBotAdapter();
    const rawXml = `<floorbot><id>R-006</id><bat>78</bat><water>low</water><zone>Z1</zone><state>CLEANING</state><err>0</err></floorbot>`;

    const normalized = adapter.normalizeTelemetry(rawXml, r6Config);

    expect(normalized.oem).toBe('FloorBot');
    expect(normalized.protocolFormat).toBe('HTTP/XML');
    expect(normalized.batteryPct).toBe(78);
    expect(normalized.coarseWaterLevel).toBe('low');
    expect(normalized.waterMinutesEst?.nominal).toBe(20);
    expect(normalized.waterMinutesEst?.min).toBe(10);
    expect(normalized.waterMinutesEst?.max).toBe(30);
  });

  it('CyberCleanAdapter (4th OEM Proof) should seamlessly plug into HAL Registry without core changes', () => {
    const registry = new HALRegistry();
    const cyberAdapter = new CyberCleanAdapter();
    registry.registerAdapter(cyberAdapter);

    const rawPayload = {
      id: 'CC-1000',
      battery_level: 92,
      fluid_level: 88,
      zone: 'Z1',
      state: 'CLEANING'
    };

    const mockCyberConfig = {
      id: 'CC-1000',
      name: 'CyberClean Pro',
      oem: 'CyberClean' as const,
      model: 'CC-1000',
      batteryCapacityHours: 6,
      waterTankHours: 4,
      hasWaterTank: true,
      hasUVSanitizer: false,
      isSterileCertified: false,
      coverageSqFtHr: 12000,
      protocol: 'REST/JSON' as const,
      capabilities: ['scrub' as const, 'vacuum' as const],
      quirkDescription: 'CyberClean proprietary REST API'
    };

    const normalized = registry.normalizeTelemetry(rawPayload, mockCyberConfig as any);

    expect(normalized).toBeDefined();
    expect(normalized.oem).toBe('CyberClean');
    expect(normalized.batteryPct).toBe(92);
    expect(normalized.waterPct).toBe(88);
  });
});
