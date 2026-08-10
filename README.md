# Multi-OEM Fleet Orchestration System (MBody AI)
**AI Lead Engineer Candidate Technical Submission**
**Facility:** Regional General Hospital (8 Robots, 8 Zones)
**Primary Objective:** Total Operating Cost Optimization (Maximizing Sq Ft Cleaned & Fleet Utilization) under Hard Hospital SLA Constraints

---

## 1. Executive Summary & Core Philosophy

The **MBody AI Multi-OEM Fleet Orchestration System** is a control, scheduling, and health monitoring system built to orchestrate heterogeneous autonomous cleaning robots across a hospital facility.

Rather than a surface-level prototype, this solution prioritizes **solid software architecture**, **predictable dual-constraint optimization**, **clean abstraction boundaries**, and **robust interruption handling** — and every claim in this document has been checked against the actual code in `src/`, not just described in prose. Where an earlier draft of this README described behavior that didn't match the implementation, it's been corrected below rather than left as aspirational documentation.

```
                                 ┌──────────────────────────────────────────────┐
                                 │        MBody AI Orchestration System         │
                                 └──────────────────────┬───────────────────────┘
                                                        │
        ┌───────────────────────────────────────────────┼───────────────────────────────────────────────┐
        ▼                                               ▼                                               ▼
  ┌───────────┐                                   ┌───────────┐                                   ┌───────────┐
  │  HAL      │                                   │ Scheduler │                                   │ Dispatch  │
  │  Engine   │                                   │ (OR + ML) │                                   │ & Monitor │
  └─────┬─────┘                                   └─────┬─────┘                                   └─────┬─────┘
        │                                               │                                               │
  ┌─────┴──────────────────┬────────────────────────────┴─────────┬─────────────────────────────────────┴─────┐
  │                        │                                      │                                           │
  ▼                        ▼                                      ▼                                           ▼
┌──────────────────┐  ┌─────────────────────┐          ┌────────────────────┐                       ┌─────────────────────┐
│ AutoScrub        │  │ CleanPath           │          │ FloorBot           │                       │ CyberClean (4th OEM)│
│ Adapter          │  │ Adapter             │          │ Adapter            │                       │ Extensibility       │
│ (REST/MQTT JSON) │  │ (gRPC/WS Protobuf)  │          │ (HTTP CGI/XML)     │                       │ Proof Adapter       │
└────────┬─────────┘  └─────────┬───────────┘          └─────────┬──────────┘                       └─────────┬───────────┘
         │                      │                                │                                            │
         ▼                      ▼                                ▼                                            ▼
   AS-900 / AS-900H        CP-V2 / CP-X1                       FB-200                                      CC-1000
 (AutoScrub Fleet)       (CleanPath Fleet)                   (FloorBot Fleet)                           (Future OEM)
```

See `docs/architecture-diagram.svg` for the full data-flow diagram (HAL adapters → normalized schema → scheduler/dispatcher → LLM layer → UI). The ASCII summary above is a quick-reference version of the same diagram.

---

## 2. Hardware Abstraction Layer (HAL)

The Hardware Abstraction Layer decouples business logic (scheduling, dispatching, anomaly detection) from OEM-specific communications. All OEM-specific formats (MQTT JSON, WebSocket Protobuf, HTTP CGI XML) are normalized at the edge via `IHALAdapter`, and the central scheduler operates strictly on the normalized schema below, remaining agnostic to OEM protocol differences.

### Normalized Telemetry Schema (`NormalizedTelemetry`)
All adapters translate native payloads into a single internal representation (`src/types/index.ts`):
```typescript
interface NormalizedTelemetry {
  robotId: string;
  oem: OEMBrand; // 'AutoScrub' | 'CleanPath' | 'FloorBot' | 'CyberClean'
  timestamp: string;
  batteryPct: number;
  waterPct: number | null;                              // null for dry vacuum/mop robots
  coarseWaterLevel: CoarseWaterBucket | null;            // 'high' | 'med' | 'low' | 'empty'
  waterMinutesEst: { min: number; nominal: number; max: number } | null;
  position: { x: number; y: number; zoneId: string | null; uncertaintyMeters: number };
  status: RobotStatus;
  errorCode: string | null;
  rawPayload: string;
  protocolFormat: 'MQTT/JSON' | 'WebSocket/Protobuf' | 'HTTP/XML' | 'REST/JSON';
}
```

