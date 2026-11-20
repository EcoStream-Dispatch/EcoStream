import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Truck, TyreState, Alert, DiagnoseResponse } from '../types';
import { useBackend } from '../context/BackendContext';
import { TyreChassisSVG } from '../components/TyreChassisSVG';
import { 
  Truck as TruckIcon, ArrowLeft, AlertTriangle, CheckCircle2, 
  TrendingDown, ShieldAlert, Wrench, Sparkles, Send, 
  HelpCircle, RefreshCw, Loader2
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, ReferenceLine 
} from 'recharts';

export const TruckDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { eventTicker } = useBackend();

  const [truck, setTruck] = useState<Truck | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedTyrePos, setSelectedTyrePos] = useState<string>('RLO');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Diagnosis box state
  const [question, setQuestion] = useState<string>('What is the recommended inspection checklist for this degradation trend?');
  const [diagnosis, setDiagnosis] = useState<DiagnoseResponse | null>(null);
  const [diagnosing, setDiagnosing] = useState<boolean>(false);

  const fetchTruckData = async () => {
    if (!id) return;
    try {
      const [t, al] = await Promise.all([
        api.getTruck(id),
        api.getAlerts()
      ]);
      setTruck(t);
      setAlerts(al.filter((a) => a.truck_id === id));
    } catch (err) {
      console.error('Error fetching truck data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTruckData();
  }, [id, eventTicker]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
        <div className="text-sm font-mono text-slate-400">Streaming truck {id} telemetry…</div>
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <div className="text-lg font-bold text-white">Truck Not Found</div>
        <p className="text-xs text-slate-400">Truck ID does not match active fleet manifests.</p>
        <button
          onClick={() => navigate('/fleet')}
          className="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs"
        >
          Return to Fleet Overview
        </button>
      </div>
    );
  }

  const selectedTyre: TyreState | undefined = truck.tyres[selectedTyrePos];
  const recentReadings = truck.recent_readings[selectedTyrePos] || [];

  // Chart data formatting
  const chartData = recentReadings.map((r, idx) => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    pressure: r.pressure_psi,
    temp: r.temperature_c,
    step: idx
  }));

  // Add projected projection point if slope is negative
  if (selectedTyre && selectedTyre.slope_psi_per_hour < -0.1 && chartData.length > 0) {
    const lastReading = chartData[chartData.length - 1];
    chartData.push({
      time: 'Predicted Min Threshold',
      pressure: 93.5,
      temp: selectedTyre.current_temp,
      step: chartData.length
    });
  }

  const handleScenarioInject = async (scenario: 'slow_leak' | 'sudden_drop' | 'overheat' | 'clear') => {
    try {
      setActionLoading(scenario);
      await api.injectFleetScenario(truck.id, selectedTyrePos, scenario);
      await fetchTruckData();
    } catch (err: any) {
      alert(`Fault injection error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAskEcoStream = async () => {
    try {
      setDiagnosing(true);
      const res = await api.diagnoseTyre(truck.id, selectedTyrePos, question);
      setDiagnosis(res);
    } catch (err: any) {
      alert(`Diagnosis query error: ${err.message}`);
    } finally {
      setDiagnosing(false);
    }
  };

  const handleAckAlert = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId);
      await fetchTruckData();
    } catch (err: any) {
      alert(`Alert ack error: ${err.message}`);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.resolveAlert(alertId);
      await fetchTruckData();
    } catch (err: any) {
      alert(`Alert resolve error: ${err.message}`);
    }
  };

  return (
    <div className="py-8 px-4 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/fleet')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Fleet Overview
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-slate-400">Live 2s Stream Active</span>
        </div>
      </div>

      {/* Truck Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-sky-400">{truck.id}</span>
            <span
              className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${
                truck.status === 'critical'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : truck.status === 'warning'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {truck.status}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">{truck.name}</h1>
          <div className="text-xs text-slate-400">
            Route: <strong>{truck.route}</strong> • Last sync: {new Date(truck.last_updated).toLocaleTimeString()}
          </div>
        </div>

        {/* Selected Tyre Quick Pill */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono flex items-center gap-4">
          <div>
            <div className="text-slate-500 text-[10px]">SELECTED POSITION</div>
            <div className="text-white font-bold text-sm">{selectedTyrePos}</div>
          </div>
          <div className="border-l border-slate-800 pl-3">
            <div className="text-slate-500 text-[10px]">PRESSURE</div>
            <div className="text-emerald-400 font-bold text-sm">
              {selectedTyre ? `${selectedTyre.current_pressure} PSI` : '--'}
            </div>
          </div>
          <div className="border-l border-slate-800 pl-3">
            <div className="text-slate-500 text-[10px]">TEMPERATURE</div>
            <div className="text-sky-400 font-bold text-sm">
              {selectedTyre ? `${selectedTyre.current_temp}°C` : '--'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Chassis Diagram (Left) & Trend / Prediction (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Chassis Interactive Diagram & Scenario Injector (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <TyreChassisSVG
            tyres={truck.tyres}
            selectedTyre={selectedTyrePos}
            onSelectTyre={(pos) => setSelectedTyrePos(pos)}
          />

          {/* Fault Scenario Injector Card */}
          <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-3">
            <div className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>Telemetry Scenario Injection</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[11px] text-slate-400">
              Apply realistic faults to position <strong className="text-white">{selectedTyrePos}</strong> to observe the prediction curve response:
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleScenarioInject('slow_leak')}
                disabled={actionLoading === 'slow_leak'}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 text-left text-amber-300 font-semibold transition"
              >
                Inject Slow Leak
                <div className="text-[10px] text-slate-500 font-normal">-0.12 PSI / tick</div>
              </button>

              <button
                onClick={() => handleScenarioInject('sudden_drop')}
                disabled={actionLoading === 'sudden_drop'}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-900 text-left text-rose-300 font-semibold transition"
              >
                Inject Sudden Drop
                <div className="text-[10px] text-slate-500 font-normal">-15 PSI acute loss</div>
              </button>

              <button
                onClick={() => handleScenarioInject('overheat')}
                disabled={actionLoading === 'overheat'}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900 text-left text-purple-300 font-semibold transition"
              >
                Thermal Overheat
                <div className="text-[10px] text-slate-500 font-normal">&gt;95°C hot drum</div>
              </button>

              <button
                onClick={() => handleScenarioInject('clear')}
                disabled={actionLoading === 'clear'}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 text-left text-emerald-300 font-semibold transition"
              >
                Reset to Nominal
                <div className="text-[10px] text-slate-500 font-normal">110.0 PSI baseline</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Regression Trend Chart & Prediction Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Prediction Highlight Banner */}
          <div
            className={`p-6 rounded-3xl border transition space-y-2 ${
              selectedTyre?.status === 'critical'
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                : selectedTyre?.status === 'warning'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono font-bold uppercase">
              <span className="flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" />
                Least-Squares Degradation Model
              </span>
              <span>Rate: {selectedTyre?.slope_psi_per_hour || 0.0} PSI/h</span>
            </div>

            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {selectedTyre?.predicted_text || 'Stable (no degradation)'}
            </div>

            <div className="text-xs opacity-80 leading-relaxed">
              Formula: <code className="font-mono">t = (current - 93.5 PSI) ÷ -slope</code> when linear fit is stable. Minimum threshold: 85% of nominal (93.5 PSI).
            </div>
          </div>

          {/* Recharts Trend Chart */}
          <div className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-white text-base">
                Pressure Telemetry & Degradation Trend ({selectedTyrePos})
              </span>
              <span className="text-xs font-mono text-slate-400">Rolling 20 Readings</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                  <YAxis domain={[80, 120]} stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <ReferenceLine y={104.5} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Warning (95%)', fill: '#f59e0b', fontSize: 10 }} />
                  <ReferenceLine y={93.5} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Critical Min (85%)', fill: '#f43f5e', fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="pressure"
                    stroke={selectedTyre?.status === 'critical' ? '#f43f5e' : selectedTyre?.status === 'warning' ? '#f59e0b' : '#10b981'}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#0f172a' }}
                    name="Pressure (PSI)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ask-EcoStream Rule-Based Diagnosis Box */}
          <div className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-white text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                Ask-EcoStream Diagnostic Engine
              </span>
              <span className="text-xs font-mono text-slate-400">Rule-Based Troubleshooting</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask diagnosis for this tyre…"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
              />
              <button
                onClick={handleAskEcoStream}
                disabled={diagnosing}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {diagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Diagnose
              </button>
            </div>

            {diagnosis && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="font-bold text-sky-300">{diagnosis.diagnosis}</div>
                <div className="space-y-1 text-slate-300">
                  <div className="font-semibold text-slate-400">Step-by-step diagnostic checklist:</div>
                  {diagnosis.checklist.map((item, idx) => (
                    <div key={idx} className="pl-2 border-l border-sky-500/40 text-[11px] text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="text-[11px] font-mono text-emerald-400 pt-2 border-t border-slate-800">
                  Action: {diagnosis.suggested_action}
                </div>
              </div>
            )}
          </div>

          {/* Active Alerts for this Truck */}
          {alerts.length > 0 && (
            <div className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-3">
              <div className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center justify-between">
                <span>Active Telemetry Alerts ({alerts.length})</span>
                <ShieldAlert className="w-4 h-4" />
              </div>

              <div className="space-y-2">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{a.message}</span>
                        {a.acknowledged && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                            ACKNOWLEDGED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!a.acknowledged && (
                        <button
                          onClick={() => handleAckAlert(a.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                        >
                          Acknowledge
                        </button>
                      )}
                      {!a.resolved && (
                        <button
                          onClick={() => handleResolveAlert(a.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/40"
                        >
                          Resolve Alert
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
