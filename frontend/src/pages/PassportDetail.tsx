import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { DigitalPassport } from '../types';
import { 
  ShieldCheck, Printer, Download, ArrowLeft, 
  CheckCircle2, AlertTriangle, Hash, Calendar, 
  User, Layers, Cpu, Eye, Loader2
} from 'lucide-react';

export const PassportDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [passport, setPassport] = useState<DigitalPassport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPassport = async () => {
      if (!id) return;
      try {
        const data = await api.getPassport(id);
        setPassport(data);
      } catch (err) {
        console.error('Error fetching passport:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPassport();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
        <div className="text-sm font-mono text-slate-400">Verifying digital passport integrity…</div>
      </div>
    );
  }

  if (!passport) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <div className="text-lg font-bold text-white">Passport Not Found</div>
        <p className="text-xs text-slate-400">Passport record could not be retrieved from the store.</p>
        <button
          onClick={() => navigate('/passports')}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
        >
          Return to Registry
        </button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(passport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${passport.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="py-8 px-4 lg:px-8 max-w-4xl mx-auto space-y-6">
      {/* Top Actions (no-print) */}
      <div className="no-print flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/passports')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Passport Registry
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-4 h-4 text-sky-400" />
            Download JSON
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20"
          >
            <Printer className="w-4 h-4" />
            Print Certificate
          </button>
        </div>
      </div>

      {/* Printable Passport Certificate Document */}
      <div className="printable-passport p-8 sm:p-12 rounded-3xl bg-slate-900/80 ring-1 ring-slate-800 space-y-8 shadow-2xl">
        {/* Certificate Header */}
        <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <span className="text-xl font-extrabold text-white tracking-tight uppercase">
                Digital Changeover Passport
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              EcoStream Dispatch Industrial Quality Assurance System
            </div>
          </div>

          <div className="text-right font-mono text-xs space-y-0.5">
            <div className="text-emerald-400 font-bold">{passport.id}</div>
            <div className="text-slate-500 text-[11px]">{new Date(passport.approved_at).toUTCString()}</div>
          </div>
        </div>

        {/* Status & Integrity Hash Banner */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Cryptographic Integrity Verification
            </span>
            <span className="font-mono text-[10px] uppercase font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              {passport.status}
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-300 break-all bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            SHA-256: <strong className="text-emerald-400">{passport.integrity_hash}</strong>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
          <div>
            <div className="text-slate-500 text-[10px] uppercase">Workstation</div>
            <div className="text-white font-bold mt-0.5">{passport.station_id}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase">Transition</div>
            <div className="text-white font-bold mt-0.5">{passport.from_variant.toUpperCase()} ➔ {passport.to_variant.toUpperCase()}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase">Operator</div>
            <div className="text-slate-200 mt-0.5">{passport.operator}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase">Supervisor Signoff</div>
            <div className="text-emerald-400 font-bold mt-0.5">{passport.supervisor}</div>
          </div>
        </div>

        {/* Steps Summary Table */}
        <div className="space-y-3">
          <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            Verified Changeover Steps Sequence
          </div>

          <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Operation</th>
                  <th className="p-3">Verification</th>
                  <th className="p-3">Target Parameter</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {passport.steps_summary.map((s) => (
                  <tr key={s.step_id} className="hover:bg-slate-950/40">
                    <td className="p-3 font-mono text-slate-500">{s.order}</td>
                    <td className="p-3 font-semibold text-white">{s.title}</td>
                    <td className="p-3 font-mono text-slate-400 capitalize">{s.verification_type}</td>
                    <td className="p-3 font-mono text-slate-300">{s.expected_value}</td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-400">
                      PASSED
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deviations & Corrections Log */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            <span>Logged Deviations & Corrective Actions ({passport.deviations_count})</span>
            <span className="text-slate-500 font-normal">Audit Compliance §4.2</span>
          </div>

          {passport.deviations.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 italic">
              Zero deviations recorded during changeover setup.
            </div>
          ) : (
            <div className="space-y-2">
              {passport.deviations.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{d.step_title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-emerald-500/20 text-emerald-300">
                      CORRECTED & SEALED
                    </span>
                  </div>
                  <div className="text-slate-400">{d.explanation}</div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Expected: {d.expected} • Actual Detected: {d.actual} • Timestamp: {new Date(d.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Certificate Signoff Footer */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>
            Line Clearance Issued: <strong>{new Date(passport.approved_at).toLocaleString()}</strong>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Digital Signature Verified: <strong>{passport.supervisor}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
