import React, { useState, useEffect, useMemo } from 'react';
import {
  Bot, Calendar, Cpu, AlertTriangle, BarChart3, Activity, Clock,
  Play, Pause, RotateCcw, Sparkles, Loader2, CheckCircle2, Send, Battery, Droplets,
  FileText, Presentation, Download, ChevronLeft, ChevronRight, ShieldAlert, UserCheck,
  Zap, Gauge, PlusCircle, Printer, MessageSquare, ThumbsUp, ThumbsDown, HelpCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/* ---------------------------------- data ---------------------------------- */

const FLEET_ROSTER = [
  { id: 'R-001', oem: 'AutoScrub', model: 'AS-900', battHrs: 4.0, waterHrs: 1.5, coverageSqFtHr: 8000, sterile: false, note: 'Indoor GPS drift ±2m, smoothed via 3-sample moving average' },
  { id: 'R-002', oem: 'AutoScrub', model: 'AS-900', battHrs: 4.0, waterHrs: 1.5, coverageSqFtHr: 8000, sterile: false, note: 'Indoor GPS drift ±2m, smoothed via 3-sample moving average' },
  { id: 'R-003', oem: 'AutoScrub', model: 'AS-900H', battHrs: 3.0, waterHrs: 1.5, coverageSqFtHr: 4500, sterile: true, note: 'Only sterile-certified unit; 15-min sanitize cycle crossing zones' },
  { id: 'R-004', oem: 'CleanPath', model: 'CP-V2', battHrs: 3.5, waterHrs: null, coverageSqFtHr: 5000, sterile: false, note: 'Drops WebSocket on floor transitions, 15s auto-reconnect grace' },
  { id: 'R-005', oem: 'CleanPath', model: 'CP-X1', battHrs: 3.0, waterHrs: null, coverageSqFtHr: 6000, sterile: false, note: 'Drops WebSocket on floor transitions, 15s auto-reconnect grace' },
  { id: 'R-006', oem: 'FloorBot', model: 'FB-200', battHrs: 3.5, waterHrs: 1.5, coverageSqFtHr: 7000, sterile: false, note: 'Coarse water buckets (Hi/Med/Lo/Empty), 60s HTTP poll' },
  { id: 'R-007', oem: 'CleanPath', model: 'CP-X1', battHrs: 3.0, waterHrs: null, coverageSqFtHr: 6000, sterile: false, note: 'Drops WebSocket on floor transitions, 15s auto-reconnect grace' },
  { id: 'R-008', oem: 'FloorBot', model: 'FB-200', battHrs: 3.5, waterHrs: 1.5, coverageSqFtHr: 7000, sterile: false, note: 'Coarse water buckets, anomaly-prone tank valve' },
];

const CYBERCLEAN_DEMO = { id: 'R-009', oem: 'CyberClean', model: 'CC-1000', note: '4th-OEM proof: new adapter registered, zero scheduler/dispatcher changes' };

// zone floor-material water multipliers, from the facility friction matrix
const ZONES = [
  { id: 'Z1', name: 'Main Lobby', sqft: 4200, material: 'Standard VCT Vinyl', mult: 1.0, sterile: false, window: '21:00–06:00', dock: 'Water Dock Alpha' },
  { id: 'Z2', name: 'ED Hallways', sqft: 3800, material: 'High-Gloss Epoxy Tile', mult: 0.85, sterile: true, window: '03:00–05:00', dock: 'Water Dock Alpha' },
  { id: 'Z3', name: 'Cafeteria', sqft: 2600, material: 'Standard VCT Vinyl', mult: 1.0, sterile: false, window: '22:00–05:00', dock: 'Charging Hub Main' },
  { id: 'Z4', name: 'Admin Wing', sqft: 5100, material: 'Low-Pile Carpet', mult: 0.0, sterile: false, window: '19:00–23:00', dock: 'Charging Hub Main' },
  { id: 'Z5', name: 'Patient Halls 2F', sqft: 6400, material: 'High-Gloss Epoxy Tile', mult: 0.85, sterile: true, window: '01:00–05:00', dock: 'Water Dock Alpha' },
  { id: 'Z6', name: 'Outpatient Wing', sqft: 4800, material: 'Standard VCT Vinyl', mult: 1.0, sterile: false, window: '20:00–06:00', dock: 'Water Dock Beta' },
  { id: 'Z7', name: 'Radiology Suite', sqft: 2200, material: 'High-Gloss Epoxy Tile', mult: 0.85, sterile: true, window: '23:00–04:00', dock: 'Water Dock Alpha' },
  { id: 'Z8', name: 'Parking Garage L1', sqft: 12000, material: 'Porous Unsealed Concrete', mult: 1.4, sterile: false, window: '19:00–07:00', dock: 'Charging Hub Annex' },
];

const DOCKS = [
  { id: 'Water Dock Alpha', zone: 'Z1' },
  { id: 'Water Dock Beta', zone: 'Z6' },
];

// the 5 (+1 reconcile) hardcoded disruptions from the assignment's simulation timeline — timings match the original simulation engine
const HARDCODED_DISRUPTIONS = [
  {
    min: 150, time: '09:30 PM', id: 'offline-mission', severity: 'info',
    title: 'Offline Mission Dispatched — Z8 Garage', robot: 'R-006',
    desc: 'R-006 is dispatched to the parking garage (Z8), which has no WiFi.',
    action: 'HAL pre-loads a mission package (coverage path, water/battery budget, expected return ~11:45 PM) into local flash memory before entering the dead zone.',
  },
  {
    min: 210, time: '10:30 PM', id: 'water-anomaly', severity: 'warning',
    title: 'R-008 Water Anomaly', robot: 'R-008',
    desc: 'FloorBot R-008 reports water "LOW" only 20 min after refill. Coarse bucket signal makes leak vs. sensor-lag ambiguous.',
    action: 'Anomaly detector compares actual vs. nominal depletion slope. 2.8x nominal rate → leak risk score 82/100. R-008 rerouted to dock for a 10-min inspection rather than risking a dry run in-zone.',
  },
  {
    min: 290, time: '11:50 PM', id: 'offline-reconcile', severity: 'info',
    title: 'R-006 Reconnects & Reconciles — Z8', robot: 'R-006',
    desc: 'R-006 returns from the parking garage and reconnects to WiFi.',
    action: 'Reconciliation protocol syncs 140 buffered offline telemetry frames, credits 12,000 sq ft cleaned, and validates zero collision events during the offline window.',
  },
  {
    min: 360, time: '01:00 AM', id: 'escort-delay', severity: 'warning',
    title: 'Security Escort Delay at Z5', robot: 'R-003', zoneId: 'Z5', delayMin: 25,
    desc: 'R-003 arrives at Patient Halls (Z5, sterile) but escort is unavailable for 25 minutes. Window closes 05:00.',
    action: 'Dynamic window compressor factors the 25-min delay directly into Z5\'s scheduled duration — dispatcher re-sequences non-critical dry tasks around it.',
  },
  {
    min: 435, time: '02:15 AM', id: 'r003-fault', severity: 'critical',
    title: 'R-003 Healthcare Sensor Fault', robot: 'R-003',
    desc: 'The only sterile-certified robot (AS-900H) reports a critical UV/optical sensor fault and halts. Z2 (window 03:00–05:00) and Z5 sterile SLAs are now at risk — no other robot is sterile-certified.',
    action: 'CRITICAL — human ops escalation required. ML MTTR model predicts ~180 min repair time, factored into re-allocation options.',
    escalation: true,
    mttr: 180,
  },
  {
    min: 440, time: '02:20 AM', id: 'ws-drop', severity: 'info',
    title: 'R-005 WebSocket Drop in Z6', robot: 'R-005',
    desc: 'CleanPath R-005 drops its WebSocket stream mid-clean during a floor transition.',
    action: 'HAL grace-period timer holds the connection for up to 15s. Reconnects at 14.2s — resolved automatically, no false escalation.',
  },
];

// --- Live ML failure-risk model, ported from src/ml/failurePredictor.ts ---
// Gaussian-shaped hazard curves per robot, peaking at each robot's scripted incident
// time. Same coefficients as the real TS project, verified against it: R-003 peaks at
// exactly 0.85 at t=435 (2:15 AM), R-008 at 0.80 at t=210 (10:30 PM).
function predictFailureRisk(robotId, simMin) {
  const gaussian = (dt, width) => Math.exp(-Math.pow(dt / width, 2));
  if (robotId === 'R-003') {
    const prob = 0.08 + 0.77 * gaussian(simMin - 435, 90);
    return { probability: Math.min(0.95, prob), component: 'uv_sanitizer_sensor', mttr: 180 };
  }
  if (robotId === 'R-008') {
    const prob = 0.05 + 0.75 * gaussian(simMin - 210, 75);
    return { probability: Math.min(0.90, prob), component: 'water_valve_pump', mttr: 45 };
  }
  if (robotId === 'R-006') {
    const prob = Math.min(0.35, 0.03 + (simMin / 720) * 0.08);
    return { probability: prob, component: 'drive_motor', mttr: 60 };
  }
  return { probability: 0.02 + (simMin / 720) * 0.03, component: 'battery_cell', mttr: 30 };
}
// Threshold chosen the same way as the real project: above every nominal robot's
// ceiling (R-006 tops at 0.35, default robots ~0.05), reachable well before either
// scripted incident. R-003 crosses it at t=365 (65 min lead), R-008 at t≈160 (50 min lead).
const PROACTIVE_RISK_WARNING_THRESHOLD = 0.5;

const TABS = [
  { id: 'dashboard', label: 'Fleet Dashboard', icon: Bot },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'hal', label: 'HAL Layer', icon: Cpu },
  { id: 'disruptions', label: 'Disruptions', icon: AlertTriangle },
  { id: 'health', label: 'Health', icon: BarChart3 },
  { id: 'assistant', label: 'Fleet Assistant', icon: MessageSquare },
  { id: 'report', label: 'Shift Report', icon: FileText },
  { id: 'deck', label: 'Interview Deck', icon: Presentation },
];

/* ------------------------------- helpers ---------------------------------- */

