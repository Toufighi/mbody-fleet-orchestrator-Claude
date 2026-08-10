import React from 'react';
import { 
  Bot, 
  Calendar, 
  Cpu, 
  AlertTriangle, 
  BarChart3, 
  FileText, 
  Presentation, 
  Clock, 
  Activity,
  Zap,
  MessageSquare
} from 'lucide-react';

export type TabType = 
  | 'dashboard' 
  | 'schedule' 
  | 'hal' 
  | 'disruptions' 
  | 'health' 
  | 'assistant'
  | 'report' 
  | 'presentation';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  timeDisplay: string;
  activeAlertsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  timeDisplay,
  activeAlertsCount
}) => {
  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Fleet Dashboard', icon: Bot },
    { id: 'schedule', label: 'Schedule Optimizer', icon: Calendar },
    { id: 'hal', label: 'HAL Protocol Layer', icon: Cpu },
    { id: 'disruptions', label: 'Disruption Console', icon: AlertTriangle },
    { id: 'health', label: 'Health & Anomalies', icon: BarChart3 },
    { id: 'assistant', label: 'Fleet Assistant', icon: MessageSquare },
    { id: 'report', label: 'Shift Report', icon: FileText },
    { id: 'presentation', label: 'Candidate Interview Deck', icon: Presentation }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Site Info */}
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">MBody AI</span>
                <span className="bg-blue-950 text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-800 font-mono">
                  Orchestrator v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">Regional General Hospital • Tuesday Night Shift</p>
            </div>
          </div>

          {/* Shift Time Badge & Alert Counter */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-300">Shift Clock:</span>
              <span className="font-mono text-sm font-bold text-emerald-300">{timeDisplay}</span>
            </div>

            {activeAlertsCount > 0 ? (
              <button 
                onClick={() => setActiveTab('disruptions')}
                className="bg-amber-950/80 border border-amber-800/80 text-amber-300 px-3 py-1.5 rounded-lg flex items-center space-x-2 animate-pulse cursor-pointer hover:bg-amber-900/80 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold">{activeAlertsCount} Active Disruption{activeAlertsCount > 1 ? 's' : ''}</span>
              </button>
            ) : (
              <div className="bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 px-3 py-1.5 rounded-lg flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-medium">Fleet Nominal</span>
              </div>
            )}
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800 scrollbar-none">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
};