### Handling OEM Quirks
1. **AutoScrub GPS Drift (±2m)**: `AutoScrubAdapter` reports raw position with `uncertaintyMeters: 2.0`, then applies a moving-average smoothing filter that reduces reported uncertainty to `0.5` once enough samples have accumulated.
2. **CleanPath WebSocket Drop**: `CleanPathAdapter` implements a 15-second reconnection grace period during floor transitions before flagging a real network interruption.
3. **FloorBot Coarse Water Reporting**: `FloorBotAdapter` translates discrete water levels (`high`/`med`/`low`/`empty`) into minute ranges with uncertainty margins (`low` → 10-30 min range, 20 min nominal). See §3 for how the scheduler uses this uncertainty downstream.

### Extensibility Guarantee (4th OEM Proof)
Adding a 4th OEM (`CyberClean CC-1000`) required implementing **only** `CyberCleanAdapter.ts` (`src/hal/adapters/CyberCleanAdapter.ts`) adhering to `IHALAdapter`. **Zero lines of code** were changed in the Scheduler, Dispatcher, or UI monitoring components.

---

## 3. Dual-Constraint Optimization Engine (OR + ML)

### Binding Resource Constraint Calculation
For any scrubber robot, the operational runtime before requiring a service stop is bounded by the tighter resource constraint:

```math
$$\text{Runtime Limit} = \min\left(T_{\text{battery\_rem}}, T_{\text{water\_rem}}\right)$$
```
This is implemented directly in `src/scheduler/optimizer.ts`:
```typescript
const battMinsAvail = Math.floor(battHoursAvail * 60);
const waterMinsAvail = Math.floor(rawWaterMins / waterMultiplier);
const bindingConstraint = bestRobot.hasWaterTank && waterMinsAvail < battMinsAvail ? 'water' : 'battery';
const maxAvailMins = Math.min(battMinsAvail, waterMinsAvail);
```

Clean water is treated as a first-class binding constraint, equal in priority to battery SOC — not an afterthought bolted onto a battery-only scheduler.

- **Battery Charging**: ~90 minutes (0% to 100%), modeled as +5.5% per 5-minute simulation tick. Safety margin = 10% minimum battery reserve before a robot is pulled to dock.
- **Water Refill Cycle**: 10 minutes (dump + refill) at a water station. Scrubbers carry 1.5 hours (90 mins) of continuous water supply at baseline flow.
- **Floor Material Friction Multipliers**: water consumption scales with floor surface friction. Verified values from `src/data/facility.ts`: Porous Concrete (Z8) = **1.4x**, Sterile Epoxy Tile (Z2/Z5/Z7) = **0.85x**, Standard VCT Vinyl = **1.0x**, Carpet (Z4) = **0.0x** (dry-only zone).
- **Dock Travel & Arbitration**: `src/scheduler/dockManager.ts` computes travel time geometrically between zone coordinates (roughly 3-15 minutes depending on distance), sorts candidate docks by proximity, and — when the nearest dock is at capacity — compares **queue-wait time** against **rerouting to an alternate dock**, weighing idle battery loss either way. This is not a FIFO queue; it's a cost comparison per request. See the `evaluateAndReserveDock()` method for the full decision logic.

### Scheduling Cost Function (as actually implemented)
Rather than a single global objective maximized over the whole shift, the scheduler assigns zones one at a time to the lowest-cost eligible robot. In `ML_PROACTIVE` mode, the cost score for a candidate robot/zone/time combination is:
```typescript
let costScore = totalJobMins;
if (mode === 'ML_PROACTIVE' && failureRiskProb >= 0.80) {
  const riskPenalty = failureRiskProb * 200 * zoneCriticalityMultiplier;
  costScore += riskPenalty;
}
```
where `zoneCriticalityMultiplier` is **10.0** for sterile zones, **4.0** for high-traffic zones, and **1.5** otherwise — actively steering high-failure-risk robots away from sterile hospital zones. (An earlier draft of this document described a global weighted objective function with lambda/mu/alpha trade-off terms; that formulation was never implemented and has been removed in favor of the cost score actually in the code.)

