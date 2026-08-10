import React, { useState } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { RobotState, SchedulePlan, DisruptionEvent } from '../types';

interface FleetAssistantProps {
  robotStates: Map<string, RobotState>;
  schedulePlan: SchedulePlan;
  disruptions: DisruptionEvent[];
  timeDisplay: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'Why is Z2 unassigned right now?',
  'Which robots are binding on water vs battery?',
  'What happened to R-003 tonight?',
  'Is any zone at risk of missing its window?'
];

/**
 * #2 — Conversational fleet assistant. Every answer is grounded ONLY in a JSON
 * snapshot of the current shift (robot states, schedule, disruptions so far) built
 * fresh on each question — it cannot answer from general knowledge, only from what's
 * actually true in this shift right now. See src/server/claudeAdvisor.ts#answerFleetQuestion.
 */
export const FleetAssistant: React.FC<FleetAssistantProps> = ({ robotStates, schedulePlan, disruptions, timeDisplay }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);

  const buildSnapshot = () => ({
    simTime: timeDisplay,
    robots: (Array.from(robotStates.values()) as RobotState[]).map(s => ({
      id: s.id, batteryPct: s.batteryPct, waterPct: s.waterPct, coarseWaterLevel: s.coarseWaterLevel,
      status: s.status, currentZoneId: s.currentZoneId, bindingConstraint: s.bindingConstraint, errorCode: s.errorCode
    })),
    scheduleTasks: schedulePlan.tasks.map(t => ({ robotId: t.robotId, zoneId: t.zoneId, taskType: t.taskType, bindingConstraintAtStart: t.bindingConstraintAtStart })),
    disruptionsSoFar: disruptions.map(d => ({ title: d.title, robotId: d.robotId, zoneId: d.zoneId, status: d.status, timeDisplay: d.timeDisplay }))
  });

  const ask = async (question: string) => {
    if (!question.trim() || asking) return;
    setMessages(m => [...m, { role: 'user', text: question }]);
    setInput('');
    setAsking(true);
    try {
      const recentHistory = messages.slice(-4);
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, shiftSnapshot: buildSnapshot(), recentHistory })
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'assistant', text: data.answer || 'No answer available.' }]);
    } catch (err: any) {
      setMessages(m => [...m, { role: 'assistant', text: 'Could not reach the assistant — try again.' }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-4 text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
        <div className="flex items-center space-x-2 mb-1">
          <MessageSquare className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold tracking-tight uppercase">Fleet Assistant</h2>
        </div>
        <p className="text-xs text-slate-400">
          Ask about current fleet status. Answers are grounded only in this shift's live snapshot, not general knowledge.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl min-h-[200px] max-h-[420px] overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => ask(s)}
                className="text-xs text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-800 rounded-full px-3 py-1.5 cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm rounded-xl px-3 py-2 max-w-[85%] ${
              m.role === 'user' ? 'bg-blue-950 border border-blue-800 text-blue-100 ml-auto' : 'bg-slate-950 border border-slate-800 text-slate-200'
            }`}
          >
            {m.text}
          </div>
        ))}
        {asking && (
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>thinking…</span>
          </div>
        )}
      </div>

      <div className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(input); }}
          placeholder="Ask about fleet status, e.g. 'why is Z5 partial?'"
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
        />
        <button
          type="button"
          onClick={() => ask(input)}
          disabled={asking || !input.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer"
        >
          {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
