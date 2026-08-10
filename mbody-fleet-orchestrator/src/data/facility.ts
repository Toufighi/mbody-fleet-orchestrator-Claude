import { ZoneConfig } from '../types';

export const FACILITY_ZONES: ZoneConfig[] = [
  {
    id: 'Z1',
    name: 'Main Lobby',
    sqFt: 4200,
    floorType: 'Hard',
    floorMaterial: 'Standard VCT Vinyl',
    waterMultiplier: 1.0,
    classification: 'High-traffic',
    cleaningWindowStart: '21:00', // 9:00 PM (120 mins from 19:00)
    cleaningWindowEnd: '06:00',   // 6:00 AM (660 mins from 19:00)
    allowedDays: ['daily'],
    requiresSterileRobot: false,
    requiresSecurityEscort: false,
    hasWifi: true
  },
  {
    id: 'Z2',
    name: 'ED Hallways',
    sqFt: 3800,
    floorType: 'Hard',
    floorMaterial: 'High-Gloss Epoxy Tile',
    waterMultiplier: 0.85,
    classification: 'Sterile',
    cleaningWindowStart: '03:00', // 3:00 AM (480 mins from 19:00)
    cleaningWindowEnd: '05:00',   // 5:00 AM (600 mins from 19:00)
    allowedDays: ['daily'],
    requiresSterileRobot: true,
    requiresSecurityEscort: false,
    hasWifi: true
  },
  {
    id: 'Z3',
    name: 'Cafeteria',
    sqFt: 2600,
    floorType: 'Mixed',
    floorMaterial: 'Standard VCT Vinyl',
    waterMultiplier: 1.0,
    classification: 'Standard',
    cleaningWindowStart: '22:00', // 10:00 PM (180 mins from 19:00)
    cleaningWindowEnd: '05:00',   // 5:00 AM (600 mins from 19:00)
    allowedDays: ['daily'],
    requiresSterileRobot: false,
    requiresSecurityEscort: false,
    hasWifi: true
  },
  {
    id: 'Z4',
    name: 'Admin Wing',
    sqFt: 5100,
    floorType: 'Carpet',
    floorMaterial: 'Low-Pile Carpet',
    waterMultiplier: 0.0,
    classification: 'Standard',
    cleaningWindowStart: '19:00', // 7:00 PM (0 mins from 19:00)
    cleaningWindowEnd: '23:00',   // 11:00 PM (240 mins from 19:00)
    allowedDays: ['Mon', 'Wed', 'Fri'], // Not scheduled on Tuesday by default
    requiresSterileRobot: false,
    requiresSecurityEscort: false,
    hasWifi: true
  },
  {
    id: 'Z5',
    name: 'Patient Halls (2F)',
    sqFt: 6400,
    floorType: 'Hard',
    floorMaterial: 'High-Gloss Epoxy Tile',
    waterMultiplier: 0.85,
    classification: 'Sterile',
    cleaningWindowStart: '01:00', // 1:00 AM (360 mins from 19:00)
    cleaningWindowEnd: '05:00',   // 5:00 AM (600 mins from 19:00)
    allowedDays: ['daily'],
    requiresSterileRobot: true,
    requiresSecurityEscort: true, // Requires security escort after 11 PM
    hasWifi: true
  },
  {
    id: 'Z6',
    name: 'Outpatient Wing',
    sqFt: 4800,
    floorType: 'Hard',
    floorMaterial: 'Standard VCT Vinyl',
    waterMultiplier: 1.0,
    classification: 'Standard',
    cleaningWindowStart: '20:00', // 8:00 PM (60 mins from 19:00)
    cleaningWindowEnd: '06:00',   // 6:00 AM (660 mins from 19:00)
    allowedDays: ['daily'],
    requiresSterileRobot: false,
    requiresSecurityEscort: false,
    hasWifi: true
  },
  {
    id: 'Z7',
    name: 'Radiology Suite',
    sqFt: 2200,
    floorType: 'Hard',
    floorMaterial: 'High-Gloss Epoxy Tile',
    waterMultiplier: 0.85,
    classification: 'Sterile',
    cleaningWindowStart: '23:00', // 11:00 PM (240 mins from 19:00)
    cleaningWindowEnd: '04:00',   // 4:00 AM (540 mins from 19:00)
    allowedDays: ['daily'],
    requiresSterileRobot: true,
    requiresSecurityEscort: false,
    hasWifi: true
  },
  {
    id: 'Z8',
    name: 'Parking Garage L1',
    sqFt: 12000,
    floorType: 'Concrete',
    floorMaterial: 'Porous Unsealed Concrete',
    waterMultiplier: 1.4,
    classification: 'Standard',
    cleaningWindowStart: '19:00', // 7:00 PM (0 mins from 19:00)
    cleaningWindowEnd: '07:00',   // 7:00 AM (720 mins from 19:00)
    allowedDays: ['Tue', 'Sat'],  // Scheduled on Tuesday shift!
    requiresSterileRobot: false,
    requiresSecurityEscort: false,
    hasWifi: false               // Offline execution required!
  }
];