### Handling FloorBot Water-Level Imprecision
FloorBot units report water levels via coarse discrete buckets (`high`, `med`, `low`, `empty`), so a "low" reading is imprecise. Pushing the robot until empty risks dry-scrubbing floor damage or incomplete zone coverage; pulling it immediately on a "low" reading wastes 20-30% of remaining usable capacity.

**Decision model**: the system computes a confidence range (10-30 mins, 20 min nominal) scaled by floor material friction.
- **Sterile / Critical Hospital Zones** (Z2, Z5, Z7): scheduler adopts a **conservative policy**, using the pessimistic lower bound of the range so the robot is pulled before risking a dry run.
- **Standard Zones** (Z1, Z3, Z4, Z6, Z8): scheduler adopts a **probabilistic threshold policy**, letting the robot finish the current zone while the anomaly detector continues monitoring for a genuine leak signature.

### Proactive vs. Reactive Replanning Strategies

There are two distinct proactive mechanisms in this codebase, because the first one turned out to have a real limitation that's worth documenting honestly rather than hiding:

1. **Static scheduler risk-ranking** (`src/scheduler/optimizer.ts`, `ML_PROACTIVE` mode): during initial schedule generation, candidate robots are scored with a risk penalty (`failureRiskProb * 200 * zoneCriticalityMultiplier`) when their predicted failure probability at the candidate's `candidateStartMin` crosses 0.80. **This check only evaluates risk at whatever moment a zone's window happens to open** — for this facility's actual window configuration, R-003's sterile zones don't open until well after its risk peak (Z2 opens 45 minutes after the 2:15 AM peak), so this mechanism can legitimately apply zero penalties depending on window layout. This isn't a bug so much as an architectural limitation: a plan generated once at 7 PM can't "see" a risk curve that peaks mid-shift unless a zone happens to be evaluated at exactly the right moment.

2. **Live proactive-risk monitor** (`src/dispatcher/simulationEngine.ts#evaluateProactiveRiskMonitoring`, `src/scheduler/proactiveReplanner.ts`): the mechanism that actually fires reliably. On every simulation tick, each robot's **current** predicted failure risk is checked against the live clock via `globalFailurePredictor.predictRobotFailureAtTime(robotId, currentMin)` — not just at task-start time. The threshold (`PROACTIVE_RISK_WARNING_THRESHOLD = 0.5`) is chosen deliberately: well above every nominal robot's modeled ceiling (R-006 tops at 0.35, default robots at ~0.04), yet reachable a genuine ~65+ minutes before either scripted incident (R-003's fault, R-008's water anomaly). When a robot crosses it for the first time that shift:
   - If an eligible, non-elevated-risk, non-conflicting alternative robot exists (`findEligibleAlternativeRobot`), its upcoming task is **actually reassigned** — a real re-plan, not a log line — and a `PROACTIVE_REPLAN` event is recorded.
   - If no alternative exists — R-003's actual situation, since it's the only sterile-certified robot — a `PROACTIVE_ML_WARNING` disruption fires instead, giving human ops early visibility (verified in testing: **65 minutes** ahead of the 2:15 AM reactive fault) rather than only finding out at the moment of failure.

   See `src/__tests__/simulationEngine.test.ts` and `src/__tests__/proactiveReplanner.test.ts` for end-to-end and unit-level proof this actually fires (both the reassignment and the no-alternative-escalation branches), rather than just existing as unreachable code.
3. **Reactive Replanning (Event-Driven)**: triggered immediately upon real-time disruption events (e.g., R-003 sensor failure at 2:15 AM). See §4.
4. **Customer On-Demand Rebalancing**: `injectCustomerAdHocRequest()` in `src/dispatcher/simulationEngine.ts` accommodates ad-hoc customer requests (e.g., a 50,000 sq ft lobby convention/fundraiser clean) by re-generating the schedule with the extra zone injected, dynamically reallocating dry/wet robots without breaking hospital sterile SLAs.

---

## 4. Real-Time Dispatch & Interruption Handling

The system handles 5 distinct real-time operational interruptions, escalating gracefully where automated resolution isn't possible.

