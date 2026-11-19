import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ChangeoverSession, StationState, Deviation } from '../types';
import { useBackend } from '../context/BackendContext';
import { useRole } from '../context/RoleContext';
import { CameraViewSVG } from '../components/CameraViewSVG';
import { 
  CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, 
  RotateCcw, Eye, Cpu, User, Layers, HelpCircle, 
  ChevronDown, ChevronUp, Loader2, Sparkles, X
} from 'lucide-react';

export const ChangeoverGuide: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { eventTicker } = useBackend();
  const { role, userName } = useRole();

  const [session, setSession] = useState<ChangeoverSession | null>(null);
  const [station, setStation] = useState<StationState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [showDiffModal, setShowDiffModal] = useState<boolean>(false);
  const [showSimPanel, setShowSimPanel] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'instructions' | 'telemetry'>('instructions');

  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [supervisorPin, setSupervisorPin] = useState<string>('1234');
  const [approvalNotes, setApprovalNotes] = useState<string>('Verified all changeover steps against SOP.');
  const [approving, setApproving] = useState<boolean>(false);

  // Fetch session & station
  const fetchState = async () => {
    if (!id) return;
    try {
      const [sess, st] = await Promise.all([
        api.getChangeover(id),
        api.getStation()
      ]);
      setSession(sess);
      setStation(st);
    } catch (err: any) {
      console.error('Error loading changeover session:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, [id, eventTicker]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
        <div className="text-sm font-mono text-slate-400">Loading guided changeover session {id}…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <div className="text-lg font-bold text-white">Changeover Session Not Found</div>
        <p className="text-xs text-slate-400">The requested session ID does not exist or has expired.</p>
        <button
          onClick={() => navigate('/station')}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
        >
          Return to Station Overview
        </button>
      </div>
    );
  }

  const activeStep = session.steps[session.current_step_index];
  const allStepsPassed = session.steps.every(s => s.status === 'passed');

  // Verification action (minimum 1000ms delay for visual feedback)
  const handleVerifyStep = async (stepId: string) => {
    setVerifying(true);
    const start = Date.now();
    try {
      await api.verifyStep(session.id, stepId);
      const elapsed = Date.now() - start;
      if (elapsed < 1000) {
        await new Promise(r => setTimeout(r, 1000 - elapsed));
      }
      await fetchState();
    } catch (err: any) {
      const elapsed = Date.now() - start;
      if (elapsed < 1000) {
        await new Promise(r => setTimeout(r, 1000 - elapsed));
      }
      await fetchState();
      alert(`Verification Check: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // Confirmation action for manual steps
  const handleConfirmStep = async (stepId: string) => {
    setVerifying(true);
    const start = Date.now();
    try {
      await api.confirmStep(session.id, stepId, 'Confirmed by operator');
      const elapsed = Date.now() - start;
      if (elapsed < 1000) {
        await new Promise(r => setTimeout(r, 1000 - elapsed));
      }
      await fetchState();
    } catch (err: any) {
      await fetchState();
      alert(`Confirm Check: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // Reload approved SOP
  const handleReloadSop = async () => {
    try {
      setVerifying(true);
      await api.reloadSop(session.id);
      await fetchState();
    } catch (err: any) {
      alert(`Error reloading SOP: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // Request supervisor approval
  const handleRequestApproval = async () => {
    try {
      setVerifying(true);
      await api.requestApproval(session.id);
      await fetchState();
    } catch (err: any) {
      alert(`Request Approval Error: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // Approve changeover
  const handleApprove = async () => {
    try {
      setApproving(true);
      const psp = await api.approveChangeover(session.id, supervisorPin, userName, approvalNotes);
      setShowApprovalModal(false);
      navigate(`/passports/${psp.id}`);
    } catch (err: any) {
      alert(`Approval Failed: ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  // Quick simulation injector actions
  const injectStationState = async (updates: Partial<StationState>) => {
    try {
      await api.updateSimStation(updates);
      await fetchState();
    } catch (err: any) {
      alert(`Sim update error: ${err.message}`);
    }
  };

  return (
    <div className="py-6 px-4 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Session Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-400">{session.id}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
              session.status === 'completed' || session.status === 'approved'
                ? 'bg-emerald-500/20 text-emerald-300'
                : session.status === 'sop_version_mismatch'
                ? 'bg-rose-500/20 text-rose-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}>
              {session.status.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Target: <strong className="text-white uppercase">{session.to_variant}</strong>
            </span>
          </div>
          <div className="text-xs text-slate-300">
            Station: <strong>{session.station_id}</strong> • Operator: {session.operator} • Loaded SOP: <span className="font-mono text-emerald-400">{session.sop_id} {session.sop_version}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiffModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            Why only these steps?
          </button>
          <button
            onClick={() => setShowSimPanel(!showSimPanel)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Simulation Controls
            {showSimPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Simulation Edge Controls Panel (Collapsible) */}
      {showSimPanel && (
        <div className="p-5 rounded-3xl bg-slate-900/90 ring-1 ring-amber-500/40 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Simulation Controls (Fault Injection & Physical Telemetry)
            </span>
            <span className="text-[11px] text-slate-400">Demo only: Alters real backend station hardware state</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <button
              onClick={() => injectStationState({ mounted_fixture_tag: 'TAG-A-01' })}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-left text-slate-200"
            >
              <div className="font-bold text-amber-400">Inject Wrong Fixture</div>
              <div className="text-[10px] text-slate-400 mt-1">Set TAG-A-01 (Fixture A)</div>
            </button>

            <button
              onClick={() => injectStationState({ mounted_fixture_tag: 'TAG-B-02' })}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500 text-left text-slate-200"
            >
              <div className="font-bold text-emerald-400">Mount Correct Fixture</div>
              <div className="text-[10px] text-slate-400 mt-1">Set TAG-B-02 (Fixture B)</div>
            </button>

            <button
              onClick={() => injectStationState({ tool_preset_id: 'preset_1', tool_preset_name: 'Preset 1 (8.0 Nm)', tool_torque_nm: 8.0 })}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-left text-slate-200"
            >
              <div className="font-bold text-amber-400">Tool on Preset A</div>
              <div className="text-[10px] text-slate-400 mt-1">Preset 1 (8.0 Nm)</div>
            </button>

            <button
              onClick={() => injectStationState({ tool_preset_id: 'preset_2', tool_preset_name: 'Preset 2 (12.5 Nm)', tool_torque_nm: 12.5 })}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500 text-left text-slate-200"
            >
              <div className="font-bold text-emerald-400">Tool on Preset B</div>
              <div className="text-[10px] text-slate-400 mt-1">Preset 2 (12.5 Nm)</div>
            </button>
          </div>
        </div>
      )}

      {/* Outdated SOP Warning Banner if applicable */}
      {session.status === 'sop_version_mismatch' && (
        <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-base text-rose-300">Outdated SOP Version Loaded on Station Terminal</div>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Workstation terminal currently has loaded <strong>v2.0 (Superseded)</strong>. Quality Engineering requires <strong>v2.1 (Approved)</strong>. Changeover execution is blocked until synchronized.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleReloadSop}
              disabled={verifying}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              Reload Approved SOP v2.1
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Tablet-First Layout (Step Progress + Step Workspace + Telemetry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step Progress Rail (Left 4 cols on desktop) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-4 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-3">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider px-2">
              Setup Sequence ({session.steps.filter(s => s.status === 'passed').length}/{session.steps.length} Complete)
            </div>

            <div className="space-y-2">
              {session.steps.map((s, idx) => {
                const isActive = idx === session.current_step_index;
                const isPassed = s.status === 'passed';
                const isFailed = s.status === 'failed';

                return (
                  <div
                    key={s.step_id}
                    className={`p-3.5 rounded-2xl border transition flex items-start gap-3 select-none ${
                      isActive
                        ? isFailed
                          ? 'bg-rose-950/30 border-rose-500/50 ring-1 ring-rose-500/40'
                          : 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/40'
                        : isPassed
                        ? 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                        : 'bg-slate-950/20 border-slate-900 text-slate-500'
                    }`}
                  >
                    {/* Status Icon */}
                    <div className="mt-0.5">
                      {isPassed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : isFailed ? (
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                      ) : isActive ? (
                        <div className="w-5 h-5 rounded-full border-2 border-emerald-400 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center font-mono text-[10px] text-slate-500">
                          {s.order}
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white truncate">{s.title}</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {s.verification_type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{s.sop_ref}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step Workspace & Action View (Right 8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeStep && session.status !== 'completed' && session.status !== 'approved' ? (
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-6">
              {/* Step Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                    Step {activeStep.order} of {session.steps.length} • {activeStep.sop_ref}
                  </div>
                  <h2 className="text-2xl font-bold text-white mt-1">{activeStep.title}</h2>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
                  {activeStep.verification_type === 'camera' && <Eye className="w-4 h-4 text-emerald-400" />}
                  {activeStep.verification_type === 'esp32' && <Cpu className="w-4 h-4 text-sky-400" />}
                  {activeStep.verification_type === 'operator' && <User className="w-4 h-4 text-amber-400" />}
                  <span className="capitalize">{activeStep.verification_type} Verified</span>
                </div>
              </div>

              {/* Instructions text */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                <div className="text-xs font-bold text-slate-300">Standard Work Instruction:</div>
                <p className="text-sm text-slate-200 leading-relaxed">{activeStep.description}</p>
                <div className="text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/60">
                  Expected Telemetry / Parameter: <strong className="text-emerald-400">{activeStep.expected_value}</strong>
                </div>
              </div>

              {/* Deviation Alert Card if failed */}
              {activeStep.status === 'failed' && (
                <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-rose-300">{activeStep.error_message || 'Verification Mismatch'}</div>
                      <p className="text-xs text-rose-200/90 leading-relaxed">
                        Station hardware telemetry reports <strong>{activeStep.actual_value || 'None'}</strong>, but changeover specification requires <strong>{activeStep.expected_value}</strong>.
                      </p>
                      <div className="text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/60 mt-2">
                        <strong>Rule-Based Fix:</strong> Correct physical mounting or preset, then trigger re-check.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Telemetry Visualizer Preview in Step */}
              {activeStep.verification_type === 'camera' && station && (
                <div className="space-y-2">
                  <div className="text-xs font-mono text-slate-400">Live Overhead Camera Feed:</div>
                  <CameraViewSVG
                    mountedFixtureTag={station.mounted_fixture_tag}
                    expectedFixtureTag={activeStep.step_id === 'step_fixture' ? activeStep.expected_value : undefined}
                    mountedTrayTag={station.tray_tag}
                    expectedTrayTag={activeStep.step_id === 'step_tray' ? activeStep.expected_value : undefined}
                    cameraOnline={station.camera_online}
                  />
                </div>
              )}

              {activeStep.verification_type === 'esp32' && station && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-slate-400">Live ESP32 Tool Telemetry:</div>
                    <div className="text-lg font-bold text-white mt-1">{station.tool_preset_name}</div>
                    <div className="text-xs text-slate-400">Torque: {station.tool_torque_nm} Nm (Target: 12.5 Nm)</div>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                </div>
              )}

              {/* Big Touch Target Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-4">
                {activeStep.verification_type === 'operator' ? (
                  <button
                    onClick={() => handleConfirmStep(activeStep.step_id)}
                    disabled={verifying || session.status === 'sop_version_mismatch'}
                    className="min-h-[56px] px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Validating Operator Confirmation…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Confirm & Complete Step {activeStep.order}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleVerifyStep(activeStep.step_id)}
                    disabled={verifying || session.status === 'sop_version_mismatch'}
                    className="min-h-[56px] px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Checking Sensors (1 s visibility)…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        {activeStep.status === 'failed' ? 'Re-check Step Telemetry' : 'Verify Step with Edge Telemetry'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Changeover All Steps Completed State */
            <div className="p-8 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">All Changeover Setup Steps Verified</h3>
                <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                  Every fixture, component tray, fastener bin, smart tool preset, and quality inspection item has been validated against approved SOP {session.sop_id} {session.sop_version}.
                </p>
              </div>

              {session.status === 'completed' || session.status === 'approved' ? (
                <div className="pt-2">
                  <button
                    onClick={() => navigate(`/passports/${session.passport_id}`)}
                    className="min-h-[56px] px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm inline-flex items-center gap-2 transition"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    Open Digital Changeover Passport
                  </button>
                </div>
              ) : (
                <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={handleRequestApproval}
                    disabled={verifying}
                    className="min-h-[56px] px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition"
                  >
                    Request Supervisor Signoff
                  </button>

                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="min-h-[56px] px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm inline-flex items-center gap-2 transition shadow-lg shadow-emerald-500/20"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    Approve as Supervisor (PIN 1234)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Deviations Recorded Card */}
          {session.deviations.length > 0 && (
            <div className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-4">
              <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Recorded Deviations & Corrections Log ({session.deviations.length})</span>
                <span className="text-emerald-400 text-[11px]">Audit Tracked</span>
              </div>

              <div className="space-y-3">
                {session.deviations.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{d.step_title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        d.corrected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {d.corrected ? 'Corrected' : 'Active Deviation'}
                      </span>
                    </div>
                    <div className="text-slate-300">{d.explanation}</div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Expected: {d.expected} • Actual: {d.actual}</span>
                      {d.corrected && <span className="text-emerald-400">Fixed at {new Date(d.corrected_at!).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* "Why only these steps?" Modal */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="font-bold text-white text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-400" />
                Changeover Configuration Diff Analysis
              </div>
              <button
                onClick={() => setShowDiffModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Unlike traditional monolithic paper checklists that force operators to review 40+ static lines, <strong>EcoStream Dispatch</strong> dynamically diffs the engineering parameters between <strong>{session.from_variant}</strong> and <strong>{session.to_variant}</strong>, guiding only the steps that actually change.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {session.steps.map((s) => (
                <div key={s.step_id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-white">{s.title}</div>
                  <div className="text-emerald-400 font-mono text-[11px]">{s.diff_reason}</div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Close Diff Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Approval Modal (PIN 1234) */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="font-bold text-white text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Supervisor Signoff & Passport Generation
              </div>
              <button onClick={() => setShowApprovalModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Supervisor PIN (Demo PIN: 1234)</label>
                <input
                  type="password"
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  placeholder="Enter PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Signoff Notes</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                Signing generates an immutable <strong>Digital Changeover Passport</strong> with SHA-256 cryptographic verification.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approving || !supervisorPin}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Sign & Generate Passport
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
