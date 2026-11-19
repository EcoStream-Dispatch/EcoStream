import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { 
  Sparkles, RotateCcw, Play, AlertTriangle, CheckCircle2, 
  ShieldCheck, FileText, Truck, ArrowRight, Loader2
} from 'lucide-react';

export const DemoControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentPassportId, setCurrentPassportId] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setStatusLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // Step 1: Reset demo
  const handleReset = async () => {
    try {
      setLoadingStep('reset');
      await api.resetSim();
      setCurrentSessionId(null);
      setCurrentPassportId(null);
      addLog('Reset simulation state to baseline seed.');
    } catch (err: any) {
      addLog(`Error resetting demo: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Step 2: Start Motor B Changeover
  const handleStartChangeover = async () => {
    try {
      setLoadingStep('start_chg');
      const session = await api.startChangeover('motor_b', 'Operator Jane Doe (Shift A)');
      setCurrentSessionId(session.id);
      addLog(`Started changeover session ${session.id} to Motor B. Status: ${session.status}`);
      // If SOP mismatch, reload approved SOP
      if (session.status === 'sop_version_mismatch') {
        addLog('Station loaded SOP v2.0 is superseded! Auto-reloading approved SOP v2.1...');
        const updated = await api.reloadSop(session.id);
        addLog(`Reloaded SOP v2.1. Changeover session status now: ${updated.status}`);
      }
    } catch (err: any) {
      addLog(`Error starting changeover: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Step 3: Inject "Fixture A still mounted"
  const handleInjectWrongFixture = async () => {
    try {
      setLoadingStep('inject_fixture');
      await api.updateSimStation({ mounted_fixture_tag: 'TAG-A-01' });
      addLog('Physical fault injected: Station has Fixture A (TAG-A-01) mounted.');
    } catch (err: any) {
      addLog(`Error injecting fault: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Step 4: Show the flag (Verify Step 1 and fail)
  const handleVerifyStepFailure = async () => {
    if (!currentSessionId) {
      addLog('Please start a changeover session first!');
      return;
    }
    try {
      setLoadingStep('verify_fail');
      const res = await api.verifyStep(currentSessionId, 'step_fixture');
      if (!res.passed) {
        addLog(`Verification failed as expected: ${res.message}. Deviation logged!`);
      } else {
        addLog(`Step verified passed.`);
      }
    } catch (err: any) {
      addLog(`Verify response: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Step 5: Fix it (Mount Fixture B)
  const handleFixFixture = async () => {
    if (!currentSessionId) {
      addLog('Please start a changeover session first!');
      return;
    }
    try {
      setLoadingStep('fix_fixture');
      // Update camera detection
      await api.sendTagDetection('TAG-B-02', 'fixture');
      addLog('Physical fix applied: Mounted Fixture B (TAG-B-02) locked with dowel pins.');
      // Re-verify
      const res = await api.verifyStep(currentSessionId, 'step_fixture');
      if (res.passed) {
        addLog('Re-verification PASSED: Deviation marked corrected!');
      } else {
        addLog(`Re-verification result: ${res.message}`);
      }
    } catch (err: any) {
      addLog(`Error fixing fixture: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Step 6: Run all remaining checks
  const handleRunAllChecks = async () => {
    if (!currentSessionId) {
      addLog('Please start a changeover session first!');
      return;
    }
    try {
      setLoadingStep('run_all');
      // Step 2: Tray
      await api.sendTagDetection('TRAY-B-02', 'tray');
      await api.verifyStep(currentSessionId, 'step_tray');
      addLog('Step 2 (Component Tray B) verified passed via overhead camera.');

      // Step 3: Fasteners
      await api.confirmStep(currentSessionId, 'step_fasteners', 'M5x16 Black Oxide staged in bin.');
      addLog('Step 3 (Fasteners) confirmed by operator.');

      // Step 4: Tool Preset
      await api.sendToolPreset('preset_2', 'Preset 2 (12.5 Nm)', 12.5);
      await api.verifyStep(currentSessionId, 'step_tool_preset');
      addLog('Step 4 (Tool Preset 2) verified passed via ESP32 telemetry.');

      // Step 5: Inspection
      await api.confirmStep(currentSessionId, 'step_inspection', 'First-piece pilot unit passed dielectric & axial play tests.');
      addLog('Step 5 (First-Piece Inspection) confirmed by operator.');

      // Step 6: Readiness
      await api.confirmStep(currentSessionId, 'step_readiness', '5S cleared, interlocks green.');
      addLog('Step 6 (Station Readiness) confirmed. Ready for supervisor approval!');
    } catch (err: any) {
      addLog(`Error running checks: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Step 7: Request approval
  const handleRequestApproval = async () => {
    if (!currentSessionId) {
      addLog('Please start a changeover session first!');
      return;
    }
    try {
      setLoadingStep('request_approval');
      const res = await api.requestApproval(currentSessionId);
      addLog(`Submitted for supervisor signoff: ${res.message}`);
    } catch (err: any) {
      addLog(`Error requesting approval: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Step 8: Approve as supervisor (PIN 1234)
  const handleApproveSupervisor = async () => {
    if (!currentSessionId) {
      addLog('Please start a changeover session first!');
      return;
    }
    try {
      setLoadingStep('approve');
      const psp = await api.approveChangeover(currentSessionId, '1234', 'Supervisor Dave', 'Verified against SOP-MTR-B-01 v2.1.');
      setCurrentPassportId(psp.id);
      addLog(`Changeover APPROVED! Digital Passport generated: ${psp.id}`);
      addLog(`SHA-256 Integrity Hash: ${psp.integrity_hash.slice(0, 16)}...`);
    } catch (err: any) {
      addLog(`Error approving changeover: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Fleet Demo: Inject slow leak on Truck 04
  const handleInjectFleetLeak = async () => {
    try {
      setLoadingStep('fleet_leak');
      await api.injectFleetScenario('TRK-04', 'RLO', 'slow_leak');
      addLog('Fleet fault injected: Truck 04 RLO tyre set to slow_leak scenario.');
    } catch (err: any) {
      addLog(`Error injecting fleet fault: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  // Fleet Demo: Acknowledge alert
  const handleAckFleetAlert = async () => {
    try {
      setLoadingStep('fleet_ack');
      const alerts = await api.getAlerts();
      const trkAlert = alerts.find(a => a.truck_id === 'TRK-04' && !a.acknowledged);
      if (trkAlert) {
        await api.acknowledgeAlert(trkAlert.id);
        addLog(`Alert ${trkAlert.id} acknowledged by mechanic.`);
      } else {
        addLog('No pending unacknowledged alert for TRK-04.');
      }
    } catch (err: any) {
      addLog(`Error acknowledging alert: ${err.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  return (
    <div className="py-8 px-4 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Title */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive 2-Minute Scripted Walkthrough</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">Demo Control Panel</h1>
        <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
          Every button below executes real HTTP calls against the FastAPI backend, transitions deterministic states, logs deviations, computes predictions, and generates verifiable SHA-256 passports.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Scripted Sequence */}
        <div className="lg:col-span-2 space-y-6">
          {/* Module 1 Sequence Card */}
          <div className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="font-bold text-white text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Scenario 1: Tabletop Motor Workstation Changeover
              </div>
              <button
                onClick={handleReset}
                disabled={loadingStep === 'reset'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingStep === 'reset' ? 'animate-spin' : ''}`} />
                Reset Demo State
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Step 1 */}
              <button
                onClick={handleStartChangeover}
                disabled={loadingStep === 'start_chg'}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition text-left group"
              >
                <div>
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold">Step 1</div>
                  <div className="text-xs font-bold text-white">Start Motor B Changeover</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">POST /api/changeovers & SOP check</div>
                </div>
                {loadingStep === 'start_chg' ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                )}
              </button>

              {/* Step 2 */}
              <button
                onClick={handleInjectWrongFixture}
                disabled={loadingStep === 'inject_fixture'}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/80 transition text-left group"
              >
                <div>
                  <div className="text-[11px] font-mono text-amber-400 font-semibold">Step 2</div>
                  <div className="text-xs font-bold text-white">Inject Fault: Fixture A Mounted</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">POST /api/sim/station TAG-A-01</div>
                </div>
                {loadingStep === 'inject_fixture' ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
                )}
              </button>

              {/* Step 3 */}
              <button
                onClick={handleVerifyStepFailure}
                disabled={loadingStep === 'verify_fail' || !currentSessionId}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-900/80 transition text-left group disabled:opacity-50"
              >
                <div>
                  <div className="text-[11px] font-mono text-rose-400 font-semibold">Step 3</div>
                  <div className="text-xs font-bold text-white">Show Deviation Flag</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Verify Step 1 ➔ Rejection & Fix text</div>
                </div>
                {loadingStep === 'verify_fail' ? (
                  <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition" />
                )}
              </button>

              {/* Step 4 */}
              <button
                onClick={handleFixFixture}
                disabled={loadingStep === 'fix_fixture' || !currentSessionId}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition text-left group disabled:opacity-50"
              >
                <div>
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold">Step 4</div>
                  <div className="text-xs font-bold text-white">Fix It (Mount Fixture B)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">POST TAG-B-02 & Re-verify (Corrected)</div>
                </div>
                {loadingStep === 'fix_fixture' ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                )}
              </button>

              {/* Step 5 */}
              <button
                onClick={handleRunAllChecks}
                disabled={loadingStep === 'run_all' || !currentSessionId}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition text-left group disabled:opacity-50"
              >
                <div>
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold">Step 5</div>
                  <div className="text-xs font-bold text-white">Execute Remaining Checks</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Tray, Fasteners, Tool 12.5Nm, Inspection</div>
                </div>
                {loadingStep === 'run_all' ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                )}
              </button>

              {/* Step 6 */}
              <button
                onClick={handleRequestApproval}
                disabled={loadingStep === 'request_approval' || !currentSessionId}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900/80 transition text-left group disabled:opacity-50"
              >
                <div>
                  <div className="text-[11px] font-mono text-sky-400 font-semibold">Step 6</div>
                  <div className="text-xs font-bold text-white">Request Supervisor Approval</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">POST /api/changeovers/:id/request-approval</div>
                </div>
                {loadingStep === 'request_approval' ? (
                  <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition" />
                )}
              </button>

              {/* Step 7 */}
              <button
                onClick={handleApproveSupervisor}
                disabled={loadingStep === 'approve' || !currentSessionId}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition text-left group disabled:opacity-50"
              >
                <div>
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold">Step 7</div>
                  <div className="text-xs font-bold text-white">Approve as Supervisor (PIN 1234)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Generates Digital Passport + SHA-256</div>
                </div>
                {loadingStep === 'approve' ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                )}
              </button>

              {/* Step 8 */}
              <button
                onClick={() => {
                  if (currentPassportId) {
                    navigate(`/passports/${currentPassportId}`);
                  } else {
                    navigate('/passports');
                  }
                }}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40 hover:bg-emerald-500/10 transition text-left group"
              >
                <div>
                  <div className="text-[11px] font-mono text-emerald-300 font-semibold">Step 8</div>
                  <div className="text-xs font-bold text-white">Open Digital Passport</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    {currentPassportId ? `View ${currentPassportId}` : 'Browse Passport Registry'}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>

          {/* Module 2 Fleet Scenario Card */}
          <div className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-4">
            <div className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
              <Truck className="w-4 h-4 text-sky-400" />
              Scenario 2: Fleet Predictive Maintenance Walkthrough
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleInjectFleetLeak}
                disabled={loadingStep === 'fleet_leak'}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/80 transition text-left group"
              >
                <div className="text-[11px] font-mono text-amber-400 font-semibold">Fault Injection</div>
                <div className="text-xs font-bold text-white mt-1">Inject Slow Leak (TRK-04 RLO)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">POST /api/sim/inject</div>
              </button>

              <button
                onClick={() => navigate('/fleet/TRK-04')}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900/80 transition text-left group"
              >
                <div className="text-[11px] font-mono text-sky-400 font-semibold">Prediction View</div>
                <div className="text-xs font-bold text-white mt-1">Inspect Truck 04 Regression</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Least-squares time-to-threshold</div>
              </button>

              <button
                onClick={handleAckFleetAlert}
                disabled={loadingStep === 'fleet_ack'}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition text-left group"
              >
                <div className="text-[11px] font-mono text-emerald-400 font-semibold">Mechanic Action</div>
                <div className="text-xs font-bold text-white mt-1">Acknowledge Alert</div>
                <div className="text-[10px] text-slate-400 mt-0.5">POST /api/alerts/:id/ack</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Execution Telemetry Log */}
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-4 flex flex-col h-[520px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Live Execution Log</span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live API
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-1">
              {statusLog.length === 0 ? (
                <div className="text-slate-500 italic py-8 text-center text-xs">
                  Click any button to trigger real backend API calls. Responses will stream here in real time.
                </div>
              ) : (
                statusLog.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border text-[11px] leading-relaxed break-all ${
                      log.includes('PASSED') || log.includes('APPROVED')
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : log.includes('failed') || log.includes('Deviation') || log.includes('superseded')
                        ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>

            {currentSessionId && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Active Changeover:</span>
                <button
                  onClick={() => navigate(`/station/${currentSessionId}`)}
                  className="font-mono text-emerald-400 hover:underline"
                >
                  {currentSessionId} ➔
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