| Disruption Event | System Response & Strategy |
|---|---|
| **1. R-003 Sensor Fault (2:15 AM)** | The sole healthcare-certified robot (R-003) fails. System triggers a **Human Ops Escalation Alert**, logs SLA breach risk for sterile zones (Z2, Z5), and presents explicit resolution options: manual technician override, task re-assignment, or window delay. |
| **2. R-008 Water Anomaly (10:30 PM)** | R-008 reports "LOW" water after only 20 min. Anomaly Engine evaluates flow/valve telemetry, computes a high leak risk score (82/100), and dispatches R-008 to dock for valve inspection. |
| **3. R-005 WebSocket Drop (2:20 AM)** | R-005 drops connection in transit. Orchestrator invokes a 15-second grace period timer. Auto-reconnects at 14.2s without triggering a false alarm. |
| **4. Security Escort Delay (1:00 AM)** | Escort delay at Z5 (Patient Halls). System dynamically extends the Z5 window and re-sequences non-sterile tasks to preserve shift throughput and SLA. |
| **5. Offline Garage Mission (Z8)** | Z8 (Parking Garage) lacks WiFi. Orchestrator pre-loads mission parameters (9:30 PM), the robot executes autonomously offline, and reconciles state upon returning to dock (11:50 PM). |

---

## 5. LLM & Closed-Loop Reasoning Layer

This section documents what "self-healing AI" means in this system concretely — what's implemented, what's deliberately scoped down, and what's explicitly *not* implemented and why.

### #1 - Plain-language explainability (implemented)
`explainDecision()` in `src/server/claudeAdvisor.ts`, exposed via `POST /api/ai/explain`. Given any raw scheduling/anomaly state object, returns 2-3 plain-language sentences for a non-technical facility manager. Surfaced via `<ExplainButton>` (`src/components/ExplainButton.tsx`), attached to disruption events (Disruptions tab) and anomaly flags (Health tab).

### #2 - Conversational fleet assistant (implemented)
`answerFleetQuestion()` in `src/server/claudeAdvisor.ts`, exposed via `POST /api/ai/assistant`, and the `FleetAssistant` tab/component (`src/components/FleetAssistant.tsx`). Every question is answered **only** from a JSON snapshot of the current shift built fresh on each call — the system prompt explicitly instructs the model to say "I don't know" rather than answer from general knowledge if the snapshot doesn't contain the answer.

### #3 - Scoped human-in-the-loop tuning (implemented, deliberately small)
`src/monitoring/humanFeedback.ts` - read the doc comment at the top of that file before extending it. Honest summary: this is **one persisted numeric multiplier**, not a trained model. Two feedback buttons in the Health tab nudge a bias value +/-0.05 (clamped [0.6, 1.3]) that scales the leak-flag threshold applied to FloorBot's coarse water signal in `anomalyDetector.ts`. Persisted via a pluggable `FeedbackStore` interface so it survives across sessions. See `src/__tests__/humanFeedback.test.ts` for the guaranteed behavior (default 1.0, correct nudge direction, clamping, persistence across instances).

**What this is not**: it does not retrain any model, it does not use outcome data from actual future shifts, and it tunes exactly one number. A production version would need (a) a labeled dataset of decision/outcome pairs, (b) a real training or Bayesian-updating pipeline, and (c) a way to validate an update improved outcomes before it goes live.

### #4 - Autonomous self-correction of broken code paths (NOT implemented - roadmap)

Explicitly requested and explicitly scoped out, on purpose, rather than built as a stretch feature.

- **What's already covered elsewhere**: *operational* self-healing - a robot fails, the scheduler detects it and re-routes work - is real (§4 above). That's the load-bearing part of "self-healing" this system actually needs.
- **What's out of scope**: a system that detects and patches its own *software* bugs at runtime, without human review, implies automated code generation, automated verification of that generated code, and a rollback mechanism, all running unsupervised in a hospital operations context. A fake version of this would misrepresent what the system can do in a live walkthrough.
- **How I'd actually scope it, if asked for real**:
  1. Start narrow - detect a bounded class of invariant violations (double-booked zone, resource-limit overrun) with plain assertions, no LLM needed.
  2. For that narrow class, an LLM-assisted repair loop could propose a *config/parameter* patch (not arbitrary code), verified against the same invariants and the test suite before being applied - a generalization of what §3 already does.
  3. Full autonomous code-path correction would need a sandboxed execution environment, a much larger test suite as a correctness oracle, and a human-approval gate before production - at which point it's "AI-assisted code review," which is honest and valuable, just not what "autonomous" implies.
  4. I would not build unsupervised code-patching into a hospital-facility control system regardless of maturity - a bad autopatch corrupting the scheduler mid-shift is a worse failure mode than the one it's trying to prevent.

