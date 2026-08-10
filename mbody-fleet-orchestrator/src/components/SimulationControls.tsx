import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Zap, CheckCircle2 } from 'lucide-react';

interface SimulationControlsProps {
  currentMin: number;
  timeDisplay: string;
  isPlaying: boolean;
  speedMultiplier: number;
  onTogglePlay: () => void;
  onStep: (mins: number) => void;
  onJumpToTime: (min: number) => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  currentMin,
  timeDisplay,
  isPlaying,
  speedMultiplier,
  onTogglePlay,
  onStep,
  onJumpToTime,
  onReset,
  onSetSpeed
}) => {
  const hardcodedMilestones = [
    { min: 0, label: '07:00 PM', desc: 'Shift Start / Schedule Generated' },
    { min: 120, label: '09:00 PM', desc: 'Scrubbers Begin Lobby Z1' },
    { min: 150, label: '09:30 PM', desc: 'R-006 Dispatched Offline to Z8 Garage' },
    { min: 210, label: '10:30 PM', desc: 'Disruption #1: R-008 Water Anomaly' },
    { min: 240, label: '11:00 PM', desc: 'R-003 Sterile Sanitization Cycle' },
    { min: 290, label: '11:50 PM', desc: 'R-006 Returns & Syncs Z8 Garage' },
    { min: 360, label: '01:00 AM', desc: 'Security Escort Delay at Z5' },
    { min: 435, label: '02:15 AM', desc: 'Disruption #2: R-003 Sensor Fault' },
    { min: 440, label: '02:20 AM', desc: 'Disruption #3: R-005 WebSocket Drop' },
    { min: 660, label: '06:00 AM', desc: 'Shift Concluded / Report Generated' }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl text-white mb-6">
      
      {/* Top Playback Control Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        
        {/* Play / Pause / Reset / Step */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onTogglePlay}
            className={`p-3 rounded-xl font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            <span className="text-xs font-bold">{isPlaying ? 'Pause Shift' : 'Run Simulation'}</span>
          </button>

          <button
            onClick={() => onStep(15)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <FastForward className="w-4 h-4" />
            <span>+15m Step</span>
          </button>

          <button
            onClick={onReset}
            className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 p-2.5 rounded-xl transition-colors cursor-pointer"
            title="Reset Shift to 07:00 PM"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Shift Clock Display & Speed Toggle */}
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Current Shift Time</span>
            <span className="font-mono text-xl font-bold text-emerald-400 tracking-tight">{timeDisplay}</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-1 rounded-xl flex space-x-1">
            {[1, 10, 60].map(speed => (
              <button
                key={speed}
                onClick={() => onSetSpeed(speed)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  speedMultiplier === speed
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Scrub Slider */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>07:00 PM (Shift Start)</span>
          <span className="font-mono text-blue-400 font-semibold">{Math.round((currentMin / 720) * 100)}% Shift Progress</span>
          <span>07:00 AM (Shift End)</span>
        </div>
        <input
          type="range"
          min={0}
          max={720}
          step={5}
          value={currentMin}
          onChange={(e) => onJumpToTime(Number(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Hardcoded Disruption Timeline Stepper */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Assignment Disruption Timeline Stepper (Jump to Key Event)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {hardcodedMilestones.map((m) => {
            const isPassed = currentMin >= m.min;
            const isCurrent = Math.abs(currentMin - m.min) < 15;
            return (
              <button
                key={m.min}
                onClick={() => onJumpToTime(m.min)}
                className={`p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-900/60 border-blue-500 text-white shadow-md shadow-blue-950 ring-1 ring-blue-400'
                    : isPassed
                    ? 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono font-bold text-[11px] text-emerald-400">{m.label}</span>
                  {isPassed && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};