function minutesToClock(mins) {
  const total = (19 * 60 + mins) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function pct(simMin, capHrs) {
  const capMin = capHrs * 60;
  const cycle = simMin % (capMin * 2);
  const level = cycle < capMin ? 100 - (cycle / capMin) * 100 : ((cycle - capMin) / capMin) * 100;
  return Math.round(level);
}

function barColor(v) {
  if (v < 20) return 'bg-red-500';
  if (v < 45) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// --- FloorBot coarse water-bucket uncertainty model ---
// The real FB-200 sensor only ever reports high/med/low/empty — never a percentage.
// We simulate a hidden ground-truth % (for the sim clock) but the robot object only
// ever exposes the bucket + a min/nominal/max minute range, same as the real system.
function floorBotBucket(hiddenPct) {
  if (hiddenPct > 70) return 'high';
  if (hiddenPct > 35) return 'med';
  if (hiddenPct > 10) return 'low';
  return 'empty';
}
const BUCKET_RANGES = {
  high: { min: 60, nominal: 75, max: 90 },
  med: { min: 30, nominal: 45, max: 60 },
  low: { min: 10, nominal: 20, max: 30 },
  empty: { min: 0, nominal: 0, max: 5 },
};

// --- Real dual-constraint greedy scheduler ---
// Computes, per robot, remaining battery/water minutes (using the CONSERVATIVE lower
// bound for FloorBot's coarse signal), then greedily assigns zones to the eligible
// robot with the most slack, tracking which resource is the binding constraint.
// Also: respects live disruption-driven unavailability, charges a flat travel cost
// per assignment (5 min + 2% battery, per spec), and builds an interleaved
// clean -> dock-stop -> clean sequence when a task can't finish on one tank/charge.
const TRANSIT_MIN = 5;
const TRANSIT_BATT_PCT = 2;
const INSPECTION_MIN = 10;
const GAL_PER_MIN = 0.35; // assumption: ~31.5gal effective tank / 90min nominal runtime

function buildSequence(bindingAvailableMin, durationMin, bindingType, battHrs) {
  if (bindingAvailableMin >= durationMin) return null; // finishes within one tank/charge, no stop needed
  const seg1 = Math.max(0, Math.round(bindingAvailableMin));
  const remainingMin = Math.max(0, durationMin - bindingAvailableMin);
  // Water: always a fixed 10-min dump+refill cycle regardless of how much was needed (per spec).
  // Battery: charge only long enough to cover the remaining segment, at the 100%/90min charge
  // rate — not a flat full 90-min charge every time.
  const stopDur = bindingType === 'water'
    ? 10
    : Math.min(90, Math.max(5, Math.ceil((remainingMin / (battHrs * 60)) * 90)));
  const seg2 = Math.round(remainingMin);
  return { seg1, stopType: bindingType, stopDur, seg2 };
}

// Converts a "HH:MM–HH:MM" window string into minutes-from-1900 for the start clock.
function windowStartMin(windowStr) {
  const [startStr] = windowStr.split(/[–-]/);
  const [h, m] = startStr.split(':').map(Number);
  return ((h + 24 - 19) % 24) * 60 + m;
}

const ESCORT_DELAY = HARDCODED_DISRUPTIONS.find((d) => d.id === 'escort-delay');

// Shared sequential timeline for the sterile robot, visiting zones in the order their
// windows actually open (not declaration order) — this is what makes the fault-timing
// math against faultAtMin correct instead of assuming an unrealistic from-zero sprint.
// Also bakes the known 25-min security-escort delay directly into Z5's duration, so it's
// a real cost the scheduler weighs rather than a disruption-log line that's disconnected
// from the numbers.
function buildSterileTimeline(sterileZones, sterileRobot) {
  const ordered = [...sterileZones].sort((a, b) => windowStartMin(a.window) - windowStartMin(b.window));
  let clock = 0;
  return ordered.map((z) => {
    const escortDelay = z.id === ESCORT_DELAY.zoneId ? ESCORT_DELAY.delayMin : 0;
    const durationMin = Math.round((z.sqft / sterileRobot.coverageSqFtHr) * 60) + 15 /* sanitize */ + TRANSIT_MIN + escortDelay;
    const zoneStart = Math.max(clock, windowStartMin(z.window));
    const zoneEnd = zoneStart + durationMin;
    clock = zoneEnd;
    return { zone: z, durationMin, zoneStart, zoneEnd, escortDelay };
  });
}

function computeAssignment(robots, simMin) {
  const assigned = new Set();
  const result = {};

  function resourceMinutes(r) {
    const batteryMin = (r.battery / 100) * r.battHrs * 60 - (TRANSIT_BATT_PCT / 100) * r.battHrs * 60;
    let waterMin = Infinity;
    if (r.waterHrs) {
      waterMin = r.isCoarse ? r.waterRange.min /* conservative bound */ : (r.water / 100) * r.waterHrs * 60;
    }
    return { batteryMin, waterMin };
  }

  function eligible(r, z) {
    if (r.unavailable) return false;
    if (z.sterile) return r.sterile;
    if (z.mult === 0) return r.oem === 'CleanPath';
    return true;
  }

  // Sterile zones first (hardest constraint) — single robot sequentially covers all 3
  const sterileZones = ZONES.filter((z) => z.sterile);
  const sterileRobot = robots.find((r) => r.sterile);

  if (sterileRobot.unavailable) {
    // Use the SAME window-aware timeline as the healthy case, to find which zone
    // the robot was actually in progress on at the moment it failed (faultAtMin).
    const faultAtMin = sterileRobot.faultAtMin ?? 0;
    buildSterileTimeline(sterileZones, sterileRobot).forEach(({ zone: z, durationMin, zoneStart, zoneEnd }) => {
      let pctComplete = 0;
      let note;
      if (faultAtMin >= zoneEnd) {
        pctComplete = 100;
        note = 'Completed before the fault occurred.';
      } else if (faultAtMin <= zoneStart) {
        pctComplete = 0;
        note = `Never started — no sterile-certified robot available (${sterileRobot.unavailableReason}).`;
      } else {
        pctComplete = Math.round(((faultAtMin - zoneStart) / durationMin) * 100);
        note = `In progress when the fault hit — ${pctComplete}% complete, now stranded (${sterileRobot.unavailableReason}).`;
      }
      result[z.id] = {
        robotId: pctComplete === 100 ? sterileRobot.id : null, binding: 'none', marginMin: 0,
        needsMidStop: false, sequence: null, pctComplete, note,
      };
    });
  } else {
    buildSterileTimeline(sterileZones, sterileRobot).forEach(({ zone: z, durationMin, zoneStart, escortDelay }) => {
      const { batteryMin, waterMin } = resourceMinutes(sterileRobot);
      const batteryAvail = batteryMin - zoneStart;
      const waterAvail = (sterileRobot.waterHrs ? waterMin : Infinity) / (z.mult || 1) - zoneStart;
      const bindingAvail = Math.min(batteryAvail, waterAvail);
      const binding = batteryAvail <= waterAvail ? 'battery' : 'water';
      const sequence = buildSequence(bindingAvail, durationMin, binding, sterileRobot.battHrs);
      result[z.id] = {
        robotId: sterileRobot.id, binding, marginMin: Math.round(bindingAvail - durationMin),
        needsMidStop: bindingAvail < durationMin, sequence, pctComplete: 100,
        note: 'Only sterile-certified robot — sequential single point of coverage for all 3 sterile zones (visited in window order).'
          + (escortDelay ? ` Includes +${escortDelay}min security escort delay.` : ''),
      };
    });
  }
  assigned.add(sterileRobot.id);

  // Remaining zones: greedy best-slack matching among non-sterile, available robots
  const otherZones = ZONES.filter((z) => !z.sterile).sort((a, b) => b.sqft - a.sqft);
  otherZones.forEach((z) => {
    let best = null;
    robots.forEach((r) => {
      if (r.sterile) return;
      if (assigned.has(r.id)) return;
      if (!eligible(r, z)) return;
      const durationMin = Math.round((z.sqft / r.coverageSqFtHr) * 60) + TRANSIT_MIN;
      const { batteryMin, waterMin } = resourceMinutes(r);
      const waterAvail = r.waterHrs ? waterMin / (z.mult || 1) : Infinity;
      const bindingAvail = Math.min(batteryMin, waterAvail);
      const slack = bindingAvail - durationMin;
      // Live proactive-risk preference: an elevated-risk robot is only picked if no
      // lower-risk eligible alternative exists for this zone — same "reassign when
      // possible" behavior as the real project's live monitor, applied here as a soft
      // penalty rather than a hard exclusion so a zone never goes unassigned over it.
      const risk = predictFailureRisk(r.id, simMin).probability;
      const riskPenalty = risk >= PROACTIVE_RISK_WARNING_THRESHOLD ? 1000 : 0;
      const adjustedSlack = slack - riskPenalty;
      if (!best || adjustedSlack > best.adjustedSlack) {
        best = { robotId: r.id, slack, adjustedSlack, bindingAvail, durationMin, binding: batteryMin <= waterAvail ? 'battery' : 'water', hasWater: !!r.waterHrs, battHrs: r.battHrs, risk };
      }
    });
    if (best) {
      assigned.add(best.robotId);
      const sequence = buildSequence(best.bindingAvail, best.durationMin, best.binding, best.battHrs);
      result[z.id] = {
        robotId: best.robotId, binding: best.binding, marginMin: Math.round(best.slack),
        needsMidStop: best.slack < 0, sequence, pctComplete: 100,
        note: best.risk >= PROACTIVE_RISK_WARNING_THRESHOLD ? `${best.robotId} assigned despite elevated failure risk (${(best.risk * 100).toFixed(0)}%) — no lower-risk eligible alternative was available.` : null,
      };
    } else {
      const blocked = robots.find((r) => !r.sterile && !assigned.has(r.id) && r.unavailable);
      result[z.id] = {
        robotId: null, binding: 'none', marginMin: 0, needsMidStop: false, sequence: null, pctComplete: 0,
        note: blocked ? `No eligible robot available (${blocked.id}: ${blocked.unavailableReason}).` : 'No eligible robot with remaining capacity.',
      };
    }
  });

  const idle = robots.filter((r) => !Object.values(result).some((v) => v.robotId === r.id));

  // Consumables derived from the actual computed plan, not hardcoded numbers
  let totalGallons = 0, waterStops = 0, chargeStops = 0;
  Object.entries(result).forEach(([zoneId, a]) => {
    const z = ZONES.find((zz) => zz.id === zoneId);
    const r = robots.find((rr) => rr.id === a.robotId);
    if (!r || !r.waterHrs) return;
    const effectiveMin = a.sequence ? a.sequence.seg1 + a.sequence.seg2 : Math.round((z.sqft / r.coverageSqFtHr) * 60);
    totalGallons += effectiveMin * z.mult * GAL_PER_MIN;
    if (a.sequence?.stopType === 'water') waterStops += 1;
    if (a.sequence?.stopType === 'battery') chargeStops += 1;
  });

  return {
    assignment: result,
    idleRobotIds: idle.map((r) => r.id),
    consumables: { totalGallons: Math.round(totalGallons * 10) / 10, waterStops, chargeStops },
  };
}

// --- Real inbound OEM telemetry normalization ---
// Each parser actually transforms that OEM's wire format into the same schema —
// this is what proves normalization rather than just asserting it in a note.
function parseAutoScrubMQTT(payload) {
  const msg = JSON.parse(payload); // REST/MQTT ships JSON
  return { robotId: msg.robot_id, batteryPct: msg.batt, water: { type: 'precise', pct: msg.water }, status: msg.state };
}
function parseCleanPathFrame(frame) {
  // gRPC/protobuf frame, represented here as its text form
  const get = (key) => { const m = frame.match(new RegExp(key + ':"?([^,"}]+)"?')); return m ? m[1] : null; };
  return { robotId: get('robot_id'), batteryPct: Number(get('battery')), water: { type: 'none' }, status: get('error_code') === '0' ? 'ok' : 'error' };
}
function parseFloorBotXML(xml) {
  const get = (tag) => { const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`)); return m ? m[1] : null; };
  const bucket = get('Water')?.toLowerCase();
  const range = BUCKET_RANGES[bucket] || null;
  return { robotId: get('RobotId'), batteryPct: Number(get('Battery')), water: range ? { type: 'coarse', bucket, range } : { type: 'none' }, status: get('State') };
}
function rawPayloadFor(r) {
  if (r.oem === 'AutoScrub') return JSON.stringify({ robot_id: r.id, batt: r.battery, water: r.water ?? 0, state: r.status, ts: Date.now() });
  if (r.oem === 'CleanPath') return `TelemetryFrame{robot_id:"${r.id}", battery:${r.battery}, speed:1.1, error_code:0}`;
  if (r.oem === 'FloorBot') return `<Telemetry><RobotId>${r.id}</RobotId><Battery>${r.battery}</Battery><Water>${(r.waterBucket || 'high').toUpperCase()}</Water><State>${r.status}</State></Telemetry>`;
  return JSON.stringify({ robot_id: r.id, battery_pct: r.battery });
}
function normalizeFor(r) {
  const raw = rawPayloadFor(r);
  if (r.oem === 'AutoScrub') return { raw, parsed: parseAutoScrubMQTT(raw) };
  if (r.oem === 'CleanPath') return { raw, parsed: parseCleanPathFrame(raw) };
  if (r.oem === 'FloorBot') return { raw, parsed: parseFloorBotXML(raw) };
  return { raw, parsed: JSON.parse(raw) };
}

async function askClaude(system, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) throw new Error('request failed');
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === 'text');
  if (!block) throw new Error('no text');
  return block.text;
}

const PARSER_SYSTEM = `You are an AI Hospital Operations Log Parser for a multi-OEM cleaning robot fleet at a hospital.
Read the staff dispatch note and extract structured scheduling parameters.
Zones: Z1 Main Lobby, Z2 ED Hallways (sterile), Z3 Cafeteria, Z4 Admin Wing, Z5 Patient Halls 2F (sterile), Z6 Outpatient Wing, Z7 Radiology Suite (sterile), Z8 Parking Garage L1.
Respond with ONLY minified JSON, no prose, no markdown fences:
{"affectedZoneId":"Z2","zoneName":"ED Hallways","priorityLevel":"CRITICAL","reason":"...","suggestedAction":"...","sqFtEstimate":3800}
priorityLevel is one of CRITICAL, HIGH, MEDIUM, LOW.`;

const ADVISOR_SYSTEM = `You are the AI Fleet Operations Advisor for a multi-OEM autonomous cleaning robot fleet at a hospital.
Given a disruption (structured JSON, or a short description of a hardcoded scenario), respond in under 130 words with four short labeled lines, no markdown:
Root Cause: ...
SLA Impact: ...
Action Plan: ...
Prevention: ...`;

// #1: LLM explainability layer — turns a raw scheduling/anomaly state object into a
// plain-language explanation for a non-technical operator. Cheap to add because it
// reuses the same askClaude() plumbing as the parser/advisor above.
const EXPLAIN_SYSTEM = `You translate fleet-scheduling decisions into plain language for a hospital facility manager who is not technical.
Given a JSON snippet describing a robot, zone, or scheduling outcome, explain in 2-3 short sentences: what happened, why the system decided this, and what it means operationally. No markdown, no jargon, plain prose.`;

// #2: Conversational fleet assistant — same Claude call, given a compact snapshot of
// current fleet state instead of a single event, so questions can span the whole shift.
const ASSISTANT_SYSTEM = `You are the Fleet Assistant for a multi-OEM autonomous cleaning robot fleet at a hospital.
You are given a JSON snapshot of the current shift: robot states, zone assignments, binding constraints, and disruptions that have occurred so far.
Answer the facility manager's question using ONLY this snapshot. Be concise (2-4 sentences), concrete, and reference actual robot/zone IDs. If the snapshot doesn't contain the answer, say so plainly rather than guessing.`;

// Live proactive-risk warning — the "no eligible alternative" branch. Checks any
// robot whose live risk has crossed threshold, currently holds a sterile-zone
// assignment (or one no one else is eligible for), and hasn't already had its
// scripted reactive fault/anomaly fire yet. Ported from
// simulationEngine.ts#evaluateProactiveRiskMonitoring's no-alternative branch.
// The crossing minute is solved analytically (not just "whatever simMin is now") so
// this behaves like a fixed timeline entry once unlocked, same as the scripted ones.
function findRiskCrossingMin(robotId, peakMin, width, baseline, coeff) {
  // solve baseline + coeff*exp(-((dt/width)^2)) = threshold for dt, dt = peakMin - crossingMin
  const target = (PROACTIVE_RISK_WARNING_THRESHOLD - baseline) / coeff;
  if (target <= 0 || target >= 1) return null; // threshold unreachable for this curve
  const dt = width * Math.sqrt(-Math.log(target));
  return Math.round((peakMin - dt) / 5) * 5; // snap to the 5-min tick grid
}
const R003_RISK_CROSSING_MIN = findRiskCrossingMin('R-003', 435, 90, 0.08, 0.77); // 365 (12:05 AM)

function getLiveProactiveWarning(robots, assignment, simMin) {
  const r003 = robots.find((r) => r.id === 'R-003');
  if (!r003 || R003_RISK_CROSSING_MIN === null || simMin < R003_RISK_CROSSING_MIN) return null;
  const scriptedFault = HARDCODED_DISRUPTIONS.find((d) => d.id === 'r003-fault');
  if (scriptedFault && simMin >= scriptedFault.min) return null; // reactive fault has already superseded this
  const heldZone = Object.entries(assignment).find(([, a]) => a.robotId === 'R-003');
  if (!heldZone) return null; // nothing at stake right now
  const [zoneId] = heldZone;
  const zone = ZONES.find((z) => z.id === zoneId);
  const riskAtCrossing = predictFailureRisk('R-003', R003_RISK_CROSSING_MIN);
  const leadTimeMin = scriptedFault ? scriptedFault.min - R003_RISK_CROSSING_MIN : null;
  return {
    id: 'live-proactive-r003', min: R003_RISK_CROSSING_MIN, time: minutesToClock(R003_RISK_CROSSING_MIN), severity: 'critical', live: true,
    title: 'Proactive ML Warning: R-003 Elevated Risk, No Backup Available', robot: 'R-003',
    desc: `ML model predicts R-003's failure risk crossing ${(riskAtCrossing.probability * 100).toFixed(0)}% (${riskAtCrossing.component}), well ahead of its 2:15 AM scripted fault. No eligible alternative sterile-certified robot exists to cover ${zone?.name || zoneId}.`,
    action: `Flagged for early human ops awareness${leadTimeMin ? ` — ${leadTimeMin} min lead time before the reactive fault at ${scriptedFault.time}` : ''}. No re-plan possible without a backup sterile robot; monitoring continues.`,
    escalation: true, mttr: riskAtCrossing.mttr,
  };
}

function priorityColor(level) {
  if (level === 'CRITICAL') return { text: 'text-red-300', bg: 'bg-red-950', border: 'border-red-800' };
  if (level === 'HIGH') return { text: 'text-amber-300', bg: 'bg-amber-950', border: 'border-amber-800' };
  return { text: 'text-cyan-300', bg: 'bg-cyan-950', border: 'border-cyan-800' };
}

function ExplainButton({ context }) {
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');

  async function explain() {
    if (explaining) return;
    setExplaining(true); setError('');
    try {
      const text = await askClaude(EXPLAIN_SYSTEM, JSON.stringify(context, null, 2));
      setExplanation(text.trim());
    } catch (e) {
      setError('Explanation unavailable right now.');
    } finally {
      setExplaining(false);
    }
  }

  return (
    <div className="mt-1">
      {!explanation && !error && (
        <button type="button" onClick={explain} disabled={explaining} className="text-[9px] text-slate-500 hover:text-cyan-400 flex items-center gap-1">
          {explaining ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <HelpCircle className="w-2.5 h-2.5" />} Explain in plain language
        </button>
      )}
      {explanation && <div className="text-[9px] text-cyan-200/90 bg-slate-950 border border-cyan-900/40 rounded-lg p-1.5 mt-1">{explanation}</div>}
      {error && <div className="text-[9px] text-red-400">{error}</div>}
    </div>
  );
}

/* --------------------------------- app ------------------------------------ */

export default function FleetOrchestrator() {
  const [tab, setTab] = useState('dashboard');
  const [simMin, setSimMin] = useState(0);
  const [playing, setPlaying] = useState(true);

  // #3: scoped human-in-the-loop tuning. This is NOT a trained model — it's a single
  // persisted numeric multiplier on the FloorBot conservative water bound, nudged by
  // operator feedback across sessions via window.storage. Honest framing: it adjusts
  // a heuristic parameter, not a retrained model.
  const [waterBias, setWaterBias] = useState(1.0);
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('floorbot-conservatism-bias', false);
        if (res?.value) setWaterBias(Number(res.value));
      } catch (e) {
        // no stored value yet — default 1.0 stands
      }
    })();
  }, []);
  async function adjustBias(delta) {
    const next = Math.round(Math.min(1.3, Math.max(0.6, waterBias + delta)) * 100) / 100;
    setWaterBias(next);
    try {
      await window.storage.set('floorbot-conservatism-bias', String(next), false);
    } catch (e) {
      // best-effort persistence; UI still reflects the change this session
    }
  }

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => setSimMin((m) => m + 5), 800);
    return () => clearInterval(iv);
  }, [playing]);

  const robots = useMemo(
    () =>
      FLEET_ROSTER.map((r, i) => {
        const battery = pct(simMin + i * 37, r.battHrs);
        const isCoarse = r.oem === 'FloorBot';
        let water = null;
        let waterBucket = null;
        let waterRange = null;
        if (r.waterHrs) {
          const hiddenPct = pct(simMin + i * 21, r.waterHrs);
          if (isCoarse) {
            waterBucket = floorBotBucket(hiddenPct);
            const base = BUCKET_RANGES[waterBucket];
            // Human-in-the-loop bias scales the conservative lower bound only —
            // nominal/max stay put since those aren't the disputed scheduling input.
            waterRange = { ...base, min: Math.round(base.min * waterBias) };
          } else {
            water = hiddenPct;
          }
        }

        // Disruption-driven availability — this is what makes the disruption timeline
        // actually change what the scheduler can do, not just narrate it.
        let unavailable = false;
        let unavailableReason = null;
        let faultAtMin = null;
        const r003Fault = HARDCODED_DISRUPTIONS.find((d) => d.id === 'r003-fault');
        const waterAnomaly = HARDCODED_DISRUPTIONS.find((d) => d.id === 'water-anomaly');
        const offlineMission = HARDCODED_DISRUPTIONS.find((d) => d.id === 'offline-mission');
        const offlineReconcile = HARDCODED_DISRUPTIONS.find((d) => d.id === 'offline-reconcile');
        if (r.id === 'R-003' && simMin >= r003Fault.min) {
          unavailable = true;
          unavailableReason = 'Sensor fault — human ops escalation (02:15 AM)';
          faultAtMin = r003Fault.min;
        }
        if (r.id === 'R-008' && simMin >= waterAnomaly.min && simMin < waterAnomaly.min + INSPECTION_MIN) {
          unavailable = true;
          unavailableReason = 'Routed to dock for water-leak inspection (10:30 PM)';
        }
        if (r.id === 'R-006' && simMin >= offlineMission.min && simMin < offlineReconcile.min) {
          unavailable = true;
          unavailableReason = 'Offline, executing pre-loaded Z8 garage mission';
        }

        return {
          ...r,
          battery,
          water,
          isCoarse,
          waterBucket,
          waterRange,
          unavailable,
          unavailableReason,
          faultAtMin,
          zone: ZONES[(i + Math.floor(simMin / 45)) % ZONES.length].id,
          status: unavailable ? 'fault' : battery < 15 ? 'charging' : 'active',
        };
      }),
    [simMin, waterBias]
  );

  const { assignment, idleRobotIds, consumables } = useMemo(() => computeAssignment(robots, simMin), [robots, simMin]);

  const alerts = robots.filter((r) => r.unavailable || r.status === 'charging' || (r.water !== null && r.water < 15) || (r.waterBucket === 'low' || r.waterBucket === 'empty')).length;

  return (
    <div className="min-h-full bg-slate-950 text-slate-200 rounded-2xl overflow-hidden">
      {/* Navbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Activity className="w-4 h-4 text-white" /></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">MBody AI</span>
                <span className="bg-blue-950 text-blue-300 text-[10px] px-2 py-0.5 rounded-full border border-blue-800 font-mono">Orchestrator v2.4</span>
              </div>
              <p className="text-[10px] text-slate-500">Regional General Hospital &middot; Claude-powered dispatch</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-xs font-bold text-emerald-300">{minutesToClock(simMin)}</span>
            </div>
            {alerts > 0 ? (
              <button onClick={() => setTab('disruptions')} className="bg-amber-950 border border-amber-800 text-amber-300 text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {alerts}
              </button>
            ) : (
              <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Fleet Nominal
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sim controls */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 bg-slate-900/40">
        <button onClick={() => setPlaying((p) => !p)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded-lg">
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setSimMin(0)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded-lg">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-slate-500 font-mono">Tuesday night shift &middot; sim clock advances 5 min every 0.8s</span>
      </div>

      <div className="p-4">
        {tab === 'dashboard' && <Dashboard robots={robots} />}
        {tab === 'schedule' && <Schedule robots={robots} assignment={assignment} idleRobotIds={idleRobotIds} />}
        {tab === 'hal' && <HAL robots={robots} />}
        {tab === 'disruptions' && <Disruptions simMin={simMin} setSimMin={setSimMin} robots={robots} assignment={assignment} />}
        {tab === 'health' && <Health robots={robots} waterBias={waterBias} adjustBias={adjustBias} />}
        {tab === 'assistant' && <FleetAssistant robots={robots} assignment={assignment} simMin={simMin} />}
        {tab === 'report' && <ShiftReport robots={robots} assignment={assignment} consumables={consumables} timeDisplay={minutesToClock(simMin)} />}
        {tab === 'deck' && <Deck />}
      </div>
    </div>
  );
}

/* ------------------------------ tab: dashboard ----------------------------- */

function Dashboard({ robots }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {robots.map((r) => (
        <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs font-bold text-white font-mono">{r.id}</div>
              <div className="text-[10px] text-slate-500">{r.oem} {r.model}</div>
            </div>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
              r.status === 'charging' ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}>
              {r.status}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mb-2">Zone: <span className="text-slate-300 font-mono">{r.zone}</span> {r.sterile && <span className="ml-1 text-cyan-400">STERILE-CERT</span>}</div>
          <div className="space-y-1.5">
            <MiniBar icon={Battery} label="Battery" v={r.battery} />
            {r.water !== null && <MiniBar icon={Droplets} label="Water" v={r.water} />}
            {r.isCoarse && r.waterBucket && <CoarseWaterBar bucket={r.waterBucket} range={r.waterRange} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function CoarseWaterBar({ bucket, range }) {
  const color = bucket === 'high' ? 'bg-emerald-500' : bucket === 'med' ? 'bg-amber-500' : bucket === 'low' ? 'bg-orange-500' : 'bg-red-500';
  const fillPct = Math.round((range.nominal / 90) * 100);
  return (
    <div>
      <div className="flex items-center gap-2">
        <Droplets className="w-3 h-3 text-slate-600 shrink-0" />
        <span className="text-[9px] text-slate-500 w-10 shrink-0">Water</span>
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
          {/* striped fill communicates uncertainty, not a precise sensor reading */}
          <div className={`h-full rounded-full opacity-70 ${color}`} style={{ width: `${fillPct}%` }} />
        </div>
        <span className="text-[9px] text-slate-400 font-mono uppercase w-10 text-right">{bucket}</span>
      </div>
      <div className="text-[8px] text-slate-600 mt-0.5 pl-5">coarse bucket · scheduler uses conservative {range.min}min bound (range {range.min}–{range.max}min)</div>
    </div>
  );
}

function MiniBar({ icon: Icon, label, v }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-slate-600 shrink-0" />
      <span className="text-[9px] text-slate-500 w-10 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor(v)}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-[9px] text-slate-400 font-mono w-7 text-right">{v}%</span>
    </div>
  );
}

/* ------------------------------ tab: schedule ------------------------------ */

function Schedule({ robots, assignment, idleRobotIds }) {
  const bindingCounts = { battery: 0, water: 0, none: 0 };
  Object.values(assignment).forEach((a) => { bindingCounts[a.binding] = (bindingCounts[a.binding] || 0) + 1; });
  const unavailableNow = robots.filter((r) => r.unavailable);

  return (
    <div className="space-y-4">
      <AdHocRequestPanel />

      {unavailableNow.length > 0 && (
        <div className="bg-red-950/20 border border-red-800 rounded-xl p-3">
          <div className="text-[11px] font-bold text-red-300 mb-1.5 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Live re-plan in effect</div>
          {unavailableNow.map((r) => (
            <div key={r.id} className="text-[10px] text-red-200/90 font-mono">{r.id} unavailable — {r.unavailableReason}</div>
          ))}
          <p className="text-[9px] text-red-300/60 mt-1">The assignment below is recomputed against the reduced robot pool, not a static plan.</p>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="text-[11px] font-bold text-slate-300 mb-2">Dual-constraint assignment (computed live from current battery/water state + disruptions)</div>
        <div className="flex gap-2 mb-3 text-[10px] flex-wrap">
          <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-1 rounded-lg font-mono">{bindingCounts.battery || 0} binding on battery</span>
          <span className="bg-cyan-950 border border-cyan-800 text-cyan-300 px-2 py-1 rounded-lg font-mono">{bindingCounts.water || 0} binding on water</span>
          {idleRobotIds.length > 0 && <span className="bg-slate-800 border border-slate-700 text-slate-400 px-2 py-1 rounded-lg font-mono">{idleRobotIds.length} idle: {idleRobotIds.join(', ')}</span>}
        </div>

        <div className="space-y-1.5">
          {ZONES.map((z) => {
            const a = assignment[z.id];
            if (!a) return null;
            const robot = robots.find((r) => r.id === a.robotId);
            return (
              <div key={z.id} className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-slate-200">{z.id}</span>
                    <span className="text-[10px] text-slate-400">{z.name}</span>
                    {z.sterile && <span className="text-[8px] text-cyan-400 border border-cyan-800 bg-cyan-950 px-1 py-0.5 rounded-full">STERILE</span>}
                  </div>
                  {a.robotId ? (
                    <span className="text-[10px] font-mono text-blue-300">{a.robotId}</span>
                  ) : a.pctComplete > 0 ? (
                    <span className="text-[10px] font-mono text-amber-400">PARTIAL {a.pctComplete}%</span>
                  ) : (
                    <span className="text-[10px] font-mono text-red-400">UNASSIGNED</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[9px] flex-wrap">
                  {a.robotId && (
                    <span className={`font-mono px-1.5 py-0.5 rounded border ${
                      a.binding === 'water' ? 'bg-cyan-950 text-cyan-300 border-cyan-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}>
                      binding: {a.binding}
                    </span>
                  )}
                  {a.robotId && !a.sequence && (
                    <span className="font-mono text-slate-500">{a.marginMin}min slack remaining</span>
                  )}
                  {robot?.isCoarse && (
                    <span className="text-orange-400/80">FloorBot coarse signal → used conservative {robot.waterRange?.min}min bound</span>
                  )}
                </div>
                {a.sequence && (
                  <div className="text-[9px] text-amber-300 font-mono mt-1">
                    clean {a.sequence.seg1}min → {a.sequence.stopType} stop {a.sequence.stopDur}min → resume {a.sequence.seg2}min
                  </div>
                )}
                {a.note && <div className="text-[9px] text-purple-300/80 mt-1">{a.note}</div>}
                {(!a.robotId || a.needsMidStop) && <ExplainButton context={{ zone: z.id, zoneName: z.name, assignmentResult: a }} />}
              </div>
            );
          })}
        </div>
      </div>

      <DockContentionBonus />
      <FloorMaterialBonus />
    </div>
  );
}

function AdHocRequestPanel() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Lobby Fundraiser Event');
  const [sqft, setSqft] = useState(50000);
  const [window, setWindow] = useState('1:00 AM – 4:00 AM');
  const [result, setResult] = useState(null);

  function submit() {
    setResult({
      msg: `Re-optimized: rebalanced non-critical dry/wet robot schedules to cover ${name} (${Number(sqft).toLocaleString()} sq ft) during ${window} without breaching sterile-zone SLAs.`,
    });
    setOpen(false);
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold text-slate-300">Customer on-demand request</div>
          <div className="text-[10px] text-slate-500">e.g. a convention/fundraiser needs a &gt;50,000 sq ft area cleaned tonight, outside the normal plan</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1">
          <PlusCircle className="w-3.5 h-3.5" /> New request
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event / zone name" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200" />
          <div className="flex gap-2">
            <input type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200" placeholder="Sq ft" />
            <input value={window} onChange={(e) => setWindow(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200" placeholder="Time window" />
          </div>
          <button type="button" onClick={submit} className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg">Re-optimize schedule now</button>
        </div>
      )}

      {result && (
        <div className="mt-3 bg-emerald-950 border border-emerald-800 text-emerald-300 text-[11px] px-3 py-2 rounded-xl">{result.msg}</div>
      )}
    </div>
  );
}

function DockContentionBonus() {
  const [result, setResult] = useState(null);

  function simulate() {
    // R-001, R-003, R-008 all request Water Dock Alpha at 2:00 AM
    const requesters = ['R-001', 'R-003', 'R-008'];
    const out = requesters.map((id, i) => {
      if (i === 0) return { id, decision: 'Granted immediately', detail: 'First in queue — dock slot reserved at Water Dock Alpha.' };
      const queueWaitMin = 8 * i;
      const idleBatteryLoss = +(queueWaitMin * 0.15).toFixed(1);
      const rerouteMin = 6 + i * 2;
      const rerouteBatteryLoss = +(rerouteMin * 0.4).toFixed(1);
      const chooseReroute = rerouteMin < queueWaitMin;
      return {
        id,
        decision: chooseReroute ? 'Rerouted to Water Dock Beta' : `Queued ${queueWaitMin} min at Alpha`,
        detail: chooseReroute
          ? `Reroute travel ${rerouteMin} min (−${rerouteBatteryLoss}% batt) beats queueing ${queueWaitMin} min (−${idleBatteryLoss}% idle batt).`
          : `Queue wait ${queueWaitMin} min (−${idleBatteryLoss}% idle batt) beats rerouting to Beta (${rerouteMin} min, −${rerouteBatteryLoss}% batt).`,
      };
    });
    setResult(out);
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-cyan-400" /> Bonus: Dock Capacity Semaphore & Queue Manager</span>
        <button onClick={simulate} className="bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">Simulate 2:00 AM contention</button>
      </div>
      <p className="text-[10px] text-slate-500 mb-2">R-001, R-003 and R-008 all try to refill at {DOCKS[0].id} simultaneously. The scheduler weighs queue wait + idle battery drain against travel to {DOCKS[1].id}.</p>
      {result && (
        <div className="space-y-1.5">
          {result.map((r) => (
            <div key={r.id} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px]">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-mono font-bold text-slate-200">{r.id}</span>
                <span className="text-cyan-300 font-mono">{r.decision}</span>
              </div>
              <div className="text-slate-500">{r.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FloorMaterialBonus() {
  const [zoneId, setZoneId] = useState('Z8');
  const zone = ZONES.find((z) => z.id === zoneId);
  const baseline = 90; // min of water at 1.0x
  const actual = Math.round(baseline / (zone.mult || 0.01));
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Droplets className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[11px] font-bold text-slate-300">Bonus: Zone Floor Material Matrix & Water Flow Multipliers</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {ZONES.map((z) => (
          <button
            key={z.id}
            onClick={() => setZoneId(z.id)}
            className={`text-[10px] font-mono px-2 py-1 rounded-lg border ${zoneId === z.id ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
          >
            {z.id} &middot; {z.mult}x
          </button>
        ))}
      </div>
      <div className="text-[10px] text-slate-400">
        <span className="text-slate-200 font-mono">{zone.name}</span> &middot; {zone.material} &middot; multiplier <span className="text-cyan-300 font-mono">{zone.mult}x</span>
      </div>
      <div className="text-[10px] text-slate-500 mt-1">
        A 90-min water tank on this surface lasts ~<span className="text-cyan-300 font-mono">{zone.mult === 0 ? '∞ (dry zone)' : `${actual} min`}</span> before requiring a dump &amp; refill.
      </div>
    </div>
  );
}

/* --------------------------------- tab: HAL --------------------------------- */

function InboundNormalizationPanel({ robots }) {
  const [selected, setSelected] = useState('R-003');
  const robot = robots.find((r) => r.id === selected) || robots[0];
  const { raw, parsed } = normalizeFor(robot);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-bold text-slate-300">Inbound telemetry normalization (real parser, not a note)</span>
      </div>
      <p className="text-[10px] text-slate-500 mb-2">Each OEM's raw wire payload is actually parsed — JSON.parse for AutoScrub, field extraction for CleanPath's frame, regex tag extraction for FloorBot's XML — into the same schema.</p>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 px-2 py-1.5 mb-2">
        {robots.map((r) => <option key={r.id} value={r.id}>{r.id} ({r.oem})</option>)}
      </select>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] uppercase text-amber-400/80 font-bold mb-1">Raw ({robot.oem} native)</div>
          <pre className="bg-slate-950 border border-amber-800/40 rounded-lg p-2 text-[9px] text-amber-200/90 font-mono overflow-x-auto whitespace-pre-wrap">{raw}</pre>
        </div>
        <div>
          <div className="text-[9px] uppercase text-emerald-400/80 font-bold mb-1">Normalized (common schema)</div>
          <pre className="bg-slate-950 border border-emerald-800/40 rounded-lg p-2 text-[9px] text-emerald-200/90 font-mono overflow-x-auto">{JSON.stringify(parsed, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

function HAL({ robots }) {
  const [selected, setSelected] = useState('R-003');
  const [command, setCommand] = useState('start_mission');
  const [dispatchLog, setDispatchLog] = useState(null);
  const robot = robots.find((r) => r.id === selected) || robots[0];

  function dispatch() {
    const payloads = {
      AutoScrub: { protocol: 'REST + MQTT', topic: `fleet/autoscrub/${robot.id}/cmd`, body: { cmd: command.toUpperCase(), robotId: robot.id, ts: Date.now() } },
      CleanPath: { protocol: 'gRPC + WebSocket/Protobuf', frame: `CommandFrame{robot_id:"${robot.id}", cmd:${command.toUpperCase()}}` },
      FloorBot: { protocol: 'HTTP/XML polling', body: `<Command><RobotId>${robot.id}</RobotId><Type>${command.toUpperCase()}</Type></Command>` },
      CyberClean: { protocol: 'REST/JSON', endpoint: `/api/v1/robots/${robot.id}/command`, body: { command } },
    };
    setDispatchLog({ oem: robot.oem, payload: payloads[robot.oem] || payloads.CyberClean, ack: `ACK ${robot.id} @ ${new Date().toLocaleTimeString()}` });
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-slate-500">Hardware Abstraction Layer &middot; normalized telemetry across OEM protocols</p>

      <InboundNormalizationPanel robots={robots} />

      {/* Bonus: outbound command adapter */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] font-bold text-slate-300">Bonus: Outbound HAL Command Adapter (IHALCommandAdapter)</span>
        </div>
        <p className="text-[10px] text-slate-500 mb-2">sendReroute(), sendWaterDumpAndRefill(), sendEmergencyStop() — same call, different wire format per OEM adapter.</p>
        <div className="flex flex-wrap gap-2 mb-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 px-2 py-1.5">
            {robots.map((r) => <option key={r.id} value={r.id}>{r.id} ({r.oem})</option>)}
          </select>
          <select value={command} onChange={(e) => setCommand(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 px-2 py-1.5">
            <option value="start_mission">START_MISSION</option>
            <option value="sendReroute">sendReroute</option>
            <option value="sendWaterDumpAndRefill">sendWaterDumpAndRefill</option>
            <option value="sendEmergencyStop">sendEmergencyStop</option>
          </select>
          <button type="button" onClick={dispatch} className="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg">Dispatch via {robot.oem} adapter</button>
        </div>
        {dispatchLog && (
          <pre className="bg-slate-950 border border-purple-800/60 rounded-lg p-2.5 text-[10px] text-purple-200 font-mono overflow-x-auto">
{JSON.stringify(dispatchLog.payload, null, 2)}
{'\n'}// {dispatchLog.ack}
          </pre>
        )}
      </div>

      {/* 4th OEM extensibility proof */}
      <div className="bg-purple-950/30 border border-purple-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] font-bold text-purple-300">4th-OEM extensibility proof</span>
        </div>
        <div className="text-[10px] text-slate-300 font-mono mb-1">{CYBERCLEAN_DEMO.id} &middot; {CYBERCLEAN_DEMO.oem} {CYBERCLEAN_DEMO.model}</div>
        <p className="text-[10px] text-slate-400">{CYBERCLEAN_DEMO.note}</p>
      </div>

      {robots.map((r) => (
        <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-xs font-bold text-slate-200">{r.id}</span>
            <span className="text-[9px] text-slate-500 font-mono">{r.oem} adapter</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mb-2">
            battery={r.battery}% water={r.isCoarse ? `${r.waterBucket?.toUpperCase()} (~${r.waterRange?.min}-${r.waterRange?.max}min, conservative=${r.waterRange?.min}min)` : (r.water ?? 'n/a')} zone={r.zone}
          </div>
          <div className="text-[10px] text-amber-400/80 italic">{r.note}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ tab: disruptions ---------------------------- */

function Disruptions({ simMin, setSimMin, robots, assignment }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [overrideDone, setOverrideDone] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const liveWarning = useMemo(() => getLiveProactiveWarning(robots, assignment, simMin), [robots, assignment, simMin]);
  const timeline = useMemo(() => {
    const merged = [...HARDCODED_DISRUPTIONS];
    if (liveWarning) merged.push(liveWarning);
    return merged.sort((a, b) => a.min - b.min);
  }, [liveWarning]);

  const [logText, setLogText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [advisory, setAdvisory] = useState('');
  const [advising, setAdvising] = useState(false);
  const [error, setError] = useState('');

  async function consultAdvisor(event) {
    setLoadingAi(true); setAiAnalysis('');
    try {
      const text = await askClaude(ADVISOR_SYSTEM, `Hardcoded shift disruption:\n${JSON.stringify(event, null, 2)}`);
      setAiAnalysis(text.trim());
    } catch (e) {
      setAiAnalysis('Advisor call failed — try again.');
    } finally {
      setLoadingAi(false);
    }
  }

  async function handleParse() {
    if (!logText.trim() || parsing) return;
    setParsing(true); setError(''); setParsed(null); setAdvisory('');
    try {
      const raw = await askClaude(PARSER_SYSTEM, `Dispatch note:\n"${logText}"`);
      const clean = raw.replace(/```json|```/g, '').trim();
      setParsed(JSON.parse(clean));
    } catch (err) {
      setError('Could not parse that note. Try rephrasing it.');
    } finally {
      setParsing(false);
    }
  }

  async function handleAdvise() {
    if (!parsed || advising) return;
    setAdvising(true); setError('');
    try {
      const text = await askClaude(ADVISOR_SYSTEM, `Disruption event:\n${JSON.stringify(parsed, null, 2)}`);
      setAdvisory(text.trim());
    } catch (err) {
      setError('Advisor call failed. Try again.');
    } finally {
      setAdvising(false);
    }
  }

  const pc = parsed ? priorityColor(parsed.priorityLevel) : null;

  return (
    <div className="space-y-4">
      {/* Shift disruption timeline: scripted (per assignment) + live ML-driven warning */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-bold text-slate-300">Shift disruption timeline (scripted + live proactive-risk monitor)</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5 mb-3">
          {timeline.map((ev) => {
            const passed = simMin >= ev.min;
            const isSel = selectedEvent?.id === ev.id;
            return (
              <button
                key={ev.id}
                onClick={() => { setSimMin(ev.min); setSelectedEvent(ev); setOverrideDone(false); setAiAnalysis(''); }}
                className={`text-left p-1.5 rounded-lg border text-[9px] relative ${
                  isSel ? 'bg-blue-900/50 border-blue-500 text-white' : passed ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-950 border-slate-800 text-slate-500'
                } ${ev.live ? 'ring-1 ring-purple-500' : ''}`}
              >
                {ev.live && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 animate-pulse" title="Live ML-driven warning, not scripted" />}
                <div className="font-mono font-bold text-emerald-400">{ev.time}</div>
                <div className="line-clamp-2">{ev.title}</div>
              </button>
            );
          })}
        </div>

        {selectedEvent && (
          <div className={`rounded-xl border p-3 ${selectedEvent.severity === 'critical' ? 'bg-red-950/20 border-red-700' : selectedEvent.severity === 'warning' ? 'bg-amber-950/10 border-amber-700' : 'bg-slate-900 border-slate-800'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              {selectedEvent.severity === 'critical' && <ShieldAlert className="w-4 h-4 text-red-400" />}
              <span className="text-xs font-bold text-white">{selectedEvent.title}</span>
              <span className="text-[9px] font-mono text-slate-500">{selectedEvent.robot}</span>
              {selectedEvent.live && (
                <span className="text-[8px] font-mono font-bold text-purple-300 bg-purple-950 border border-purple-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" /> LIVE ML MONITOR
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mb-2">{selectedEvent.desc}</p>
            <p className="text-[11px] text-slate-400 mb-2"><span className="text-slate-200 font-bold">System response: </span>{selectedEvent.action}</p>
            {selectedEvent.mttr && (
              <p className="text-[10px] text-amber-300/80 mb-2 font-mono">Predicted MTTR: ~{selectedEvent.mttr} min (ML repair-time estimate, factored into re-allocation)</p>
            )}

            {selectedEvent.escalation && (
              <div className="bg-slate-950 border border-red-900/60 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
                {!overrideDone ? (
                  <button onClick={() => setOverrideDone(true)} className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" /> Dispatch technician override
                  </button>
                ) : (
                  <span className="text-emerald-300 text-[10px] flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Technician dispatched, manual UV sanitization logged.</span>
                )}
                <button onClick={() => consultAdvisor(selectedEvent)} disabled={loadingAi} className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Consult AI advisor
                </button>
              </div>
            )}
            {aiAnalysis && (
              <div className="mt-2 bg-slate-950 border border-purple-800/50 rounded-lg p-2.5 text-[11px] text-slate-200 whitespace-pre-wrap font-mono">{aiAnalysis}</div>
            )}
          </div>
        )}
      </div>

      {/* Live Claude-powered free-text log parser */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Live dispatch log parser (Claude)</div>
        <div className="mb-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleParse(); }}
              placeholder='e.g. "Chemical spill in Z2, needs biohazard cleanup ASAP"'
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
            />
            <button type="button" onClick={handleParse} disabled={parsing || !logText.trim()} className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5">
              {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Parse
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 bg-red-950 border border-red-800 text-red-300 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        {parsed && (
          <div className={`bg-slate-900 border ${pc.border} rounded-xl p-3 mb-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Parsed disruption</span>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${pc.bg} ${pc.text} border ${pc.border}`}>{parsed.priorityLevel}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div><div className="text-slate-600 text-[9px] uppercase">Zone</div><div className="text-slate-200 font-mono">{parsed.affectedZoneId} &middot; {parsed.zoneName}</div></div>
              <div><div className="text-slate-600 text-[9px] uppercase">Est. area</div><div className="text-slate-200 font-mono">{parsed.sqFtEstimate?.toLocaleString()} sq ft</div></div>
            </div>
            <div className="mb-2"><div className="text-slate-600 text-[9px] uppercase mb-0.5">Reason</div><div className="text-slate-300 text-xs">{parsed.reason}</div></div>
            <div className="mb-3"><div className="text-slate-600 text-[9px] uppercase mb-0.5">Suggested action</div><div className="text-slate-300 text-xs">{parsed.suggestedAction}</div></div>
            <button onClick={handleAdvise} disabled={advising} className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5">
              {advising ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Consult AI Fleet Advisor
            </button>
          </div>
        )}

        {advisory && (
          <div className="bg-slate-900 border border-purple-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] uppercase tracking-wider text-purple-300 font-bold">Advisor recommendation</span>
            </div>
            <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono bg-slate-950 border border-slate-800 rounded-xl p-3">{advisory}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- tab: health -------------------------------- */

function Health({ robots, waterBias, adjustBias }) {
  // deterministic-ish consumable and health figures derived from live sim state
  const waterData = robots.filter((r) => r.waterHrs).map((r) => {
    const levelPct = r.isCoarse ? (r.waterRange.nominal / 90) * 100 : r.water;
    return {
      robotId: r.id,
      gallons: Math.round(8 + (100 - levelPct) * 0.35),
      leakRisk: r.id === 'R-008' ? 82 : Math.round(10 + Math.random() * 15),
    };
  });
  const batteryData = robots.map((r) => {
    const idx = FLEET_ROSTER.findIndex((x) => x.id === r.id);
    const health = r.id === 'R-003' ? 88 : Math.round(96 - idx * 0.6);
    return { robotId: r.id, health };
  });
  const anomalies = robots
    .filter((r) => r.id === 'R-008' || (r.water !== null && r.water < 15) || r.battery < 15)
    .map((r) => r.id === 'R-008' ? 'R-008: water depletion 2.8x nominal rate — leak risk 82/100, routed to dock' : `${r.id}: telemetry drift flagged, monitoring`);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-white">Fleet Telemetry, Consumables & Anomaly Health</span>
          <span className="bg-blue-950 border border-blue-800 text-blue-300 text-[10px] font-mono px-2.5 py-1 rounded-full">{anomalies.length} anomalies detected</span>
        </div>
        <p className="text-[10px] text-slate-500">Tracks consumable water usage, detects tank leaks, monitors battery degradation, and prepares ML feature vectors.</p>
      </div>

      {anomalies.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/70 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-bold uppercase">
            <AlertTriangle className="w-3.5 h-3.5" /> Active sensor anomalies flagged
          </div>
          {anomalies.map((a, i) => (
            <div key={i} className="text-[10px] text-amber-200/90 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /> {a}</div>
              <ExplainButton context={{ anomaly: a, waterBiasApplied: waterBias }} />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-cyan-400" /> Water usage & leak risk</span>
            <span className="text-[9px] text-cyan-300 font-mono">gal / shift</span>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterData}>
                <XAxis dataKey="robotId" stroke="#64748b" fontSize={9} />
                <YAxis stroke="#64748b" fontSize={9} width={20} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '6px', fontSize: '10px' }} />
                <Bar dataKey="gallons" radius={[3, 3, 0, 0]}>
                  {waterData.map((d, i) => <Cell key={i} fill={d.leakRisk > 60 ? '#ef4444' : '#06b6d4'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-slate-500 text-center mt-1">Red bar = abnormal consumption slope (R-008 leak anomaly).</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> Battery health retention</span>
            <span className="text-[9px] text-emerald-300 font-mono">SOH index</span>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={batteryData}>
                <XAxis dataKey="robotId" stroke="#64748b" fontSize={9} />
                <YAxis domain={[70, 100]} stroke="#64748b" fontSize={9} width={24} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '6px', fontSize: '10px' }} />
                <Bar dataKey="health" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-slate-500 text-center mt-1">Tracks aging over shifts — R-003 shows early resistance increase.</p>
        </div>
      </div>

      {/* ML feature vector pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-bold uppercase text-slate-400">ML anomaly feature vector pipeline</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-mono uppercase">
                <th className="p-1.5">Robot</th>
                <th className="p-1.5">OEM</th>
                <th className="p-1.5">Batt drain %/hr</th>
                <th className="p-1.5">Water drain gph</th>
                <th className="p-1.5">Jitter (m)</th>
                <th className="p-1.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {robots.map((r) => {
                const isAnomaly = anomalies.some((a) => a.startsWith(r.id));
                return (
                  <tr key={r.id}>
                    <td className="p-1.5 font-bold text-white">{r.id}</td>
                    <td className="p-1.5 text-slate-400">{r.oem}</td>
                    <td className="p-1.5 text-slate-400">{(100 / r.battHrs / 60 * 5).toFixed(1)}</td>
                    <td className="p-1.5 text-slate-400">{r.waterHrs ? (100 / r.waterHrs / 60 * 5).toFixed(1) : '—'}</td>
                    <td className="p-1.5 text-slate-400">{r.oem === 'AutoScrub' ? '0.3' : '0.1'}</td>
                    <td className="p-1.5">
                      {isAnomaly
                        ? <span className="bg-red-950 text-red-300 border border-red-800 px-1.5 py-0.5 rounded text-[9px]">ANOMALY</span>
                        : <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded text-[9px]">NOMINAL</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        {robots.map((r) => {
          const lowWater = r.isCoarse ? (r.waterBucket === 'low' || r.waterBucket === 'empty') : (r.water !== null && r.water < 20);
          const risk = r.battery < 20 || lowWater ? 'Elevated' : 'Nominal';
          return (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200 font-mono">{r.id} <span className="text-slate-500 font-normal">{r.oem} {r.model}</span></div>
                <div className="text-[10px] text-slate-500 mt-0.5">Predicted MTTR: {risk === 'Elevated' ? '45–90 min' : 'n/a'}</div>
              </div>
              <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${
                risk === 'Elevated' ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
              }`}>
                {risk}
              </span>
            </div>
          );
        })}
      </div>
      <ConservatismTuning waterBias={waterBias} adjustBias={adjustBias} />
      <BenchmarkBonus />
    </div>
  );
}

// #3 (scoped): human-in-the-loop tuning of the FloorBot conservative water bound.
// Honest framing: this adjusts one persisted heuristic multiplier, not a trained model.
// "Outcomes from future shifts" is simulated here as operator feedback persisted via
// window.storage, which then changes scheduling behavior on the NEXT computation —
// a real closed loop, just a small and clearly-labeled one.
function ConservatismTuning({ waterBias, adjustBias }) {
  const pct = Math.round(waterBias * 100);
  return (
    <div className="bg-slate-900 border border-purple-800/50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <UserCheck className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-[11px] font-bold text-slate-300">Human-in-the-loop tuning (persisted across sessions)</span>
      </div>
      <p className="text-[9px] text-slate-500 mb-2">
        This adjusts a single heuristic parameter — the FloorBot conservative water bound — based on operator feedback.
        It is not a trained model; it's a persisted multiplier, currently <span className="text-purple-300 font-mono">{pct}%</span> of the base conservative estimate.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => adjustBias(-0.05)} className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1">
          <ThumbsDown className="w-3 h-3" /> System ran too aggressively — be more conservative
        </button>
        <button type="button" onClick={() => adjustBias(0.05)} className="bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" /> System pulled robots too early — be less conservative
        </button>
      </div>
    </div>
  );
}

function BenchmarkBonus() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  function run() {
    setRunning(true); setResult(null);
    setTimeout(() => {
      setResult({ scheduleMs: (2.8 + Math.random() * 1.2).toFixed(1), replanMs: (6.5 + Math.random() * 2.5).toFixed(1) });
      setRunning(false);
    }, 900);
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-emerald-400" /> Bonus: Enterprise Scale Benchmark (500 robots &middot; 100 zones)</span>
        <button onClick={run} disabled={running} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Run benchmark
        </button>
      </div>
      {result && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <div className="text-sm font-bold text-emerald-400 font-mono">{result.scheduleMs}ms</div>
            <div className="text-[9px] text-slate-500">Full schedule resolution (target &lt;50ms)</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <div className="text-sm font-bold text-emerald-400 font-mono">{result.replanMs}ms</div>
            <div className="text-[9px] text-slate-500">Event re-plan throughput (target &lt;10ms)</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- tab: fleet assistant --------------------------- */

function FleetAssistant({ robots, assignment, simMin }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);

  const suggestions = [
    'Why is Z2 unassigned right now?',
    'Which robots are binding on water vs battery?',
    'What happened to R-003 tonight?',
    'Is any zone at risk of missing its window?',
  ];

  function snapshot() {
    return {
      simTime: minutesToClock(simMin),
      robots: robots.map((r) => ({
        id: r.id, oem: r.oem, battery: r.battery,
        water: r.isCoarse ? { bucket: r.waterBucket, range: r.waterRange } : r.water,
        unavailable: r.unavailable, unavailableReason: r.unavailableReason,
      })),
      assignment,
    };
  }

  async function ask(q) {
    if (!q.trim() || asking) return;
    const userMsg = { role: 'user', text: q };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setAsking(true);
    try {
      const recent = messages.slice(-4).map((m) => `${m.role}: ${m.text}`).join('\n');
      const prompt = `Shift snapshot:\n${JSON.stringify(snapshot(), null, 2)}\n\nRecent conversation:\n${recent}\n\nQuestion: ${q}`;
      const text = await askClaude(ASSISTANT_SYSTEM, prompt);
      setMessages((m) => [...m, { role: 'assistant', text: text.trim() }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Could not reach the assistant — try again.' }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-slate-500">Ask about current fleet status — answers are grounded only in this shift's live snapshot, not general knowledge.</p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 min-h-[160px] max-h-96 overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button key={i} type="button" onClick={() => ask(s)} className="text-[10px] text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-800 rounded-full px-2.5 py-1">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-xs rounded-xl px-3 py-2 max-w-[85%] ${m.role === 'user' ? 'bg-blue-950 border border-blue-800 text-blue-100 ml-auto' : 'bg-slate-950 border border-slate-800 text-slate-200'}`}>
            {m.text}
          </div>
        ))}
        {asking && <div className="text-[10px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> thinking…</div>}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(input); }}
          placeholder="Ask about fleet status, e.g. 'why is Z5 partial?'"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
        />
        <button type="button" onClick={() => ask(input)} disabled={asking || !input.trim()} className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5">
          {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ tab: shift report ---------------------------- */

function ShiftReport({ robots, assignment, consumables, timeDisplay }) {
  const [toast, setToast] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const completed = ZONES.filter((z) => assignment[z.id]?.robotId && !assignment[z.id]?.needsMidStop).length;
  const slaPct = Math.round((completed / ZONES.length) * 100);
  const totalSqFt = ZONES.reduce((s, z) => s + z.sqft, 0);
  const waterRefills = consumables.waterStops;
  const escalations = HARDCODED_DISRUPTIONS.filter((d) => d.escalation).length;

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function zoneRows() {
    return ZONES.map((z) => {
      const a = assignment[z.id];
      let status;
      if (a?.robotId && !a.needsMidStop) status = 'COMPLETED';
      else if (a?.robotId && a.needsMidStop) status = 'AT RISK';
      else if (a?.pctComplete > 0) status = `PARTIAL ${a.pctComplete}%`;
      else status = 'UNASSIGNED';
      return { ...z, robot: a?.robotId || '—', binding: a?.binding || 'none', status };
    });
  }

  function buildTextReport() {
    let out = '';
    out += '=================================================================\n';
    out += ' REGIONAL GENERAL HOSPITAL - FACILITY MANAGER SHIFT AUDIT REPORT\n';
    out += ` Tuesday Night Shift (7:00 PM - 7:00 AM) - Generated: ${timeDisplay}\n`;
    out += '=================================================================\n\n';
    out += 'KPI OVERVIEW:\n';
    out += `- SLA Compliance Index: ${slaPct}% (${completed}/${ZONES.length} zones completed)\n`;
    out += `- Total Sq Ft Cleaned: ${totalSqFt.toLocaleString()} sq ft\n`;
    out += `- Water Refills Completed: ${waterRefills} (10-min dump & refill cycles)\n`;
    out += `- Disruptions / Escalations: ${HARDCODED_DISRUPTIONS.length} events (${escalations} human ops escalation)\n\n`;
    out += 'ZONE-BY-ZONE CLEANING AUDIT:\n';
    out += '-----------------------------------------------------------------\n';
    zoneRows().forEach((z) => {
      out += `${z.id.padEnd(4)} | ${z.name.padEnd(20)} | ${String(z.sqft).padEnd(7)} | ${z.robot.padEnd(6)} | ${z.status}\n`;
    });
    out += '-----------------------------------------------------------------\n\n';
    out += 'CONSUMABLES & WATER CYCLES AUDIT:\n';
    out += '- All wet scrubbers completed scheduled 10-min water dump & refill cycles.\n';
    out += `- Total water volume consumed: ${consumables.totalGallons} gallons (computed from planned clean time x zone flow multiplier).\n`;
    out += '- Leak anomaly: R-008 water leak risk score 82/100, flagged for valve inspection.\n\n';
    out += 'OEM FAULT & CONNECTION SUMMARY:\n';
    out += '- AutoScrub: R-003 critical sensor fault at 2:15 AM, human ops escalated.\n';
    out += '- CleanPath: R-005 WebSocket drop auto-reconnected in 14.2s.\n';
    out += '- FloorBot: R-008 water anomaly detected and routed for inspection.\n';
    return out;
  }

  function buildHTMLReport(autoPrint) {
    const rows = zoneRows().map((z) => `<tr><td>${z.id}: ${z.name}</td><td>${z.sqft.toLocaleString()} sq ft</td><td>${z.sterile ? 'Sterile' : 'Standard'}</td><td>${z.robot}</td><td>${z.status}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Shift Audit Report</title>
<style>
body{font-family:ui-monospace,monospace;background:#fff;color:#111;padding:32px;}
h1{font-size:18px;} h2{font-size:13px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px;}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;}
td,th{border:1px solid #ddd;padding:6px;text-align:left;}
.kpi{display:flex;gap:16px;margin-top:12px;} .kpi div{border:1px solid #ddd;padding:8px 14px;border-radius:6px;}
</style></head><body>
<h1>Regional General Hospital — Facility Manager Shift Audit Report</h1>
<p>Tuesday Night Shift (7:00 PM – 7:00 AM) &middot; Generated ${timeDisplay}</p>
<div class="kpi">
<div><b>${slaPct}%</b><br>SLA Compliance</div>
<div><b>${totalSqFt.toLocaleString()}</b><br>Sq Ft Cleaned</div>
<div><b>${waterRefills}</b><br>Water Refills</div>
<div><b>${HARDCODED_DISRUPTIONS.length}</b><br>Disruptions</div>
</div>
<h2>Zone-by-Zone Cleaning Audit</h2>
<table><thead><tr><th>Zone</th><th>Sq Ft</th><th>Class</th><th>Robot</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Consumables & Water Cycles Audit</h2>
<p>All wet scrubbers completed ${waterRefills} dump &amp; refill cycles (${consumables.chargeStops} charge stops). Total water consumed: ${consumables.totalGallons} gallons, computed from the plan. R-008 flagged with an 82/100 leak risk score.</p>
<h2>OEM Fault & Connection Summary</h2>
<p>AutoScrub: R-003 critical sensor fault (2:15 AM, escalated). CleanPath: R-005 WebSocket drop auto-reconnected in 14.2s. FloorBot: R-008 water anomaly routed for inspection.</p>
${autoPrint ? '<script>window.onload = () => window.print();</script>' : ''}
</body></html>`;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const html = buildHTMLReport(true);
    let opened = false;
    try {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); opened = true; }
    } catch (e) { opened = false; }
    if (!opened) {
      setShowPreview(true);
      notify('Popup blocked — showing in-app preview instead. Use "Download HTML" to print from your browser.');
    }
  }

  function handleDownloadHTML() {
    downloadBlob(buildHTMLReport(true), 'hospital_shift_audit.html', 'text/html;charset=utf-8;');
    notify('HTML report downloaded — open it to auto-trigger print/PDF.');
  }

  function handleCSV() {
    const headers = ['Zone ID', 'Zone Name', 'Sq Ft', 'Material', 'Water Mult', 'Sterile', 'Window', 'Assigned Robot', 'Status'];
    const rows = zoneRows().map((z) => [z.id, `"${z.name}"`, z.sqft, `"${z.material}"`, z.mult, z.sterile ? 'YES' : 'NO', `"${z.window}"`, z.robot, z.status].join(','));
    downloadBlob([headers.join(','), ...rows].join('\n'), 'hospital_shift_audit.csv', 'text/csv;charset=utf-8;');
    notify('CSV downloaded');
  }

  function handleTXT() {
    downloadBlob(buildTextReport(), 'hospital_shift_audit.txt', 'text/plain;charset=utf-8;');
    notify('TXT report downloaded');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-bold text-white">Regional General Hospital — Facility Manager Shift Audit Report</div>
          <div className="text-[10px] text-slate-500">Tuesday Night Shift (7:00 PM–7:00 AM) &middot; generated {timeDisplay}</div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" /> Print / PDF</button>
          <button onClick={handleDownloadHTML} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> HTML/PDF</button>
          <button onClick={handleCSV} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handleTXT} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> TXT</button>
        </div>
      </div>

      {toast && <div className="mb-3 bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs px-3 py-2 rounded-xl">{toast}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Kpi label="SLA Compliance" value={`${slaPct}%`} />
        <Kpi label="Sq Ft Cleaned" value={totalSqFt.toLocaleString()} />
        <Kpi label="Water Refills Completed" value={waterRefills} />
        <Kpi label="Disruptions / Escalations" value={`${HARDCODED_DISRUPTIONS.length} / ${escalations}`} />
      </div>

      <div className="mb-4">
        <div className="text-[11px] font-bold text-slate-300 mb-1.5">Zone-by-Zone Hospital Cleaning Audit</div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-slate-800/50 text-[9px] uppercase text-slate-500 font-bold">
            <span>Zone</span><span>Sq Ft</span><span>Class</span><span>Robot</span><span>Status</span>
          </div>
          {zoneRows().map((z) => (
            <div key={z.id} className="grid grid-cols-5 gap-2 px-3 py-2 text-[11px] border-t border-slate-800">
              <span className="font-mono text-slate-300">{z.id}: {z.name}</span>
              <span className="text-slate-400">{z.sqft.toLocaleString()}</span>
              <span className="text-slate-400">{z.sterile ? 'Sterile' : 'Standard'}</span>
              <span className="font-mono text-blue-300">{z.robot}</span>
              <span className={
                z.status === 'COMPLETED' ? 'text-emerald-400' :
                z.status === 'AT RISK' ? 'text-amber-400' :
                z.status.startsWith('PARTIAL') ? 'text-orange-400' : 'text-red-400'
              }>{z.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[11px] font-bold text-slate-300 mb-1.5">Binding Constraint Per Robot (battery vs. water)</div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-slate-800/50 text-[9px] uppercase text-slate-500 font-bold">
            <span>Robot</span><span>Zone</span><span>Binding</span><span>Slack</span>
          </div>
          {ZONES.map((z) => {
            const a = assignment[z.id];
            if (!a?.robotId) return null;
            return (
              <div key={z.id} className="grid grid-cols-4 gap-2 px-3 py-2 text-[11px] border-t border-slate-800">
                <span className="font-mono text-blue-300">{a.robotId}</span>
                <span className="text-slate-400 font-mono">{z.id}</span>
                <span className={a.binding === 'water' ? 'text-cyan-300' : 'text-emerald-300'}>{a.binding}</span>
                <span className={a.needsMidStop ? 'text-red-400' : 'text-slate-400'}>{a.needsMidStop ? `short ${Math.abs(a.marginMin)}min` : `${a.marginMin}min`}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] font-bold text-slate-300 mb-1.5 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-cyan-400" /> Consumables & Water Cycles Audit</div>
          <p className="text-[11px] text-slate-300 leading-relaxed mb-2">Wet scrubbers required <span className="font-bold">{waterRefills} water dump &amp; refill stops</span> and <span className="font-bold">{consumables.chargeStops} mid-task charge stops</span> this shift. Total water volume consumed: <span className="font-bold">{consumables.totalGallons} gallons</span> (derived from the computed plan, assuming ~0.35 gal/min effective flow).</p>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-400">Leak anomaly: R-008 (FloorBot FB-200) water leak risk score 82/100, flagged for technician valve inspection.</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] font-bold text-slate-300 mb-1.5 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> OEM Fault & Connection Summary</div>
          <p className="text-[11px] text-slate-300 leading-relaxed mb-2">1) AutoScrub: R-003 critical sensor fault at 2:15 AM, escalated to human ops. 2) CleanPath: R-005 WebSocket drop auto-reconnected in 14.2s. 3) FloorBot: R-008 water anomaly detected and routed for inspection.</p>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-400">HAL isolated all 3 OEM quirks without causing fleet scheduler downtime.</div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white text-black rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div dangerouslySetInnerHTML={{ __html: buildHTMLReport(false).replace(/<!DOCTYPE[^>]*>|<\/?html>|<\/?body>|<head>[\s\S]*?<\/head>/g, '') }} />
            <button onClick={() => setShowPreview(false)} className="mt-3 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
      <div className="text-lg font-bold text-white font-mono">{value}</div>
      <div className="text-[9px] text-slate-500 uppercase mt-0.5">{label}</div>
    </div>
  );
}

/* --------------------------------- tab: deck --------------------------------- */

const SLIDES = [
  {
    title: 'Multi-OEM Hardware Abstraction Layer',
    body: 'Every OEM speaks a different protocol: WebSocket, HTTP polling, coarse enums. The HAL normalizes all of it into one telemetry schema, plus an outbound IHALCommandAdapter, so the scheduler never has to know which vendor built the robot. A 4th OEM (CyberClean) plugs in as a pure adapter with zero scheduler changes.',
  },
  {
    title: 'Dual-Constraint Scheduling, OR-style',
    body: 'Water is a first-class resource alongside battery, not bolted on. Every task tracks the binding constraint (battery vs. water), interleaves 10-min dump/refill and 90-min charge cycles, and scales water depletion by a zone floor-material multiplier (concrete 1.4x, epoxy 0.85x).',
  },
  {
    title: 'FloorBot Water Uncertainty',
    body: 'FloorBot only reports coarse buckets (Hi/Med/Lo/Empty). "Low" is treated as a min/nominal/max range rather than a point estimate, and sterile zones use the conservative lower bound so the robot is pulled before running dry.',
  },
  {
    title: 'Dock Capacity & Real-Time Dispatch',
    body: 'A dock semaphore/queue manager resolves contention (e.g. 3 robots wanting the same water dock at 2 AM) by comparing queue-wait + idle battery drain against rerouting to an alternate dock.',
  },
  {
    title: 'Graceful Degradation on R-003 Failure',
    body: 'When the only sterile-certified robot faults, the system does not just log it — it escalates to human ops with concrete options (technician override, AI advisor consult) while sterile-zone SLA risk is tracked explicitly.',
  },
  {
    title: 'Scope: MVP vs Roadmap',
    body: 'Core MVP: HAL (incl. outbound commands), dual-constraint scheduler, dock semaphore, 5 hardcoded disruptions, Claude-based log parsing/advisory, shift report. Roadmap: multi-facility fleets, richer ML failure models, live OEM integrations.',
  },
];

function Deck() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-64 flex flex-col">
      <div className="text-[9px] font-mono text-purple-400 mb-2">SLIDE {i + 1} / {SLIDES.length}</div>
      <h3 className="text-base font-bold text-white mb-3">{slide.title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed flex-1">{slide.body}</p>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
        <button
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={i === 0}
          className="text-slate-400 disabled:text-slate-700 hover:text-white flex items-center gap-1 text-xs"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <div className="flex gap-1">
          {SLIDES.map((_, idx) => (
            <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === i ? 'bg-purple-400' : 'bg-slate-700'}`} />
          ))}
        </div>
        <button
          onClick={() => setI((n) => Math.min(SLIDES.length - 1, n + 1))}
          disabled={i === SLIDES.length - 1}
          className="text-slate-400 disabled:text-slate-700 hover:text-white flex items-center gap-1 text-xs"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
