import React from 'react';
import { FLEET_ROSTER } from '../data/roster';
import { RobotState } from '../types';
import { Battery, Droplet, Wifi, WifiOff, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

interface FleetOverviewProps {
  robotStates: Map<string, RobotState>;
}

export const FleetOverview: React.FC<FleetOverviewProps> = ({ robotStates }) => {
  return (
    <div className="space-y-6">
      
      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Active Fleet Roster</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-white font-mono">8</span>
            <span className="text-xs text-slate-400">Robots (3 OEMs)</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center space-x-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Normalized via HAL Adapter</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Sterile Certification</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-emerald-400 font-mono">1</span>
            <span className="text-xs text-slate-400">AS-900H (R-003)</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400/80 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Z2, Z5, Z7 Certified</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Water Constraint Scrubbers</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-cyan-400 font-mono">5</span>
            <span className="text-xs text-slate-400">/ 8 Wet Scrubbers</span>
          </div>
          <div className="mt-2 text-[11px] text-cyan-400/80 flex items-center space-x-1">
            <Droplet className="w-3.5 h-3.5" />
            <span>1.5h Water Cycle Limit</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Dry Cleaning Fleet</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-amber-400 font-mono">3</span>
            <span className="text-xs text-slate-400">CleanPath CP-V2/CP-X1</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-400/80 flex items-center space-x-1">
            <Battery className="w-3.5 h-3.5" />
            <span>Battery Only Constraint</span>
          </div>
        </div>

      </div>

      {/* Robot Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FLEET_ROSTER.map(config => {
          const state = robotStates.get(config.id);
          if (!state) return null;

          const isFault = state.status === 'fault';
          const isOffline = state.isOfflineMode;

          return (
            <div 
              key={config.id}
              className={`bg-slate-900 border rounded-2xl p-4 shadow-md transition-all relative overflow-hidden ${
                isFault 
                  ? 'border-red-500/80 bg-red-950/20 ring-1 ring-red-500/50' 
                  : isOffline 
                  ? 'border-indigo-500/80 bg-indigo-950/20' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header: Robot ID & OEM Brand */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-base font-bold text-white">{config.id}</span>
                  {config.isSterileCertified && (
                    <span className="bg-emerald-950 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-emerald-800">
                      STERILE
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    config.oem === 'AutoScrub' 
                      ? 'bg-blue-950 text-blue-300 border-blue-800' 
                      : config.oem === 'CleanPath' 
                      ? 'bg-purple-950 text-purple-300 border-purple-800' 
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {config.oem} ({config.model})
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="mb-3 flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center space-x-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    state.status === 'cleaning' ? 'bg-emerald-400 animate-pulse' :
                    state.status === 'charging' ? 'bg-blue-400 animate-pulse' :
                    state.status === 'refilling_water' ? 'bg-cyan-400 animate-pulse' :
                    state.status === 'offline_executing' ? 'bg-indigo-400 animate-ping' :
                    state.status === 'fault' ? 'bg-red-500' : 'bg-slate-500'
                  }`} />
                  <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                    {state.status.replace('_', ' ')}
                  </span>
                </div>

                <span className="font-mono text-[11px] text-slate-400">
                  {state.currentZoneId ? `Zone: ${state.currentZoneId}` : 'Docked'}
                </span>
              </div>

              {/* Gauges: Battery & Water */}
              <div className="space-y-2 mb-3">
                
                {/* Battery Bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span className="flex items-center space-x-1">
                      <Battery className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Battery</span>
                    </span>
                    <span className="font-mono font-bold text-slate-200">{Math.round(state.batteryPct)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        state.batteryPct <= 15 ? 'bg-red-500' : state.batteryPct <= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, state.batteryPct))}%` }}
                    />
                  </div>
                </div>

                {/* Water Tank Bar (Scrubbers Only) */}
                {config.hasWaterTank ? (
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                      <span className="flex items-center space-x-1">
                        <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Water Tank</span>
                      </span>
                      <span className="font-mono font-bold text-cyan-300">
                        {config.oem === 'FloorBot' 
                          ? `${(state.coarseWaterLevel || 'med').toUpperCase()} (~${state.waterMinutesRemainingEst?.nominal || 45}m)` 
                          : `${Math.round(state.waterPct ?? 100)}%`}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          (state.waterPct ?? 100) <= 20 ? 'bg-red-500' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, state.waterPct ?? 100))}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/40 p-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-500 text-center font-mono">
                    Dry Clean Only (No Water Constraint)
                  </div>
                )}

              </div>

              {/* Binding Constraint Badge */}
              <div className="flex items-center justify-between text-[10px] bg-slate-950 p-2 rounded-xl border border-slate-800/80 mb-2">
                <span className="text-slate-400 font-medium">Binding Constraint:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                  state.bindingConstraint === 'water' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                  state.bindingConstraint === 'battery' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {state.bindingConstraint.toUpperCase()}
                </span>
              </div>

              {/* OEM Quirk & Wi-Fi Notes */}
              <div className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/60 flex items-start space-x-1.5">
                {isOffline ? (
                  <WifiOff className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                )}
                <span className="line-clamp-2">{config.quirkDescription}</span>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
