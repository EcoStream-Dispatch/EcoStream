import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Truck, Alert } from '../types';
import { useBackend } from '../context/BackendContext';
import { 
  Truck as TruckIcon, AlertTriangle, CheckCircle2, 
  Search, ArrowRight, ShieldAlert, Activity, MapPin
} from 'lucide-react';

export const FleetOverview: React.FC = () => {
  const navigate = useNavigate();
  const { eventTicker } = useBackend();

  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fl, al] = await Promise.all([
          api.getFleet(),
          api.getAlerts()
        ]);
        setTrucks(fl);
        setAlerts(al);
      } catch (err) {
        console.error('Error fetching fleet:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventTicker]);

  const filteredTrucks = trucks.filter(
    (t) =>
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.route.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const healthyCount = trucks.filter((t) => t.status === 'healthy').length;
  const warningCount = trucks.filter((t) => t.status === 'warning').length;
  const criticalCount = trucks.filter((t) => t.status === 'critical').length;
  const activeAlerts = alerts.filter((a) => !a.resolved);

  return (
    <div className="py-8 px-4 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30 text-xs font-semibold">
            <TruckIcon className="w-3.5 h-3.5" />
            <span>Chennai Logistics Corridor Telemetry</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-1">Commercial Fleet Predictive Health</h1>
          <p className="text-sm text-slate-300">
            Real-time pneumatic & thermal stream processing across 12 heavy-duty freight trucks.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by truck ID, route, or driver…"
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>
      </div>

      {/* Fleet KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Monitored Trucks</div>
          <div className="text-2xl font-extrabold text-white">{trucks.length} Units</div>
          <div className="text-xs text-slate-500">72 Telemetry Nodes</div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-emerald-400 uppercase">Healthy (Nominal)</div>
          <div className="text-2xl font-extrabold text-emerald-400">{healthyCount}</div>
          <div className="text-xs text-slate-500">Normal operating parameters</div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-amber-400 uppercase">Predictive Warnings</div>
          <div className="text-2xl font-extrabold text-amber-400">{warningCount}</div>
          <div className="text-xs text-slate-500">Linear slope degradation</div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-rose-400 uppercase">Active Alerts</div>
          <div className="text-2xl font-extrabold text-rose-400">{activeAlerts.length}</div>
          <div className="text-xs text-slate-500">Awaiting mechanic acknowledge</div>
        </div>
      </div>

      {/* Threshold Disclosure Note */}
      <div className="text-xs text-slate-400 flex items-center gap-2 px-1">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        <span>
          Thresholds: Nominal 110 PSI, Warning &lt;95% (104.5 PSI), Critical &lt;85% (93.5 PSI) — <em className="text-slate-400">demo defaults, confirm with tyre manufacturer specs</em>.
        </span>
      </div>

      {/* Trucks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTrucks.map((t) => {
          const isCritical = t.status === 'critical';
          const isWarning = t.status === 'warning';

          return (
            <div
              key={t.id}
              onClick={() => navigate(`/fleet/${t.id}`)}
              className={`p-6 rounded-3xl border transition cursor-pointer flex flex-col justify-between space-y-5 group ${
                isCritical
                  ? 'bg-rose-950/20 border-rose-500/50 hover:border-rose-400 ring-1 ring-rose-500/30'
                  : isWarning
                  ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400 ring-1 ring-amber-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-sky-500/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">{t.id}</span>
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : isWarning
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(t.last_updated).toLocaleTimeString()}
                  </span>
                </div>

                <div className="text-base font-bold text-white group-hover:text-sky-300 transition">
                  {t.name}
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{t.route}</span>
                </div>
              </div>

              {/* 6 Tyres Mini Preview */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="grid grid-cols-6 gap-1 text-center font-mono">
                  {Object.entries(t.tyres).map(([pos, state]) => (
                    <div
                      key={pos}
                      className={`p-1 rounded text-[10px] ${
                        state.status === 'critical'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : state.status === 'warning'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                      title={`${pos}: ${state.current_pressure} PSI (${state.predicted_text})`}
                    >
                      <div className="text-[9px] text-slate-500">{pos}</div>
                      <div className="font-bold">{Math.round(state.current_pressure)}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                    {Object.values(t.tyres).find((ty) => ty.predicted_hours_to_min)
                      ?.predicted_text || 'All tyres nominal'}
                  </span>
                  <span className="text-sky-400 font-semibold flex items-center gap-1 text-[11px] group-hover:translate-x-1 transition">
                    Inspect ➔
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
