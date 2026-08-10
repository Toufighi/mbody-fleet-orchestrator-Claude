import { useState, useEffect } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { SimulationControls } from './components/SimulationControls';
import { FleetOverview } from './components/FleetOverview';
import { ScheduleView } from './components/ScheduleView';
import { HALInspector } from './components/HALInspector';
import { DisruptionConsole } from './components/DisruptionConsole';
import { FleetHealthDashboard } from './components/FleetHealthDashboard';
import { ShiftReportView } from './components/ShiftReportView';
import { PresentationDeck } from './components/PresentationDeck';
import { FleetAssistant } from './components/FleetAssistant';
import { globalSimulationEngine } from './dispatcher/simulationEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [simState, setSimState] = useState(globalSimulationEngine.getSnapshot());

  useEffect(() => {
    const unsubscribe = globalSimulationEngine.subscribe(() => {
      setSimState(globalSimulationEngine.getSnapshot());
    });
    return () => unsubscribe();
  }, []);

  // Timer interval for simulation playback
  useEffect(() => {
    if (!simState.isPlaying) return;

    const interval = setInterval(() => {
      globalSimulationEngine.stepMinutes(5);
    }, 1000 / simState.speedMultiplier);

    return () => clearInterval(interval);
  }, [simState.isPlaying, simState.speedMultiplier]);

  return (
    <div className="min-h-screen bg-[#0a0c10] font-sans antialiased text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* Global Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timeDisplay={simState.timeDisplay}
        activeAlertsCount={simState.activeAlertsCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Simulation Playback & Hardcoded Disruption Timeline Stepper */}
        <SimulationControls
          currentMin={simState.currentMinutesFrom1900}
          timeDisplay={simState.timeDisplay}
          isPlaying={simState.isPlaying}
          speedMultiplier={simState.speedMultiplier}
          onTogglePlay={() => globalSimulationEngine.togglePlayPause()}
          onStep={(mins) => globalSimulationEngine.stepMinutes(mins)}
          onJumpToTime={(min) => globalSimulationEngine.jumpToTime(min)}
          onReset={() => globalSimulationEngine.initializeState()}
          onSetSpeed={(speed) => globalSimulationEngine.setSpeedMultiplier(speed)}
        />

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <FleetOverview robotStates={simState.robotStates} />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView
            schedulePlan={simState.schedulePlan}
            onInjectAdHoc={(name, sqFt, start, end) => {
              globalSimulationEngine.injectCustomerAdHocRequest(name, sqFt, start, end);
            }}
          />
        )}

        {activeTab === 'hal' && (
          <HALInspector latestTelemetry={simState.latestNormalizedTelemetry} />
        )}

        {activeTab === 'disruptions' && (
          <DisruptionConsole
            disruptions={simState.disruptions}
            timeDisplay={simState.timeDisplay}
          />
        )}

        {activeTab === 'health' && (
          <FleetHealthDashboard robotStates={simState.robotStates} />
        )}

        {activeTab === 'assistant' && (
          <FleetAssistant
            robotStates={simState.robotStates}
            schedulePlan={simState.schedulePlan}
            disruptions={simState.disruptions}
            timeDisplay={simState.timeDisplay}
          />
        )}

        {activeTab === 'report' && (
          <ShiftReportView
            schedulePlan={simState.schedulePlan}
            zoneStates={simState.zoneStates}
            disruptions={simState.disruptions}
            timeDisplay={simState.timeDisplay}
          />
        )}

        {activeTab === 'presentation' && (
          <PresentationDeck />
        )}

      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>MBody AI Multi-OEM Fleet Orchestration System • Regional General Hospital</p>
      </footer>

    </div>
  );
}
