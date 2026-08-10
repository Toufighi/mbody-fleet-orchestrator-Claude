import React, { useState } from 'react';
import { FLEET_ROSTER } from '../data/roster';
import { globalHALRegistry } from '../hal/HALRegistry';
import { NormalizedTelemetry, OEMBrand } from '../types';
import { Cpu, ArrowRight, ShieldAlert, CheckCircle2, Code2, PlusCircle } from 'lucide-react';

interface HALInspectorProps {
  latestTelemetry: NormalizedTelemetry[];
}

export const HALInspector: React.FC<HALInspectorProps> = ({ latestTelemetry }) => {
  const [selectedRobotId, setSelectedRobotId] = useState('R-001');
  const [selectedCommand, setSelectedCommand] = useState<'start_mission' | 'pause' | 'return_to_dock' | 'ota_update'>('start_mission');
  const [dispatchResult, setDispatchResult] = useState<any | null>(null);
  const [show4thOEMDemo, setShow4thOEMDemo] = useState(false);

  const robotConfig = FLEET_ROSTER.find(r => r.id === selectedRobotId) || FLEET_ROSTER[0];
  const telemetry = latestTelemetry.find(t => t.robotId === selectedRobotId) || {
    robotId: selectedRobotId,
    oem: robotConfig.oem,
    timestamp: new Date().toISOString(),
    batteryPct: 88,
    waterPct: robotConfig.hasWaterTank ? 75 : null,
    coarseWaterLevel: robotConfig.oem === 'FloorBot' ? 'med' : null,
    waterMinutesEst: { min: 30, nominal: 45, max: 60 },
    position: { x: 12.4, y: 8.2, zoneId: 'Z1', uncertaintyMeters: 0.5 },
    status: 'cleaning',
    errorCode: null,
    rawPayload: robotConfig.oem === 'AutoScrub' 
      ? '{"device_id":"R-001","bat_lvl":88,"h2o_lvl":75,"pos_x":12.4,"pos_y":8.2,"status_code":"SCRUBBING","active_zone":"Z1"}'
      : robotConfig.oem === 'CleanPath'
      ? 'Protobuf<CleanPathTelemetry>{uuid:"R-004", battery:88%, pos_m:{x:12.4, y:8.2}, status_enum:2}'
      : '<floorbot><id>R-006</id><bat>88</bat><water>med</water><zone>Z1</zone><state>CLEANING</state></floorbot>',
    protocolFormat: robotConfig.oem === 'AutoScrub' ? 'MQTT/JSON' : robotConfig.oem === 'CleanPath' ? 'WebSocket/Protobuf' : 'HTTP/XML'
  };

  const handleDispatchCommand = () => {
    const res = globalHALRegistry.dispatchCommand(robotConfig.oem, selectedCommand, {
      robotId: selectedRobotId,
      zoneId: 'Z1',
      speed: 1.2
    });
    setDispatchResult(res);
  };

  return (
    <div className="space-y-6 text-white">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold tracking-tight">Hardware Abstraction Layer (HAL) Protocol Inspector</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Normalizes heterogeneous OEM protocols (MQTT JSON, WS Protobuf, HTTP XML) into a single internal schema.
          </p>
        </div>

        <button
          onClick={() => setShow4thOEMDemo(!show4thOEMDemo)}
          className="bg-purple-950/80 hover:bg-purple-900/80 border border-purple-800 text-purple-300 font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{show4thOEMDemo ? 'Hide 4th OEM Demo' : 'Demonstrate 4th OEM Extensibility'}</span>
        </button>
      </div>

      {/* 4th OEM Extensibility Demonstration Banner */}
      {show4thOEMDemo && (
        <div className="bg-purple-950/40 border border-purple-800/80 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-purple-200">
              Architectural Proof: Adding a 4th OEM (CyberClean CC-1000)
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The HAL architecture isolates OEM specifics. Adding CyberClean required creating <code className="bg-purple-900/80 px-1.5 py-0.5 rounded text-purple-200 font-mono">CyberCleanAdapter.ts</code> implementing <code className="bg-purple-900/80 px-1.5 py-0.5 rounded text-purple-200 font-mono">IHALAdapter</code> and calling <code className="bg-purple-900/80 px-1.5 py-0.5 rounded text-purple-200 font-mono">globalHALRegistry.registerAdapter()</code>. 
            <strong> Zero lines of code</strong> were changed in the Scheduler, Dispatcher, or Anomaly Monitoring layers!
          </p>
        </div>
      )}

      {/* Robot Selection Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {FLEET_ROSTER.map(r => (
          <button
            key={r.id}
            onClick={() => { setSelectedRobotId(r.id); setDispatchResult(null); }}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedRobotId === r.id
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {r.id} ({r.oem})
          </button>
        ))}
      </div>

      {/* Side-by-Side Payload Translation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Raw OEM Ingress Payload */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase text-slate-400 flex items-center space-x-1.5">
                <Code2 className="w-4 h-4 text-amber-400" />
                <span>Raw OEM Native Telemetry ({telemetry.protocolFormat})</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                {robotConfig.oem} Native Format
              </span>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-amber-200/90 overflow-x-auto border border-slate-800 leading-relaxed mb-4">
              {telemetry.rawPayload}
            </pre>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 block">OEM Specific Quirk Handling:</span>
            <p className="text-[11px] leading-normal">{robotConfig.quirkDescription}</p>
          </div>
        </div>

        {/* Normalized Common Internal Schema */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase text-slate-400 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Normalized Common Telemetry Schema</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Unified JSON
              </span>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto border border-slate-800 leading-relaxed mb-4">
{JSON.stringify({
  robotId: telemetry.robotId,
  oem: telemetry.oem,
  batteryPct: telemetry.batteryPct,
  waterPct: telemetry.waterPct,
  coarseWaterLevel: telemetry.coarseWaterLevel,
  waterMinutesEst: telemetry.waterMinutesEst,
  position: telemetry.position,
  status: telemetry.status,
  errorCode: telemetry.errorCode
}, null, 2)}
            </pre>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 block">System Normalization Guarantee:</span>
            <p className="text-[11px] leading-normal">
              Scheduler & Dispatcher interact ONLY with this schema. OEM API differences are completely hidden.
            </p>
          </div>
        </div>

      </div>

      {/* Unified Command Egress Dispatcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-purple-300 flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              <span>Bonus: Outbound HAL Command Adapter (IHALCommandAdapter)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Translates internal dispatcher actions into native OEM egress wire formats (MQTT JSON for AutoScrub, Protobuf for CleanPath, XML for FloorBot).
            </p>
          </div>

          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
            Interface: IHALCommandAdapter
          </span>
        </div>

        {/* Specialized Bonus Command Dispatch Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={async () => {
              const adapter = globalHALRegistry.getAdapter(robotConfig.oem);
              const res = await globalHALRegistry.sendReroute(selectedRobotId, robotConfig.oem, 'Z2');
              setDispatchResult({
                message: `[Bonus] Outbound sendReroute to ${selectedRobotId} via ${robotConfig.oem} Adapter (${adapter.getProtocolFormat()})`,
                nativePayload: res
              });
            }}
            className="bg-slate-950 border border-slate-800 hover:border-purple-500 p-3 rounded-xl text-left transition-all cursor-pointer space-y-1"
          >
            <span className="text-xs font-bold text-purple-300 block">1. sendReroute(robotId, newZoneId)</span>
            <span className="text-[10px] text-slate-400 block">Dispatches dynamic route change on impediment</span>
          </button>

          <button
            onClick={async () => {
              const adapter = globalHALRegistry.getAdapter(robotConfig.oem);
              const res = await globalHALRegistry.sendWaterDumpAndRefill(selectedRobotId, robotConfig.oem);
              setDispatchResult({
                message: `[Bonus] Outbound sendWaterDumpAndRefill to ${selectedRobotId} via ${robotConfig.oem} Adapter (${adapter.getProtocolFormat()})`,
                nativePayload: res
              });
            }}
            className="bg-slate-950 border border-slate-800 hover:border-cyan-500 p-3 rounded-xl text-left transition-all cursor-pointer space-y-1"
          >
            <span className="text-xs font-bold text-cyan-300 block">2. sendWaterDumpAndRefill(robotId)</span>
            <span className="text-[10px] text-slate-400 block">Commands tank purge & fresh water intake</span>
          </button>

          <button
            onClick={async () => {
              const adapter = globalHALRegistry.getAdapter(robotConfig.oem);
              const res = await globalHALRegistry.sendEmergencyStop(selectedRobotId, robotConfig.oem, 'Contamination Hazard');
              setDispatchResult({
                message: `[Bonus] Outbound sendEmergencyStop to ${selectedRobotId} via ${robotConfig.oem} Adapter (${adapter.getProtocolFormat()})`,
                nativePayload: res
              });
            }}
            className="bg-slate-950 border border-slate-800 hover:border-rose-500 p-3 rounded-xl text-left transition-all cursor-pointer space-y-1"
          >
            <span className="text-xs font-bold text-rose-300 block">3. sendEmergencyStop(robotId, reason)</span>
            <span className="text-[10px] text-slate-400 block">Triggers high-priority safety override</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <select
            value={selectedCommand}
            onChange={e => setSelectedCommand(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-white w-full sm:w-auto"
          >
            <option value="start_mission">START_MISSION</option>
            <option value="pause">PAUSE</option>
            <option value="return_to_dock">RETURN_TO_DOCK</option>
            <option value="ota_update">OTA_UPDATE_FIRMWARE</option>
          </select>

          <button
            onClick={handleDispatchCommand}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-purple-900/30 w-full sm:w-auto justify-center"
          >
            <span>Dispatch Generic Action via {robotConfig.oem} Adapter</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {dispatchResult && (
          <div className="bg-slate-950 border border-purple-800/60 p-4 rounded-xl text-xs font-mono space-y-2">
            <div className="text-purple-300 font-bold">{dispatchResult.message}</div>
            <pre className="text-slate-400 overflow-x-auto text-[11px]">
              {JSON.stringify(dispatchResult.nativePayload, null, 2)}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
};
