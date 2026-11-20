import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Sop } from '../types';
import { useBackend } from '../context/BackendContext';
import { 
  Layers, CheckCircle2, AlertTriangle, Calendar, 
  Search, FileText, ArrowRight, Shield
} from 'lucide-react';

export const SopsPage: React.FC = () => {
  const { eventTicker } = useBackend();
  const [sops, setSops] = useState<Sop[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchSops = async () => {
      try {
        const data = await api.getSops();
        setSops(data);
      } catch (err) {
        console.error('Error fetching SOPs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSops();
  }, [eventTicker]);

  const filtered = sops.filter(
    (s) =>
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.version.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.variant_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="py-8 px-4 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>ISO 9001 Document Control Registry</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-1">Standard Operating Procedures</h1>
          <p className="text-sm text-slate-300">
            Official engineering assembly procedures. EcoStream Dispatch enforces active version gating to prevent obsolete work instruction execution.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by SOP ID, version, variant…"
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
      </div>

      {/* SOP Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((sop) => {
          const isApproved = sop.status === 'approved';

          return (
            <div
              key={`${sop.id}-${sop.version}`}
              className={`p-6 rounded-3xl border transition space-y-4 ${
                isApproved
                  ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/50'
                  : 'bg-slate-950/40 border-slate-900/80 opacity-75 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">{sop.id}</span>
                    <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                      {sop.version}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white">{sop.title}</h3>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full border ${
                    isApproved
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {sop.status}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                {sop.change_notes}
              </p>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 font-mono">
                <div>Variant Target: <strong className="text-slate-200 uppercase">{sop.variant_id}</strong></div>
                <div>{sop.approved_at ? new Date(sop.approved_at).toLocaleDateString() : 'Active'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
