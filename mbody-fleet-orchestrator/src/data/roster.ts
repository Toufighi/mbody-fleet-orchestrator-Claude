import { RobotConfig } from '../types';

export const FLEET_ROSTER: RobotConfig[] = [
  {
    id: 'R-001',
    oem: 'AutoScrub',
    model: 'AS-900',
    coverageSqFtHr: 8000,
    batteryCapacityHours: 4.0,
    waterTankHours: 1.5,
    capabilities: ['Hard floor scrub', 'Auto-docking'],
    isSterileCertified: false,
    hasWaterTank: true,
    quirkDescription: 'Indoor GPS drift ±2m in wide areas'
  },
  {
    id: 'R-002',
    oem: 'AutoScrub',
    model: 'AS-900',
    coverageSqFtHr: 8000,
    batteryCapacityHours: 4.0,
    waterTankHours: 1.5,
    capabilities: ['Hard floor scrub', 'Auto-docking'],
    isSterileCertified: false,
    hasWaterTank: true,
    quirkDescription: 'Indoor GPS drift ±2m in wide areas'
  },
  {
    id: 'R-003',
    oem: 'AutoScrub',
    model: 'AS-900H',
    coverageSqFtHr: 4500,
    batteryCapacityHours: 3.0,
    waterTankHours: 1.5,
    capabilities: ['Healthcare-grade scrub', 'Sterile-certified', 'UV-C sanitizer'],
    isSterileCertified: true,
    hasWaterTank: true,
    quirkDescription: 'Requires 15-min sanitization cycle when moving sterile<->non-sterile'
  },
  {
    id: 'R-004',
    oem: 'CleanPath',
    model: 'CP-V2',
    coverageSqFtHr: 5000,
    batteryCapacityHours: 3.5,
    waterTankHours: null,
    capabilities: ['Carpet vacuum (dry only)', 'High-efficiency particulate filtration'],
    isSterileCertified: false,
    hasWaterTank: false,
    quirkDescription: 'Drops WebSocket on floor transitions (~15s auto-reconnect)'
  },
  {
    id: 'R-005',
    oem: 'CleanPath',
    model: 'CP-X1',
    coverageSqFtHr: 6000,
    batteryCapacityHours: 3.0,
    waterTankHours: null,
    capabilities: ['Multi-surface (dry only)', 'Dry mops & vacuums'],
    isSterileCertified: false,
    hasWaterTank: false,
    quirkDescription: 'Drops WebSocket on floor transitions (~15s auto-reconnect)'
  },
  {
    id: 'R-006',
    oem: 'FloorBot',
    model: 'FB-200',
    coverageSqFtHr: 7000,
    batteryCapacityHours: 3.5,
    waterTankHours: 1.5,
    capabilities: ['Hard floor scrub', 'Legacy HTTP Polling'],
    isSterileCertified: false,
    hasWaterTank: true,
    quirkDescription: 'Water reporting is coarse (High/Med/Low/Empty). Polls every 60s'
  },
  {
    id: 'R-007',
    oem: 'CleanPath',
    model: 'CP-X1',
    coverageSqFtHr: 6000,
    batteryCapacityHours: 3.0,
    waterTankHours: null,
    capabilities: ['Multi-surface (dry only)', 'Dry mops & vacuums'],
    isSterileCertified: false,
    hasWaterTank: false,
    quirkDescription: 'Drops WebSocket on floor transitions (~15s auto-reconnect)'
  },
  {
    id: 'R-008',
    oem: 'FloorBot',
    model: 'FB-200',
    coverageSqFtHr: 7000,
    batteryCapacityHours: 3.5,
    waterTankHours: 1.5,
    capabilities: ['Hard floor scrub', 'Legacy HTTP Polling'],
    isSterileCertified: false,
    hasWaterTank: true,
    quirkDescription: 'Water reporting is coarse (High/Med/Low/Empty). Anomaly prone'
  }
];
