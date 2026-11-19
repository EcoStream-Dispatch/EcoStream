import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 text-center space-y-6 max-w-md w-full">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white">404 - Not Found</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            The requested operations page does not exist or has been relocated in the dispatcher system.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dispatch Center
          </Link>
        </div>
      </div>
    </div>
  );
};
