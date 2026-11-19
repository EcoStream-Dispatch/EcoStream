import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StationState, Variant, ChangeoverSession } from '../types';
import { useBackend } from '../context/BackendContext';
import { useRole } from '../context/RoleContext';
import { 
  Wrench, Cpu, Eye, Layers, ArrowRight, Play, 
  RotateCcw, ShieldCheck, Clock, CheckCircle2, AlertTriangle
} from 'lucide-react';

export const StationOverview: React.FC = () => {
  const navigate = useNavigate();
  const { eventTicker } = useBackend();
  const { userName } = useRole();

  const [station, setStation] = useState<StationState | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [sessions, setSessions] = useState<ChangeoverSession[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string>('motor_b');
  const [starting, setStarting] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [st, vars, sess] = await Promise.all([
          api.getStation(),
          api.getVariants(),
          api.getChangeovers()
        ]);
        setStation(st);
        setVariants(vars);
        setSessions(sess);
      } catch (err) {
        console.error('Error fetching station data:', err);
      }
    };
    fetchData();
  }, [eventTicker]);

  const handleStartChangeover = async () => {
    try {
      setStarting(true);
      const session = await api.startChangeover(selectedVariant, userName);
      navigate(`/station/${session.id}`);
    } catch (err: any) {
      alert(`Could not start changeover: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  const handleReset = async () => {
    try {
      setResetting(true);
      await api.resetSim();
      const st = await api.getStation();
      setStation(st);
    } catch (err: any) {
      alert(`Reset error: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const currentVar = variants.find(v => v.id === station?.current_variant_id);

  return (
    <div className="py-8 px-4 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <Wrench className="w-3.5 h-3.5" />
            <span>Station WS-MOTOR-01 • Line 1 Manual Assembly</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-1">Workstation Operations</h1>
          <p className="text-sm text-slate-300">
            Real-time physical status, active tooling telemetry, and guided product changeover dispatch.
          </p>
        </div>

        <button
          onClick={handleReset}
          disabled={resetting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          Reset Workstation State
        </button>
      </div>

      {/* Station Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Variant Card */}
        <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-2">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Current Production Variant</div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span>{currentVar ? currentVar.name : station?.current_variant_id}</span>
          </div>
          <div className="text-xs font-mono text-emerald-400">
            Code: {currentVar?.code || 'MTR-A-STD'}
          </div>
        </div>

        {/* Mounted Fixture Tag Card */}
        <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-2">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Mounted Fixture</span>
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-mono font-bold text-white">
            {station?.mounted_fixture_tag || 'TAG-A-01'}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Overhead Vision Calibrated</span>
          </div>
        </div>

        {/* Tool Preset Card */}
        <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-2">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Smart Tool Preset</span>
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-lg font-bold text-white">
            {station?.tool_preset_name || 'Preset 1 (8.0 Nm)'}
          </div>
          <div className="text-xs font-mono text-sky-400">
            Target Torque: {station?.tool_torque_nm || 8.0} Nm (ESP32)
          </div>
        </div>

        {/* Loaded SOP Card */}
        <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-2">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Loaded Work Instruction</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span>{station?.loaded_sop_version || 'v2.0'}</span>
            {station?.loaded_sop_version === 'v2.0' ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                Superseded
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                Approved
              </span>
            )}
          </div>
          <div className="text-xs font-mono text-slate-400">
            {station?.loaded_sop_id || 'SOP-MTR-B-01'}
          </div>
        </div>
      </div>

      {/* Select Next Work Order Card */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-950 ring-1 ring-slate-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Select Next Work Order</h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose a target motor variant to compute the setup difference and launch the guided changeover workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {variants.map((v) => {
            const isSelected = selectedVariant === v.id;
            const isCurrent = station?.current_variant_id === v.id;

            return (
              <div
                key={v.id}
                onClick={() => setSelectedVariant(v.id)}
                className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-white">{v.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                        CURRENT ON LINE
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                    <div>Fixture: <span className="text-slate-200">{v.fixture_tag}</span></div>
                    <div>Tray: <span className="text-slate-200">{v.tray_tag}</span></div>
                    <div>Fasteners: <span className="text-slate-200">{v.fasteners}</span></div>
                    <div>Tool: <span className="text-slate-200">{v.tool_preset_name}</span></div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between text-xs border-t border-slate-800/80 mt-4">
                  <span className="text-slate-400">Approved SOP: {v.approved_sop_version}</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleStartChangeover}
            disabled={starting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {starting ? 'Launching Changeover...' : 'Start Guided Changeover ➔'}
          </button>
        </div>
      </div>

      {/* Active Changeover Sessions Queue */}
      {sessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Active & Recent Changeover Sessions
          </h3>

          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/station/${s.id}`)}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">{s.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                      s.status === 'completed' || s.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : s.status === 'sop_version_mismatch'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    Changeover to <span className="font-bold text-white">{s.to_variant}</span> • Operator: {s.operator}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                  <span>Deviations: {s.deviations.length}</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    Resume ➔
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
