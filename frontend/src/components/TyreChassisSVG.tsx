import React from 'react';
import { TyreState } from '../types';

interface TyreChassisSVGProps {
  tyres: Record<string, TyreState>;
  selectedTyre: string;
  onSelectTyre: (pos: string) => void;
}

export const TyreChassisSVG: React.FC<TyreChassisSVGProps> = ({
  tyres,
  selectedTyre,
  onSelectTyre,
}) => {
  const getTyreColor = (pos: string) => {
    const t = tyres[pos];
    if (!t) return { bg: '#1e293b', border: '#475569', text: '#94a3b8' };
    if (t.status === 'critical') return { bg: '#4c0519', border: '#f43f5e', text: '#fda4af' };
    if (t.status === 'warning') return { bg: '#451a03', border: '#f59e0b', text: '#fde68a' };
    return { bg: '#022c22', border: '#10b981', text: '#a7f3d0' };
  };

  const renderTyre = (pos: string, x: number, y: number, label: string) => {
    const t = tyres[pos];
    const isSelected = selectedTyre === pos;
    const colors = getTyreColor(pos);

    return (
      <g
        key={pos}
        onClick={() => onSelectTyre(pos)}
        className="cursor-pointer transition hover:opacity-90"
        tabIndex={0}
        role="button"
        aria-label={`${label} Tyre ${pos}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelectTyre(pos);
        }}
      >
        {/* Selection glow */}
        {isSelected && (
          <rect
            x={x - 6}
            y={y - 6}
            width="56"
            height="86"
            rx="12"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
        )}

        {/* Tyre Tread Body */}
        <rect
          x={x}
          y={y}
          width="44"
          height="74"
          rx="8"
          fill={colors.bg}
          stroke={colors.border}
          strokeWidth={isSelected ? "3" : "2"}
        />

        {/* Tread Grooves */}
        <line x1={x + 14} y1={y + 8} x2={x + 14} y2={y + 66} stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
        <line x1={x + 30} y1={y + 8} x2={x + 30} y2={y + 66} stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Text Readout */}
        <text
          x={x + 22}
          y={y + 30}
          textAnchor="middle"
          fill={colors.text}
          fontSize="10"
          fontWeight="bold"
          className="font-mono select-none"
        >
          {pos}
        </text>
        <text
          x={x + 22}
          y={y + 45}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="11"
          fontWeight="bold"
          className="font-mono select-none"
        >
          {t ? `${t.current_pressure}` : '--'}
        </text>
        <text
          x={x + 22}
          y={y + 57}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="8"
          className="font-mono select-none"
        >
          PSI
        </text>
      </g>
    );
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
      <div className="text-[11px] font-mono text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
        <span>6-Tyre Commercial Chassis Layout</span>
        <span className="text-[10px] text-emerald-400 font-semibold">(Click tyre to inspect)</span>
      </div>

      <svg viewBox="0 0 340 380" className="w-full max-w-sm h-auto select-none">
        {/* Truck Chassis Outline */}
        {/* Cab */}
        <path
          d="M 90 20 L 250 20 Q 260 20 260 35 L 260 110 L 80 110 L 80 35 Q 80 20 90 20 Z"
          fill="#0f172a"
          stroke="#334155"
          strokeWidth="2"
        />
        {/* Windshield */}
        <rect x="100" y="32" width="140" height="35" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <text x="170" y="54" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="bold">CABIN FRONT</text>

        {/* Chassis Frame Rails */}
        <rect x="120" y="105" width="20" height="230" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
        <rect x="200" y="105" width="20" height="230" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />

        {/* Crossmembers */}
        <line x1="120" y1="160" x2="220" y2="160" stroke="#475569" strokeWidth="3" />
        <line x1="120" y1="220" x2="220" y2="220" stroke="#475569" strokeWidth="3" />
        <line x1="120" y1="280" x2="220" y2="280" stroke="#475569" strokeWidth="3" />

        {/* Front Axle */}
        <line x1="55" y1="90" x2="285" y2="90" stroke="#475569" strokeWidth="4" />
        {/* Front Tyres */}
        {renderTyre('FL', 20, 53, 'Front Left')}
        {renderTyre('FR', 276, 53, 'Front Right')}

        {/* Rear Axle (Dual Wheels on each side) */}
        <line x1="20" y1="270" x2="320" y2="270" stroke="#475569" strokeWidth="4" />
        {/* Rear Left Duals */}
        {renderTyre('RLO', 10, 233, 'Rear Left Outer')}
        {renderTyre('RLI', 62, 233, 'Rear Left Inner')}
        {/* Rear Right Duals */}
        {renderTyre('RRI', 234, 233, 'Rear Right Inner')}
        {renderTyre('RRO', 286, 233, 'Rear Right Outer')}

        {/* Rear Bumper */}
        <rect x="100" y="335" width="140" height="12" rx="3" fill="#334155" />
        <circle cx="115" cy="341" r="3" fill="#ef4444" />
        <circle cx="225" cy="341" r="3" fill="#ef4444" />
      </svg>
    </div>
  );
};
