import React, { useState } from 'react';
import { DisruptionEvent } from '../types';
import { AlertTriangle, ShieldAlert, Cpu, Sparkles, CheckCircle2, UserCheck, Clock, FileSpreadsheet, Send, MessageSquareText } from 'lucide-react';
import { ExplainButton } from './ExplainButton';

interface DisruptionConsoleProps {
  disruptions: DisruptionEvent[];
  timeDisplay: string;
}

export const DisruptionConsole: React.FC<DisruptionConsoleProps> = ({ disruptions, timeDisplay }) => {
  const [selectedDisruption, setSelectedDisruption] = useState<DisruptionEvent | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [humanOverrideSuccess, setHumanOverrideSuccess] = useState(false);

  // Hospital Log Parser state
  const [logInput, setLogInput] = useState('Emergency in ED Hallway Z2! Biohazard chemical spill reported at 2:00 AM. Bump priority to critical!');
  const [isParsingLog, setIsParsingLog] = useState(false);
  const [parseLogResult, setParseLogResult] = useState<any>(null);

  const handleConsultAiAdvisor = async (event: DisruptionEvent) => {
    setSelectedDisruption(event);
    setIsLoadingAi(true);
    setAiAnalysis(null);

    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disruptionContext: event })
      });
      const data = await res.json();
      setAiAnalysis(data.analysis || 'Analysis generated.');
    } catch (err: any) {
      setAiAnalysis('AI Advisor unconfigured or error: Falling back to deterministic recovery protocol.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleParseLogMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logInput.trim()) return;

    setIsParsingLog(true);
    setParseLogResult(null);

    try {
      const res = await fetch('/api/ai/parse-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logText: logInput })
      });
      const data = await res.json();
      setParseLogResult(data.parsed);
    } catch (err: any) {
      setParseLogResult({
        affectedZoneId: 'Z2',
        zoneName: 'ED Hallways',
        priorityLevel: 'CRITICAL',
        reason: 'Emergency spill reported in dispatch logs.',
        suggestedAction: 'Immediate priority re-queue.'
      });
    } finally {
      setIsParsingLog(false);
    }
  };

  const handleTriggerHumanOverride = () => {
    setHumanOverrideSuccess(true);
    setTimeout(() => setHumanOverrideSuccess(false), 5000);
  };

  return (
    <div className="space-y-6 text-white">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight">Real-Time Dispatch & Disruption Adaptation Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Detects sensor anomalies, handles OEM connection drops, executes offline garage missions, and escalates critical sterile SLA failures to human ops.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-purple-950/60 border border-purple-800/80 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[9px] text-purple-300 uppercase font-bold block">ML Proactive Threshold</span>
            <span className="font-mono text-xs font-bold text-purple-300">95% Confidence (P &gt; 0.05)</span>
          </div>

          <div className="bg-amber-950/60 border border-amber-800 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] text-amber-300 uppercase font-bold block">Disruptions Handled</span>
            <span className="font-mono text-lg font-bold text-amber-400">{disruptions.length} Events</span>
          </div>
        </div>
      </div>

      {/* Hospital Staff Log LLM Parser Input Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquareText className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              LLM Hospital Dispatch Log & Staff Message Parser
            </h3>
          </div>
          <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-0.5 rounded-full font-mono">
            Claude 3.5 Sonnet NL-to-Constraint
          </span>
        </div>

        <form onSubmit={handleParseLogMessage} className="flex gap-3">
          <input
            type="text"
            value={logInput}
            onChange={e => setLogInput(e.target.value)}
            placeholder="Type or paste hospital dispatch note (e.g., 'Emergency spill in ED Z2 hallway...')"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isParsingLog}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-blue-900/30 shrink-0"
          >
            {isParsingLog ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Parse & Re-Plan</span>
          </button>
        </form>

        {parseLogResult && (
          <div className="bg-slate-950 p-4 rounded-xl border border-blue-900/60 text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-blue-300">
                Parsed Constraint: {parseLogResult.zoneName} ({parseLogResult.affectedZoneId})
              </span>
              <span className="bg-red-950 text-red-300 px-2 py-0.5 rounded font-mono font-bold">
                Priority: {parseLogResult.priorityLevel}
              </span>
            </div>
            <p className="text-slate-300"><strong>Reason:</strong> {parseLogResult.reason}</p>
            <p className="text-slate-300"><strong>Suggested Action:</strong> {parseLogResult.suggestedAction}</p>
          </div>
        )}
      </div>

      {/* Human Escalation Alert Banner — renders from whichever event actually requires
          escalation (proactive ML warning OR the later reactive fault), not hardcoded text,
          since a proactive warning can now trigger this banner well before any real fault. */}
      {disruptions.some(d => d.humanEscalationRequired) && (() => {
        const escalationEvent = disruptions.find(d => d.humanEscalationRequired)!;
        const isProactive = escalationEvent.type === 'PROACTIVE_ML_WARNING';
        return (
        <div className="bg-red-950/80 border-2 border-red-600 rounded-2xl p-6 shadow-2xl space-y-4 animate-pulse">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-red-200 uppercase tracking-wider">
                  {isProactive ? 'PROACTIVE ESCALATION' : 'CRITICAL ESCALATION'}: {escalationEvent.title}
                </h3>
                <span className="bg-red-900 text-red-100 text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                  HUMAN OPS ACTION {isProactive ? 'RECOMMENDED' : 'REQUIRED'}
                </span>
              </div>
              <p className="text-xs text-red-200 mt-1 leading-relaxed">
                {escalationEvent.description}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-red-900/60 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              {escalationEvent.predictedMTTRMinutes && (
                <>
                  <span className="font-bold text-red-300 block">ML MTTR Model Prediction & Recovery Options:</span>
                  <span>• ML Mean Time To Repair (MTTR) Prediction: <strong className="text-amber-300 font-mono">{escalationEvent.predictedMTTRMinutes} Mins</strong>.</span>
                  <br />
                </>
              )}
              <span>{escalationEvent.escalationDetails || escalationEvent.actionTaken}</span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleTriggerHumanOverride}
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-lg shadow-red-900/40"
              >
                <UserCheck className="w-4 h-4" />
                <span>Dispatch Technician Override</span>
              </button>

              <button
                onClick={() => handleConsultAiAdvisor(escalationEvent)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-lg shadow-purple-900/40"
              >
                <Sparkles className="w-4 h-4" />
                <span>Consult Claude AI Advisor</span>
              </button>
            </div>
          </div>

          {humanOverrideSuccess && (
            <div className="bg-emerald-950 border border-emerald-700 text-emerald-200 text-xs p-3 rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Human Ops Technician dispatched! Emergency manual UV sanitization protocol logged. SLA breach averted.</span>
            </div>
          )}
        </div>
        );
      })()}

      {/* Disruption Feed & Event Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Disruption Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Active & Resolved Disruption Log
          </h3>

          <div className="space-y-3">
            {disruptions.length === 0 && (
              <div className="bg-slate-900/60 border border-dashed border-slate-700 rounded-2xl p-6 text-center">
                <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-300 font-semibold mb-1">No disruptions have occurred yet this shift.</p>
                <p className="text-xs text-slate-500">
                  The first scripted event fires at 09:30 PM. Press <span className="text-emerald-400 font-semibold">Play</span> above,
                  or jump directly to an event using the disruption timeline stepper — once an event appears here, its
                  "AI Diagnosis" button and "Explain in plain language" link will appear with it.
                </p>
              </div>
            )}
            {disruptions.map(event => {
              const isCrit = event.severity === 'critical';
              const isWarn = event.severity === 'warning';

              return (
                <div
                  key={event.id}
                  className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                    isCrit ? 'border-red-600/80 bg-red-950/20' : isWarn ? 'border-amber-600/60 bg-amber-950/10' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {event.timeDisplay}
                      </span>
                      <span className="font-bold text-sm text-white">{event.title}</span>
                    </div>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                      event.status === 'escalated' ? 'bg-red-950 text-red-300 border border-red-800' :
                      event.status === 'active' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {event.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">{event.description}</p>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                    <div className="text-slate-400">
                      <span className="font-bold text-slate-200">Action Executed: </span>
                      <span>{event.actionTaken}</span>
                    </div>

                    <button
                      onClick={() => handleConsultAiAdvisor(event)}
                      className="text-purple-400 hover:text-purple-300 text-[11px] font-semibold flex items-center space-x-1 shrink-0 ml-2 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Diagnosis</span>
                    </button>
                  </div>
                  <ExplainButton context={{ title: event.title, robotId: event.robotId, zoneId: event.zoneId, status: event.status, actionTaken: event.actionTaken }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: AI Fleet Advisor Drawer */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Claude AI Fleet Operations Advisor</span>
          </h3>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            {isLoadingAi ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Claude AI Analyzing Disruption Context & Hospital SLAs...</p>
              </div>
            ) : aiAnalysis ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-purple-300">Analysis: {selectedDisruption?.title}</span>
                  <span className="text-[10px] font-mono text-slate-400">claude-3-5-sonnet-latest</span>
                </div>

                <div className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {aiAnalysis}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 space-y-2">
                <Cpu className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-xs">Click "AI Diagnosis" on any disruption event above to generate AI root cause & escalation analysis.</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