---

## 6. Scope & Prioritization Philosophy

Given the suggested 4-6 hour effort window, this submission is deliberately scoped for **depth over breadth**. Priority order, in the order built and hardened:
1. **Dual-constraint scheduler** (battery + water as co-equal resources) - the mathematical core the rest depends on.
2. **Clean HAL** across the 3 required OEMs, with the 4th-OEM adapter as proof of the abstraction.
3. **3 disruptions handled end-to-end** (Detect -> Assess -> Re-plan -> Log): R-003 sterile-robot failure, R-008 water anomaly, R-005 WebSocket drop - these exercise human escalation, uncertainty under coarse telemetry, and distinguishing transient faults from real ones.
4. **Remaining 2 disruptions**, the bonus extensions (dock semaphore, outbound command adapter, floor-material water multipliers, enterprise benchmark), and the LLM/human-feedback layer (§5) were added once the core above was solid, not instead of it.

---

## 7. Assumptions & Ambiguity Handling

| Area | Assumption & Strategy |
|---|---|
| **Shift Duration & Cadence** | 12-hour night shift (7:00 PM - 7:00 AM). Simulated step size = 5 minutes per tick. |
| **Dock Capacity** | 2 dedicated water docks (Alpha at Z1, Beta at Z6) and 2 charging hub locations with combined capacity for 3 concurrent charge sessions (Main at Z3: capacity 2, Annex at Z8: capacity 1). Requests are arbitrated by nearest-dock-first with automatic reroute-to-alternate-dock when the primary is at capacity - not a FIFO queue. |
| **Battery Safety Margin** | Minimum SOC reserve threshold is 10%. |
| **Sterile Zone SLA Weights** | Sterile hospital zones (Z2 ED, Z5 Patient Halls, Z7 Radiology) carry a 10x cost-penalty multiplier in ML-proactive mode. |
| **Zone-to-Zone Travel** | Modeled geometrically within dock arbitration (~3-15 min based on facility coordinates); the flat "5 min + 2% battery per transition" figure from the original spec is implemented in the standalone `demo/` artifact but not yet folded into the core `optimizer.ts` scheduling pass - noted here rather than silently claimed. |

---

## 8. Shift Report & Consumable Tracking

The system tracks operational consumables and exports official facility audit records:
- **Water Consumption Tracking**: total clean water gallons consumed, completed 10-minute dump & refill cycles, and flagged water anomalies.
- **Binding Constraint Breakdown**: per-robot classification of whether battery SOC or water capacity was the binding operational constraint.
- **Export Formats**: Interactive Executive Preview Modal, Print / Save as PDF, CSV Spreadsheet Export, and TXT Audit File Export.

---

## 9. System Setup & Interactive Simulation Demo

### Installation & Local Development
```bash
# Install dependencies
npm install

# Required for the LLM layer (advisor, log parser, explain, assistant) - see .env.example
export ANTHROPIC_API_KEY="your-key-here"

# Run Vite local development server on port 3000
npm run dev
```
Without `ANTHROPIC_API_KEY` set, every LLM-backed feature falls back to a deterministic canned response rather than failing - the rest of the system (HAL, scheduler, dispatcher, dock manager, anomaly detector) has no dependency on it at all.

### Verification & Production Build
```bash
# Check TypeScript types
npx tsc --noEmit

# Run the test suite (36 tests: HAL, scheduler, disruptions, ML/anomaly, benchmark, human feedback, live proactive-risk monitor)
npm run test

# Build production bundle
npm run build
```

