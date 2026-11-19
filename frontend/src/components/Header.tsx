import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRole, UserRole } from '../context/RoleContext';
import { useBackend } from '../context/BackendContext';
import { 
  Cpu, Wrench, CheckCircle2, FileText, Truck, 
  Layers, ShieldAlert, Sparkles, Activity
} from 'lucide-react';

export const Header: React.FC = () => {
  const location = useLocation();
  const { role, userName, setRole } = useRole();
  const { isOnline } = useBackend();

  const navItems = [
    { path: '/station', label: 'Station Guide', icon: Wrench },
    { path: '/demo', label: 'Demo Script', icon: Sparkles, highlight: true },
    { path: '/approvals', label: 'Approvals', icon: CheckCircle2 },
    { path: '/passports', label: 'Passports', icon: FileText },
    { path: '/fleet', label: 'Fleet Health', icon: Truck },
    { path: '/devices', label: 'Devices', icon: Cpu },
    { path: '/sops', label: 'SOPs', icon: Layers },
    { path: '/poc', label: 'POC Trials', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:border-emerald-400 group-hover:scale-105 transition">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white group-hover:text-emerald-300 transition">
                  EcoStream <span className="text-emerald-400">Dispatch</span>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                  v1.0
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>{isOnline ? 'Edge Telemetry Live' : 'Connecting to Edge…'}</span>
              </div>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-slate-800/80 text-emerald-400 ring-1 ring-slate-700'
                      : item.highlight
                      ? 'text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 ring-1 ring-amber-500/30 bg-amber-500/5'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side controls: Role Switcher & X Account */}
        <div className="flex items-center gap-3">
          {/* Role Switcher */}
          <div className="flex items-center gap-2 bg-slate-900/90 rounded-2xl p-1 border border-slate-800">
            <span className="hidden sm:inline-block pl-2 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Role:
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              aria-label="Active User Role"
              className="bg-slate-950 text-slate-200 text-xs font-medium rounded-xl px-2.5 py-1 border border-slate-700/80 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
            >
              <option value="operator">Operator (Line 1)</option>
              <option value="supervisor">Supervisor (PIN 1234)</option>
              <option value="quality">Quality Auditor</option>
            </select>
          </div>

          {/* Official X Link */}
          <a
            href="https://x.com/EcoStreamD"
            target="_blank"
            rel="noreferrer"
            title="Follow EcoStream on X (@EcoStreamD)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-sky-400 border border-slate-800 transition group text-xs font-medium"
          >
            {/* Custom X Logo SVG */}
            <svg className="w-3.5 h-3.5 fill-current text-slate-400 group-hover:text-sky-400" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="hidden md:inline">@EcoStreamD</span>
          </a>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex xl:hidden overflow-x-auto items-center gap-1.5 pt-2 mt-2 border-t border-slate-800/60 pb-1 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-300 bg-slate-900/60 border border-slate-800/60'
              }`}
            >
              <Icon className="w-3 h-3" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
};
