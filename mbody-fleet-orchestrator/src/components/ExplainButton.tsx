import React, { useState } from 'react';
import { HelpCircle, Loader2 } from 'lucide-react';

interface ExplainButtonProps {
  context: any;
  className?: string;
}

/**
 * #1 — Plain-language explainability. Drop this next to any scheduling/anomaly
 * outcome (an unassigned zone, a robot fault reason, a flagged anomaly) and it will
 * call the same Claude-backed explain endpoint the rest of the app uses, translating
 * that raw state into 2-3 sentences a non-technical operator can read.
 */
export const ExplainButton: React.FC<ExplainButtonProps> = ({ context, className = '' }) => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const explain = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
      });
      const data = await res.json();
      setExplanation(data.explanation || 'No explanation available.');
    } catch (err: any) {
      setError('Explanation unavailable right now.');
    } finally {
      setLoading(false);
    }
  };

  if (explanation) {
    return (
      <div className={`text-[10px] text-cyan-200/90 bg-slate-950 border border-cyan-900/40 rounded-lg p-2 mt-1.5 ${className}`}>
        {explanation}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={explain}
        disabled={loading}
        className="text-[10px] text-slate-500 hover:text-cyan-400 flex items-center space-x-1 cursor-pointer"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <HelpCircle className="w-3 h-3" />}
        <span>{loading ? 'Explaining…' : 'Explain in plain language'}</span>
      </button>
      {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
    </div>
  );
};
