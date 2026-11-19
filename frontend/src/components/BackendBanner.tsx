import React from 'react';
import { useBackend } from '../context/BackendContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const BackendBanner: React.FC = () => {
  const { isOnline, isWaking, error, retry } = useBackend();

  if (isOnline && !isWaking) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-amber-200">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>
            {isWaking ? (
              <span className="font-medium text-amber-300">Waking the server… (Render free instance may take ~20–30s on cold start)</span>
            ) : (
              <span>Backend offline or waking up: <span className="font-mono text-xs opacity-80">{error || 'Connection refused'}</span></span>
            )}
          </span>
        </div>
        <button
          onClick={() => retry()}
          disabled={isWaking}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold ring-1 ring-amber-500/40 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isWaking ? 'animate-spin' : ''}`} />
          Retry Connection
        </button>
      </div>
    </div>
  );
};
