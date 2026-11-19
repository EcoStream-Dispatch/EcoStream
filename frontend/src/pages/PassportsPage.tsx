import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { DigitalPassport } from '../types';
import { useBackend } from '../context/BackendContext';
import { 
  FileText, ShieldCheck, Search, ArrowRight, 
  Calendar, CheckCircle2, AlertTriangle, Download
} from 'lucide-react';

export const PassportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventTicker } = useBackend();

  const [passports, setPassports] = useState<DigitalPassport[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPassports = async () => {
      try {
        const data = await api.getPassports();
        setPassports(data);
      } catch (err) {
        console.error('Error fetching passports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPassports();
  }, [eventTicker]);

  const filtered = passports.filter(
    (p) =>
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.to_variant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supervisor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.integrity_hash.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="py-8 px-4 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Digital Line Clearance Certificates</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-1">Changeover Passports Registry</h1>
          <p className="text-sm text-slate-300">
            Immutable, cryptographically sealed records of verified changeovers, tooling telemetry, and operator signoffs.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, variant, or hash…"
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
      </div>

      {/* Passport Cards Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 ring-1 ring-slate-800 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-500 mx-auto" />
          <div className="text-base font-semibold text-white">No Passports Found</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Complete a station changeover and approve it as supervisor to generate your first digital passport.
          </p>
          <button
            onClick={() => navigate('/station')}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
          >
            Start a Changeover ➔
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/passports/${p.id}`)}
              className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 hover:ring-emerald-500/50 transition cursor-pointer flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-400">{p.id}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    SHA-256 SEALED
                  </span>
                </div>

                <div className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                  {p.from_variant.toUpperCase()} ➔ {p.to_variant.toUpperCase()}
                </div>

                <div className="text-xs text-slate-400 space-y-1">
                  <div>Operator: <strong className="text-slate-200">{p.operator}</strong></div>
                  <div>Supervisor: <strong className="text-slate-200">{p.supervisor}</strong></div>
                  <div>SOP: <span className="font-mono text-emerald-400">{p.sop_id} {p.sop_version}</span></div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-500">
                <div className="truncate max-w-[200px]" title={p.integrity_hash}>
                  Hash: {p.integrity_hash.slice(0, 16)}…
                </div>
                <div className="flex items-center gap-1 text-emerald-400 font-semibold group-hover:translate-x-1 transition">
                  Inspect Passport <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
