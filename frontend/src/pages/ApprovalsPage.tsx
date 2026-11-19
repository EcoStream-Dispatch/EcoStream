import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ChangeoverSession } from '../types';
import { useBackend } from '../context/BackendContext';
import { useRole } from '../context/RoleContext';
import { 
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle, 
  ArrowRight, Clock, FileText, Loader2, X
} from 'lucide-react';

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventTicker } = useBackend();
  const { userName } = useRole();

  const [sessions, setSessions] = useState<ChangeoverSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal states
  const [approveSessionId, setApproveSessionId] = useState<string | null>(null);
  const [rejectSessionId, setRejectSessionId] = useState<string | null>(null);
  const [pin, setPin] = useState<string>('1234');
  const [notes, setNotes] = useState<string>('Changeover parameters verified and approved.');
  const [rejectReason, setRejectReason] = useState<string>('Fastener bin inspection requires re-audit.');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchSessions = async () => {
    try {
      const data = await api.getChangeovers();
      setSessions(data);
    } catch (err) {
      console.error('Error loading changeovers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [eventTicker]);

  const handleApprove = async () => {
    if (!approveSessionId) return;
    try {
      setSubmitting(true);
      const passport = await api.approveChangeover(approveSessionId, pin, userName, notes);
      setApproveSessionId(null);
      navigate(`/passports/${passport.id}`);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectSessionId) return;
    try {
      setSubmitting(true);
      await api.rejectChangeover(rejectSessionId, rejectReason, userName);
      setRejectSessionId(null);
      await fetchSessions();
    } catch (err: any) {
      alert(`Reject error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingSessions = sessions.filter(
    (s) => s.status === 'pending_approval' || (s.steps.every((st) => st.status === 'passed') && s.status !== 'completed' && s.status !== 'approved')
  );
  const approvedSessions = sessions.filter((s) => s.status === 'completed' || s.status === 'approved');

  return (
    <div className="py-8 px-4 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Quality & Shift Supervisor Signoff Desk</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mt-1">Pending Approvals Queue</h1>
        <p className="text-sm text-slate-300">
          Review completed station changeovers, inspect logged deviations, and sign digital passports with PIN authorization.
        </p>
      </div>

      {/* Pending Approvals List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          Awaiting Supervisor Signoff ({pendingSessions.length})
        </h2>

        {pendingSessions.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/40 ring-1 ring-slate-800 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">Queue is Clear</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are currently no changeover sessions awaiting supervisor approval.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingSessions.map((s) => (
              <div
                key={s.id}
                className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-emerald-400">{s.id}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Pending Signoff
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Station: {s.station_id}
                    </span>
                  </div>

                  <div className="text-sm text-white font-semibold">
                    Changeover to <span className="text-emerald-400 font-bold uppercase">{s.to_variant}</span>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-4">
                    <span>Operator: <strong>{s.operator}</strong></span>
                    <span>SOP: <strong>{s.sop_id} {s.sop_version}</strong></span>
                    <span>
                      Deviations Logged:{' '}
                      <strong className={s.deviations.length > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {s.deviations.length}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/station/${s.id}`)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                  >
                    Inspect Steps
                  </button>
                  <button
                    onClick={() => setRejectSessionId(s.id)}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                  <button
                    onClick={() => setApproveSessionId(s.id)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Approve (PIN)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical Approved Passports List */}
      <div className="space-y-4 pt-6">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          Recently Approved Passports ({approvedSessions.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {approvedSessions.map((s) => (
            <div
              key={s.id}
              onClick={() => s.passport_id && navigate(`/passports/${s.passport_id}`)}
              className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-400">{s.passport_id || s.id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
                    Certified
                  </span>
                </div>
                <div className="text-xs text-slate-300">
                  Target: <strong>{s.to_variant}</strong> • Approved by: {s.approved_by || 'Supervisor Dave'}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Approve Modal */}
      {approveSessionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-white text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Sign Changeover Approval
              </span>
              <button onClick={() => setApproveSessionId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Supervisor PIN (Demo: 1234)</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Supervisor Signoff Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setApproveSessionId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting || !pin}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Authorize & Seal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectSessionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-white text-base flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                Reject Changeover Session
              </span>
              <button onClick={() => setRejectSessionId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectSessionId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectReason}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
