import React, { useState } from 'react';
import { SchedulePlan, ScheduledTask } from '../types';
import { FLEET_ROSTER } from '../data/roster';
import { FACILITY_ZONES } from '../data/facility';
import { Calendar, Droplet, Battery, Sparkles, AlertCircle, Plus, Layers, Clock, Droplets, Play, CheckCircle2 } from 'lucide-react';
import { globalDockManager, DockAssignmentResult } from '../scheduler/dockManager';

interface ScheduleViewProps {
  schedulePlan: SchedulePlan;
  onInjectAdHoc: (zoneName: string, sqFt: number, startMin: number, endMin: number) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ schedulePlan, onInjectAdHoc }) => {
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [adHocName, setAdHocName] = useState('Convention / Fundraiser Event');
  const [adHocSqFt, setAdHocSqFt] = useState(50000);
  const [adHocStartMin, setAdHocStartMin] = useState(360); // 1:00 AM

  // --- Fix 1: Dock Capacity Semaphore State ---
  const [contentionResults, setContentionResults] = useState<{
    robot1: DockAssignmentResult;
    robot2: DockAssignmentResult;
    robot3: DockAssignmentResult;
  } | null>(null);

  const handleSimulateContention = () => {
    globalDockManager.reset();
    const r1 = globalDockManager.evaluateAndReserveDock('R-001', 'Z1', 'water_refill', 420, 10);
    const r2 = globalDockManager.evaluateAndReserveDock('R-003', 'Z1', 'water_refill', 420, 10);
    const r3 = globalDockManager.evaluateAndReserveDock('R-008', 'Z1', 'water_refill', 420, 10);
    setContentionResults({ robot1: r1, robot2: r2, robot3: r3 });
  };

  // --- Fix 3: Zone Floor Material Matrix State ---
  const [selectedZoneId, setSelectedZoneId] = useState('Z8');
  const [simMinutes, setSimMinutes] = useState(60);
  const selectedZone = FACILITY_ZONES.find(z => z.id === selectedZoneId) || FACILITY_ZONES[7];
  const waterMultiplier = selectedZone.waterMultiplier ?? 1.0;

  const handleCreateAdHoc = (e: React.FormEvent) => {
    e.preventDefault();
    onInjectAdHoc(adHocName, adHocSqFt, adHocStartMin, adHocStartMin + 180);
    setShowAdHocModal(false);
  };

  const timeMarkers = [
    { min: 0, label: '7 PM' },
    { min: 120, label: '9 PM' },
    { min: 240, label: '11 PM' },
    { min: 360, label: '1 AM' },
    { min: 480, label: '3 AM' },
    { min: 600, label: '5 AM' },
    { min: 720, label: '7 AM' }
  ];

  return (
    <div className="space-y-6 text-white">
      
      {/* Header & Objectives Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold tracking-tight">Dual-Constraint Multi-OEM Schedule</h2>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
              schedulePlan.planningMode === 'ML_PROACTIVE'
                ? 'bg-purple-950 text-purple-300 border-purple-800'
                : 'bg-blue-950 text-blue-300 border-blue-800'
            }`}>
              {schedulePlan.planningMode === 'ML_PROACTIVE' ? 'ML Proactive Risk Solver' : 'OR Deterministic ILP Solver'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Optimizes Total Operating Cost (Sq Ft Cleaned/Shift) while maintaining 100% Sterile Hospital Zone SLA Compliance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Est. Sq Ft Cleaned</span>
            <span className="font-mono text-lg font-bold text-emerald-400">
              {schedulePlan.estimatedTotalSqFtCleaned.toLocaleString()} sq ft
            </span>
          </div>

          <button
            onClick={() => setShowAdHocModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-3 rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-blue-900/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Customer On-Demand Request</span>
          </button>
        </div>
      </div>

      {/* Math Formulation & Decision Variables Drawer */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-200 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>OR & ML Planning Formulation (Assignment Deliverable)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Binding Equation: min(Battery_m, Water_m)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="font-bold text-blue-300 block mb-1">1. OR Solution (Deterministic Solver)</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Uses decision variables X(r, z, t) in [0, 1] with binding physical constraints:
              <br />
              • Battery depletion B(r, t+1) = B(r, t) - Drain(Task)
              <br />
              • Water depletion W(r, t+1) = W(r, t) - Consumption(Task)
              <br />
              Schedules mandatory 10m water refill or 90m charge breaks before B or W reach zero.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="font-bold text-purple-300 block mb-1">2. ML Proactive Solution (Component Failure Risk)</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Queries <code className="text-purple-400">FailurePredictor</code> module for continuous P(failure | t). When risk exceeds $5\%$ ($95\%$ confidence threshold), the scheduler inflates window costs and routes tasks away from high-priority sterile zones.
              <br />
              • ML MTTR Model predicts 180 mins repair time upon hardware failure.
            </p>
          </div>
        </div>
      </div>

      {/* Legend & Color Codes */}
      <div className="bg-slate-900/80 border border-slate-800/80 p-3 rounded-xl flex flex-wrap items-center gap-4 text-xs">
        <span className="text-slate-400 font-medium">Task Legend:</span>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-emerald-600" />
          <span className="text-slate-300">Cleaning Zone</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-blue-600" />
          <span className="text-slate-300">Battery Charge (90m)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-cyan-500" />
          <span className="text-slate-300">Water Tank Refill (10m)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-purple-600" />
          <span className="text-slate-300">Sterile Sanitization (15m)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-amber-600" />
          <span className="text-slate-300">Ad-Hoc Event Task</span>
        </div>
      </div>

      {/* Gantt Chart Schedule Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl overflow-x-auto">
        
        {/* Timeline Axis Header */}
        <div className="min-w-[800px]">
          <div className="flex border-b border-slate-800 pb-2 mb-4">
            <div className="w-28 text-xs font-bold text-slate-400 uppercase">Robot ID</div>
            <div className="flex-1 grid grid-cols-6 relative">
              {timeMarkers.map(t => (
                <div key={t.min} className="text-xs font-mono text-slate-400 border-l border-slate-800 pl-1">
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* Robot Rows */}
          <div className="space-y-4">
            {FLEET_ROSTER.map(robot => {
              const robotTasks = schedulePlan.tasks.filter(t => t.robotId === robot.id);

              return (
                <div key={robot.id} className="flex items-center border-b border-slate-800/60 pb-3">
                  
                  {/* Robot Label */}
                  <div className="w-28 pr-2">
                    <div className="font-mono font-bold text-sm text-white">{robot.id}</div>
                    <div className="text-[10px] text-slate-400">{robot.oem} ({robot.model})</div>
                  </div>

                  {/* Robot Timeline Bar Container */}
                  <div className="flex-1 h-10 bg-slate-950/80 rounded-xl relative overflow-hidden border border-slate-800">
                    
                    {/* Time Grid Lines */}
                    <div className="absolute inset-0 grid grid-cols-6 pointer-events-none">
                      {timeMarkers.slice(0, 6).map(t => (
                        <div key={t.min} className="border-r border-slate-800/40 h-full" />
                      ))}
                    </div>

                    {/* Task Blocks */}
                    {robotTasks.map(task => {
                      const leftPct = (task.startTimeMinutes / 720) * 100;
                      const widthPct = (task.durationMinutes / 720) * 100;

                      let bgClass = 'bg-emerald-600 border-emerald-500';
                      if (task.isAdHoc) bgClass = 'bg-amber-600 border-amber-500 animate-pulse';
                      else if (task.taskType === 'charge') bgClass = 'bg-blue-600 border-blue-500';
                      else if (task.taskType === 'water_refill') bgClass = 'bg-cyan-600 border-cyan-500';
                      else if (task.taskType === 'sanitize') bgClass = 'bg-purple-600 border-purple-500';

                      const riskPct = task.predictedFailureRiskAtStart !== undefined ? Math.round(task.predictedFailureRiskAtStart * 100) : 0;

                      return (
                        <div
                          key={task.id}
                          style={{ left: `${leftPct}%`, width: `${Math.max(1.5, widthPct)}%` }}
                          className={`absolute top-1 bottom-1 rounded-lg border text-[10px] font-medium px-1.5 flex items-center justify-between text-white shadow-sm overflow-hidden transition-all ${bgClass}`}
                          title={`Task: ${task.taskType.toUpperCase()} | Zone: ${task.zoneId} | ML Risk: ${riskPct}% | Binding: ${task.bindingConstraintAtStart}`}
                        >
                          <span className="truncate font-mono font-bold">
                            {task.taskType === 'clean' ? task.zoneId : task.taskType.toUpperCase().slice(0, 5)}
                          </span>
                          {riskPct > 15 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 ml-1" title={`Elevated Failure Risk: ${riskPct}%`} />
                          )}
                        </div>
                      );
                    })}

                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ================= BONUS: DOCK CAPACITY SEMAPHORE & QUEUE MANAGER ================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-blue-300 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span>Bonus: Dock Capacity Semaphore & Queue Manager</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Evaluates concurrent dock reservations at 2:00 AM when R-001, R-003, and R-008 simultaneously request water refill.
            </p>
          </div>

          <button
            onClick={handleSimulateContention}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 shadow-lg shadow-blue-900/40 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Simulate 2:00 AM Dock Contention</span>
          </button>
        </div>

        {/* Docks Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {globalDockManager.getDocks().map(dock => {
            const activeReservations = globalDockManager.getReservations().filter(r => r.dockId === dock.id);
            return (
              <div key={dock.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{dock.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    Cap: {dock.capacity}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Zone: {dock.zoneId}</span>
                  <span className="font-mono text-cyan-300 uppercase">{dock.type}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800 text-[11px]">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">Reservations:</span>
                  {activeReservations.length === 0 ? (
                    <span className="text-slate-500 italic text-[10px]">No active reservations</span>
                  ) : (
                    activeReservations.map(res => (
                      <div key={res.id} className="flex justify-between items-center font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 mb-1">
                        <span className="text-emerald-400 font-bold">{res.robotId}</span>
                        <span className="text-slate-400">T+{res.startMin}m-T+{res.endMin}m</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {contentionResults ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-blue-800/60">
            <div className="bg-slate-900 p-3 rounded-xl border border-emerald-800/60 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-emerald-400 text-xs">R-001 (AutoScrub)</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-bold">{contentionResults.robot1.decision}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">{contentionResults.robot1.reasoning}</p>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-amber-800/60 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-amber-400 text-xs">R-003 (AS-900H)</span>
                <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-bold">{contentionResults.robot2.decision}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">{contentionResults.robot2.reasoning}</p>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-purple-800/60 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-purple-400 text-xs">R-008 (FloorBot)</span>
                <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded font-bold">{contentionResults.robot3.decision}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">{contentionResults.robot3.reasoning}</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950 p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
            Click <strong>"Simulate 2:00 AM Dock Contention"</strong> to test semaphore capacity allocation and queue vs reroute decisions.
          </div>
        )}
      </div>

      {/* ================= BONUS: ZONE FLOOR MATERIAL MATRIX ================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-cyan-300 flex items-center space-x-2">
            <Droplets className="w-5 h-5 text-cyan-400" />
            <span>Bonus: Zone Floor Material Matrix & Water Flow Multipliers</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Accounts for surface friction (Porous Concrete 1.4x flow multiplier, Epoxy 0.85x) during schedule optimization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-300 block">Select Zone to Test Friction Matrix:</span>
            <div className="grid grid-cols-2 gap-2">
              {FACILITY_ZONES.map(z => (
                <button
                  key={z.id}
                  onClick={() => setSelectedZoneId(z.id)}
                  className={`p-2 rounded-lg text-xs font-mono text-left transition-all cursor-pointer border ${
                    selectedZoneId === z.id
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-600 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-white">{z.id}: {z.name}</div>
                  <div className="text-[10px] text-amber-300">{z.floorMaterial || z.floorType} ({z.waterMultiplier}x)</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-cyan-800/60 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-cyan-300">{selectedZone.name} ({selectedZone.floorMaterial})</span>
              <span className="text-xs font-mono bg-cyan-950 text-cyan-200 px-2 py-0.5 rounded border border-cyan-800">
                Multiplier: {waterMultiplier}x
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Operation Duration:</span>
                <span className="font-mono font-bold text-white">{simMinutes} mins</span>
              </div>
              <input
                type="range"
                min={10}
                max={120}
                step={5}
                value={simMinutes}
                onChange={e => setSimMinutes(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Baseline Water Depleted:</span>
                <span className="font-mono text-slate-300">{simMinutes} mins</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-cyan-300">Material-Adjusted Water Depleted:</span>
                <span className="font-mono text-cyan-300">{(simMinutes * waterMultiplier).toFixed(1)} mins</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Because {selectedZone.floorMaterial} has a {waterMultiplier}x consumption multiplier, scrubber tanks deplete faster or slower, causing the scheduler to adjust water refill interval timing.
            </p>
          </div>
        </div>
      </div>

      {/* Ad-Hoc Request Modal */}
      {showAdHocModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Customer Ad-Hoc Shift Request</h3>
            </div>
            
            <p className="text-xs text-slate-400 mb-4">
              Simulates a hospital event request (e.g., 50,000 sq ft Lobby / Convention area tonight). The scheduler will dynamically rebalance non-critical dry/wet robot schedules to satisfy the request without breaking critical sterile SLAs.
            </p>

            <form onSubmit={handleCreateAdHoc} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Event / Zone Name</label>
                <input
                  type="text"
                  value={adHocName}
                  onChange={e => setAdHocName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Required Cleaning Area (Sq Ft)</label>
                <input
                  type="number"
                  value={adHocSqFt}
                  onChange={e => setAdHocSqFt(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Start Time (Minutes from 7 PM)</label>
                <select
                  value={adHocStartMin}
                  onChange={e => setAdHocStartMin(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value={180}>10:00 PM (t = 180m)</option>
                  <option value={360}>01:00 AM (t = 360m)</option>
                  <option value={480}>03:00 AM (t = 480m)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdHocModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-900/30"
                >
                  Re-Optimize Schedule Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