### Interactive Simulation Controls
1. **Live Dispatcher Playback**: use the top control bar to Play, Pause, Step, or Reset the 12-hour hospital shift simulation.
2. **Inject Ad-Hoc Customer Request**: trigger a 50,000 sq ft convention lobby cleaning request to test OR dynamic re-planning.
3. **Trigger Hardware Disruptions**: test R-003 sensor failure, R-008 water leak anomaly, or R-005 network drop directly from the Disruption Console. Note: the console starts empty at 7:00 PM - press Play or use the timeline stepper to reach the first scripted event (09:30 PM).
4. **Inspect HAL Telemetry**: view raw vs. normalized telemetry across AutoScrub, CleanPath, FloorBot, and CyberClean in the HAL Inspector tab.
5. **Ask the Fleet Assistant**: ask free-text questions about current fleet status - answers are grounded only in the live shift snapshot.
6. **Give Feedback on the FloorBot Leak Threshold**: in the Health tab, use the human-in-the-loop buttons to nudge the leak-flag threshold and watch the persisted multiplier change.
7. **Export Shift Audit Report**: view SLA compliance, water cycles, consumable metrics, and export via CSV, TXT, or PDF in the Shift Report tab.

---

## 10. Project Directory Structure

```
├── src/
│   ├── components/         # UI views
│   │   ├── Navbar.tsx
│   │   ├── SimulationControls.tsx
│   │   ├── FleetOverview.tsx
│   │   ├── ScheduleView.tsx
│   │   ├── HALInspector.tsx
│   │   ├── DisruptionConsole.tsx
│   │   ├── FleetHealthDashboard.tsx
│   │   ├── ShiftReportView.tsx
│   │   ├── PresentationDeck.tsx
│   │   ├── ExplainButton.tsx      (#1 - plain-language explainability)
│   │   └── FleetAssistant.tsx     (#2 - conversational fleet assistant tab)
│   ├── hal/                # Hardware Abstraction Layer & OEM Adapters
│   │   ├── IHALAdapter.ts
│   │   ├── AutoScrubAdapter.ts
│   │   ├── CleanPathAdapter.ts
│   │   ├── FloorBotAdapter.ts
│   │   ├── CyberCleanAdapter.ts (4th OEM Proof)
│   │   └── HALRegistry.ts
│   ├── scheduler/          # Dual-Constraint OR + ML Optimizer
│   │   ├── optimizer.ts
│   │   ├── dockManager.ts
│   │   └── proactiveReplanner.ts  (live re-plan eligibility logic, extracted for testability)
│   ├── ml/                 # Machine Learning Failure Predictor
│   │   └── failurePredictor.ts
│   ├── dispatcher/         # 12-Hour Shift Simulation Engine
│   │   └── simulationEngine.ts    (includes evaluateProactiveRiskMonitoring — live risk-driven re-planning)
│   ├── monitoring/         # Consumable Tracking, Anomaly Detector & Feedback Loop
│   │   ├── anomalyDetector.ts
│   │   └── humanFeedback.ts       (#3 - scoped human-in-the-loop tuning)
│   ├── server/             # Server-Side Claude AI Fleet Advisor & LLM Layer
│   │   └── claudeAdvisor.ts       (advisor, log parser, explain, assistant)
│   ├── data/               # Facility Zones & Robot Roster Data
│   │   ├── facility.ts
│   │   └── roster.ts
│   ├── __tests__/          # Vitest suite (36 tests)
│   │   ├── hal.test.ts
│   │   ├── scheduler.test.ts
│   │   ├── disruptions.test.ts
│   │   ├── ml_and_anomaly.test.ts
│   │   ├── benchmark.test.ts
│   │   ├── humanFeedback.test.ts
│   │   ├── proactiveReplanner.test.ts
│   │   └── simulationEngine.test.ts
│   └── types/              # Global TypeScript Definitions
│       └── index.ts
├── docs/
│   └── architecture-diagram.svg
├── demo/
│   ├── fleet-orchestrator-app.jsx  # standalone single-file React demo (see demo/README.md)
│   └── README.md
└── README.md
```

---

## 11. Demo

For an up-to-date interactive preview of the current logic, use `demo/fleet-orchestrator-app.jsx` (see `demo/README.md`), or run the actual project per §9.

An earlier, Gemini-based build of this system's UI is hosted at:
https://ai.studio/apps/04844540-54d5-4ad7-b8bf-23e44b945118?fullscreenApplet=true
**Note:**  that link reflects a snapshot from before this repository's code was migrated from Gemini to Claude and before the dual-constraint scheduler, HAL extensibility proof, and LLM/human-feedback layer (§5) were added - it will not match the code in `src/` exactly. 
