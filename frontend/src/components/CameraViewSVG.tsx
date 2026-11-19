import React from 'react';

interface CameraViewSVGProps {
  mountedFixtureTag: string;
  expectedFixtureTag?: string;
  mountedTrayTag: string;
  expectedTrayTag?: string;
  cameraOnline: boolean;
}

export const CameraViewSVG: React.FC<CameraViewSVGProps> = ({
  mountedFixtureTag,
  expectedFixtureTag,
  mountedTrayTag,
  expectedTrayTag,
  cameraOnline
}) => {
  const isFixtureValid = !expectedFixtureTag || mountedFixtureTag === expectedFixtureTag;
  const isTrayValid = !expectedTrayTag || mountedTrayTag === expectedTrayTag;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/90 p-3 shadow-inner">
      {/* Camera HUD overlay */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur px-2 py-1 rounded border border-slate-800 text-[10px] font-mono text-slate-300">
        <span className={`w-2 h-2 rounded-full ${cameraOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
        <span>CAM-OVERHEAD-01 (30 FPS • 1080p)</span>
      </div>

      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur px-2 py-1 rounded border border-slate-800 text-[10px] font-mono text-emerald-400">
        <span>AprilTag 36h11 CV</span>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox="0 0 500 280"
        className="w-full h-auto select-none font-mono"
        style={{ filter: cameraOnline ? 'none' : 'grayscale(100%) opacity(40%)' }}
      >
        <defs>
          <pattern id="station-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Worktable Surface */}
        <rect x="10" y="10" width="480" height="260" rx="12" fill="#090d16" stroke="#1e293b" strokeWidth="2" />
        <rect x="10" y="10" width="480" height="260" rx="12" fill="url(#station-grid)" />

        {/* Workstation Conveyor Line */}
        <line x1="10" y1="140" x2="490" y2="140" stroke="#1e293b" strokeDasharray="6 6" strokeWidth="1.5" />
        <text x="20" y="134" fill="#475569" fontSize="9" letterSpacing="1">CONVEYOR FEED ➔</text>

        {/* 1. Assembly Fixture Zone (Left/Center) */}
        <g transform="translate(60, 45)">
          {/* Base plate */}
          <rect
            x="0"
            y="0"
            width="170"
            height="180"
            rx="8"
            fill={isFixtureValid ? '#064e3b15' : '#88133715'}
            stroke={isFixtureValid ? '#059669' : '#e11d48'}
            strokeWidth="1.5"
          />
          {/* Alignment dowel pins */}
          <circle cx="20" cy="20" r="5" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="150" cy="20" r="5" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="20" cy="160" r="5" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="150" cy="160" r="5" fill="#334155" stroke="#64748b" strokeWidth="1.5" />

          {/* Motor Stator Outline */}
          <circle cx="85" cy="90" r="42" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="85" cy="90" r="18" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />

          {/* AprilTag Fiducial Target */}
          <g transform="translate(55, 60)">
            <rect
              x="0"
              y="0"
              width="60"
              height="60"
              fill="#000000"
              stroke={isFixtureValid ? '#10b981' : '#f43f5e'}
              strokeWidth="2"
            />
            {/* Tag pattern representation */}
            <rect x="12" y="12" width="18" height="18" fill="#ffffff" />
            <rect x="30" y="30" width="18" height="18" fill="#ffffff" />
            <rect x="12" y="30" width="10" height="10" fill="#ffffff" />

            {/* Bounding Box Brackets */}
            <path d="M -6 -6 L 4 -6 M -6 -6 L -6 4" stroke={isFixtureValid ? '#34d399' : '#fb7185'} strokeWidth="2" fill="none" />
            <path d="M 66 -6 L 56 -6 M 66 -6 L 66 4" stroke={isFixtureValid ? '#34d399' : '#fb7185'} strokeWidth="2" fill="none" />
            <path d="M -6 66 L 4 66 M -6 66 L -6 56" stroke={isFixtureValid ? '#34d399' : '#fb7185'} strokeWidth="2" fill="none" />
            <path d="M 66 66 L 56 66 M 66 66 L 66 56" stroke={isFixtureValid ? '#34d399' : '#fb7185'} strokeWidth="2" fill="none" />
          </g>

          {/* Tag Detection Pill */}
          <rect
            x="15"
            y="135"
            width="140"
            height="22"
            rx="4"
            fill={isFixtureValid ? '#022c22' : '#4c0519'}
            stroke={isFixtureValid ? '#059669' : '#e11d48'}
            strokeWidth="1"
          />
          <text
            x="85"
            y="149"
            textAnchor="middle"
            fill={isFixtureValid ? '#6ee7b7' : '#fca5a5'}
            fontSize="10"
            fontWeight="bold"
          >
            {mountedFixtureTag} ({isFixtureValid ? 'PASS 99.4%' : 'MISMATCH'})
          </text>
          <text x="85" y="172" textAnchor="middle" fill="#64748b" fontSize="8">
            FIXTURE NEST #{mountedFixtureTag.includes('B') ? '02' : '01'}
          </text>
        </g>

        {/* 2. Component Kit Tray Zone (Right) */}
        <g transform="translate(270, 45)">
          <rect
            x="0"
            y="0"
            width="170"
            height="180"
            rx="8"
            fill={isTrayValid ? '#064e3b15' : '#88133715'}
            stroke={isTrayValid ? '#059669' : '#e11d48'}
            strokeWidth="1.5"
          />
          {/* Subcomponent Compartments */}
          <rect x="15" y="15" width="60" height="40" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1" />
          <rect x="85" y="15" width="70" height="40" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1" />
          <rect x="15" y="65" width="60" height="55" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1" />

          {/* AprilTag Fiducial on Tray */}
          <g transform="translate(90, 65)">
            <rect
              x="0"
              y="0"
              width="55"
              height="55"
              fill="#000000"
              stroke={isTrayValid ? '#10b981' : '#f43f5e'}
              strokeWidth="2"
            />
            <rect x="10" y="10" width="16" height="16" fill="#ffffff" />
            <rect x="28" y="28" width="16" height="16" fill="#ffffff" />

            {/* Bounding box corners */}
            <path d="M -5 -5 L 4 -5 M -5 -5 L -5 4" stroke={isTrayValid ? '#34d399' : '#fb7185'} strokeWidth="2" fill="none" />
            <path d="M 60 -5 L 51 -5 M 60 -5 L 60 4" stroke={isTrayValid ? '#34d399' : '#fb7185'} strokeWidth="2" fill="none" />
            <path d="M -5 60 L 4 60 M -5 60 L -5 51" stroke={isTrayValid ? '#34d399' : '#fb7185'} strokeWidth="2" fill="none" />
            <path d="M 60 60 L 51 60 M 60 60 L 60 51" stroke={isTrayValid ? '#34d399' : '#fb7185'} strokeWidth="2" fill="none" />
          </g>

          {/* Tray Tag Pill */}
          <rect
            x="15"
            y="135"
            width="140"
            height="22"
            rx="4"
            fill={isTrayValid ? '#022c22' : '#4c0519'}
            stroke={isTrayValid ? '#059669' : '#e11d48'}
            strokeWidth="1"
          />
          <text
            x="85"
            y="149"
            textAnchor="middle"
            fill={isTrayValid ? '#6ee7b7' : '#fca5a5'}
            fontSize="10"
            fontWeight="bold"
          >
            {mountedTrayTag} ({isTrayValid ? 'PASS 99.1%' : 'MISMATCH'})
          </text>
          <text x="85" y="172" textAnchor="middle" fill="#64748b" fontSize="8">
            COMPONENT TRAY STAGING
          </text>
        </g>
      </svg>
    </div>
  );
};
