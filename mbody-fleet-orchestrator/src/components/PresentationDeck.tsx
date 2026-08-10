import React, { useState } from 'react';
import { Presentation, ChevronRight, ChevronLeft, Cpu, Layers, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';

export const PresentationDeck: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'slide-1',
      title: 'Slide 1: Multi-OEM Hardware Abstraction Layer (HAL)',
      subtitle: 'Normalizing Heterogeneous Robot Interfaces & OEM Quirks',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-bold text-purple-300 text-sm block">1. Architectural Cleanliness (20% Weight)</span>
            <p className="text-slate-300">
              Robots come from 3 distinct OEMs: AutoScrub (REST API / MQTT JSON), CleanPath (gRPC API / WebSocket Protobuf), and FloorBot (Legacy HTTP CGI / XML Polling).
            </p>
            <p className="text-slate-300">
              The HAL defines a single interface (<code className="text-purple-300 font-mono">IHALAdapter</code>) exposing <code className="text-purple-300 font-mono">normalizeTelemetry()</code> and <code className="text-purple-300 font-mono">translateCommand()</code>. The Scheduler and Dispatcher never see OEM brands or protocols.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-blue-300 block mb-1">AutoScrub Adapter</span>
              <p className="text-slate-400 text-[11px]">
                Handles ±2m GPS drift via a 3-sample moving average smoothing filter.
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-purple-300 block mb-1">CleanPath Adapter</span>
              <p className="text-slate-400 text-[11px]">
                Handles WS floor transition drops via a 15-second grace period reconnect timer.
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-amber-300 block mb-1">FloorBot Adapter</span>
              <p className="text-slate-400 text-[11px]">
                Parses HTTP XML and maps coarse water buckets (High/Med/Low/Empty) into minute ranges.
              </p>
            </div>
          </div>

          <div className="bg-purple-950/40 p-3 rounded-xl border border-purple-800/80 text-purple-200 text-[11px]">
            <strong>Extensibility Proof:</strong> Adding a 4th OEM (e.g. CyberClean) requires creating ONLY 1 new adapter file without touching any scheduler or dispatcher code!
          </div>
        </div>
      )
    },
    {
      id: 'slide-2',
      title: 'Slide 2: Operations Research (OR) Deterministic Formulation',
      subtitle: 'Mathematical Objective Function, Decision Variables & Dual Constraints',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-bold text-cyan-300 text-sm block">1. Mathematical Objective Function</span>
            <p className="text-slate-300">
              <code className="bg-slate-900 text-cyan-300 px-2 py-1 rounded font-mono block my-1">
                Maximize Z = Sum(SqFt(z) * X(r,z,t)) - Lambda * Cost(r,t) - Mu * SLA_Penalty(z)
              </code>
              Subject to Decision Variables <code className="text-cyan-300 font-mono">X(r,z,t) in [0, 1]</code> (Robot r cleans Zone z at time t).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-emerald-300 block mb-1">Dual Consumable Constraints</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                • <strong>Battery Constraint:</strong> B(r, t+1) = B(r, t) - Drain(Task). Triggers 90m charging when B(r, t) &le; 10%.<br />
                • <strong>Water Tank Constraint:</strong> W(r, t+1) = W(r, t) - Consumption(Task). Triggers 10m refill when W(r, t) &le; 5m.<br />
                • <strong>Binding Equation:</strong> Capacity(r, t) = min(B(r, t), W(r, t)).
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-blue-300 block mb-1">Physical & Temporal Restrictions</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                • <strong>Zero Collision:</strong> Sum(X(r,z,t)) &le; 1 (Zone occupancy exclusivity).<br />
                • <strong>Sterile Certification:</strong> Sterile zones (z in [Z2, Z5, Z7]) require S(r) = 1 (AS-900H certification).<br />
                • <strong>Floor Surface:</strong> Carpet requires vacuum capability (CP-V2 / CP-X1).
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'slide-3',
      title: 'Slide 3: ML Proactive Planning vs Reactive Anomaly Recovery',
      subtitle: 'Predictive Interruption Costing (95% Confidence) & MTTR Estimation',
      content: (
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/60 space-y-2">
            <span className="font-bold text-purple-300 text-sm block">1. Proactive Planning Strategy (ML Risk Costing)</span>
            <p className="text-slate-300">
              Uses historical telemetry and sensor health vectors to estimate failure probability P_fault(r, t).
              <br />
              • <strong>95% Confidence Threshold Rule:</strong> If P_fault(r, t) &gt; 0.05, a penalty cost C_risk is added to that time window for robot r.
              <br />
              • Disincentivizes assigning critical sterile hospital zones to high-risk hardware during vulnerable time slots.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-amber-300 block mb-1">ML MTTR Model (Mean Time To Repair)</span>
              <p className="text-slate-300 text-[11px]">
                Predicts estimated repair time upon failure (e.g. 180 mins for R-003 UV sensor fault), allowing the solver to immediately calculate whether repair or human escalation yields minimal SLA impact.
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-emerald-300 block mb-1">Reactive Sensor Anomaly Detection</span>
              <p className="text-slate-300 text-[11px]">
                Monitors divergent sensor metrics (e.g. R-008 water consumption rate vs tank level) to detect leaks early (Leak Risk 82/100) and redirect to dock before running dry mid-cleaning.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'slide-4',
      title: 'Slide 4: Real-Time Dispatch & 5 Shift Disruptions',
      subtitle: 'Deterministic Failure Policies & Hospital Escalation Protocol',
      content: (
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-red-900/60">
              <span className="font-bold text-red-300 block mb-1">1. R-003 Sensor Fault (2:15 AM)</span>
              <p className="text-slate-300 text-[11px]">
                Only sterile robot fails. System triggers Human Ops Escalation Alert, logs SLA risk, provides manual technician override, and displays 180m MTTR.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-amber-900/60">
              <span className="font-bold text-amber-300 block mb-1">2. R-008 Water Leak Anomaly (10:30 PM)</span>
              <p className="text-slate-300 text-[11px]">
                FloorBot water "LOW" after 20m. Anomaly Engine flags leak risk (82/100) and dispatches R-008 to dock for inspection.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-purple-900/60">
              <span className="font-bold text-purple-300 block mb-1">3. R-005 WebSocket Drop (2:20 AM)</span>
              <p className="text-slate-300 text-[11px]">
                15s grace period timer holds connection state during floor transition. Auto-reconnected in 14.2s without false alert.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-indigo-900/60">
              <span className="font-bold text-indigo-300 block mb-1">4. Z8 Garage Offline Mission (9:30 PM)</span>
              <p className="text-slate-300 text-[11px]">
                Parking Garage has no WiFi. Pre-loaded mission handoff, autonomous execution, and batch reconciliation on return at 11:50 PM.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-blue-900/60 text-blue-200 text-[11px]">
            <strong>5. Security Escort Delay (1:00 AM):</strong> Security delay at Z5 Patient Halls handled via Dynamic Window Compression without breaking sterile SLA!
          </div>
        </div>
      )
    },
    {
      id: 'slide-5',
      title: 'Slide 5: LLM Hospital Dispatch Log & Message Integration',
      subtitle: 'Natural Language Staff Notes to Real-Time Constraint Updates',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-bold text-blue-300 text-sm block">Claude 3.5 Sonnet Hospital Staff Parser</span>
            <p className="text-slate-300">
              Hospital staff generate unstructured dispatch notes during shifts (e.g. "Emergency biohazard spill in ED Hallway Z2! Bump priority to critical!").
            </p>
            <p className="text-slate-300">
              Claude parses staff notes into structured scheduling parameters (<code className="text-blue-300 font-mono">zoneId</code>, <code className="text-blue-300 font-mono">priorityLevel</code>, <code className="text-blue-300 font-mono">sqFtEstimate</code>) and immediately triggers real-time schedule re-optimization!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'slide-6',
      title: 'Slide 6: Scope Summary — Deliverables vs. Bonus Roadmap',
      subtitle: 'Core MVP Assumptions & Future Architectural Extensions',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/60 space-y-2">
              <span className="font-bold text-emerald-300 text-sm block">Core MVP Deliverables Completed</span>
              <ul className="text-slate-300 text-[11px] space-y-1 list-disc pl-4">
                <li>Multi-OEM HAL with 3 adapters + CyberClean extension proof.</li>
                <li>Dual-resource solver (Battery $B$ & Water $W$ binding constraints).</li>
                <li>5 shift disruption scenarios with human escalation fallback.</li>
                <li>Sensor anomaly detector with leak scoring.</li>
                <li>LLM Hospital dispatch log parser & advisor.</li>
              </ul>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/60 space-y-2">
              <span className="font-bold text-purple-300 text-sm block">Bonus Extensions Roadmap</span>
              <ul className="text-slate-300 text-[11px] space-y-1 list-disc pl-4">
                <li>ML MTTR historical repair dataset fine-tuning.</li>
                <li>Multi-facility fleet re-balancing across regional campuses.</li>
                <li>Elevator integration protocol for multi-story autonomous navigation.</li>
                <li>Dynamic pricing model based on utility peak hours.</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 text-white max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-xl">
            <Presentation className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Technical Homework Architecture Presentation</h2>
            <p className="text-xs text-slate-400">30-Minute Candidate Interview Walkthrough Deck</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-mono text-xs text-slate-300 px-2">
            Slide {currentSlide + 1} / {slides.length}
          </span>
          <button
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Slide Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl min-h-[400px] flex flex-col justify-between">
        <div>
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-lg font-bold text-white tracking-tight">{slides[currentSlide].title}</h3>
            <p className="text-xs text-purple-400 font-medium mt-0.5">{slides[currentSlide].subtitle}</p>
          </div>

          <div>{slides[currentSlide].content}</div>
        </div>

        <div className="border-t border-slate-800/80 pt-4 mt-6 flex justify-between items-center text-[11px] text-slate-500">
          <span>MBody AI Candidate Submission • AI Lead Engineer Role</span>
          <span>Regional General Hospital Fleet Case Study</span>
        </div>
      </div>

    </div>
  );
};
