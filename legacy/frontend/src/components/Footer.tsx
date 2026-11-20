import React from 'react';
import { Shield, Eye, Cpu, Terminal, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="no-print bg-slate-950 border-t border-slate-900 mt-20 text-slate-400 text-xs py-10 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Disclosures & Architecture Badges */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-200">Overhead Vision</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Classical AprilTag fiducial detection via simulated 36h11 marker tracking (zero probabilistic hallucinations).
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-200">Workflow Engine</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Deterministic finite state machine with zero-skip enforcement and immutable SHA-256 passports.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Cpu className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-200">Edge Telemetry</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Simulated ESP32 microcontroller streaming calibrated torque presets and pneumatic tire telemetry.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-200">Predictive Math</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Ordinary least-squares linear regression ($PSI/h$) with $R^2$ stability gating for time-to-threshold.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom info */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-900 text-slate-400">
          <div className="flex items-center gap-3">
            <span>© 2026 EcoStream Dispatch Systems. Demo environment.</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400/80">All seed parameters and thresholds are demo defaults.</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://x.com/EcoStreamD"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-300 hover:text-sky-400 transition"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow on X (@EcoStreamD)
              <ArrowUpRight className="w-3 h-3 text-slate-500" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
