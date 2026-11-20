import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, CheckCircle2, Shield, Wrench, Truck, 
  Cpu, Eye, Sparkles, AlertTriangle, Layers, Activity
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-24 py-8 px-4 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tabletop Motor Workstation & Fleet Telemetry Demo</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Edge-Stream Operations & <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400">
            Predictive Dispatch Intelligence
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          From manual motor workstation changeovers to commercial truck fleets: EcoStream Dispatch ingests live sensor streams from ESP32 edge devices and AprilTag overhead vision, catches errors before they leave the station, and records immutable digital passports.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4" />
            Start 2-Minute Scripted Demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/station"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm border border-slate-700 transition"
          >
            <Wrench className="w-4 h-4 text-emerald-400" />
            Open Operator Station
          </Link>
          <Link
            to="/fleet"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm border border-slate-700 transition"
          >
            <Truck className="w-4 h-4 text-sky-400" />
            Explore Fleet Health
          </Link>
        </div>

        {/* X Follow Card */}
        <div className="pt-6 max-w-md mx-auto">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">EcoStream Dispatch</div>
                <div className="text-[11px] text-slate-400">Official product updates on X</div>
              </div>
            </div>
            <a
              href="https://x.com/EcoStreamD"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
            >
              Follow @EcoStreamD
            </a>
          </div>
        </div>
      </section>

      {/* Architecture Flow Section */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">How It Works</h2>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">From Edge Telemetry to Actionable Enforcement</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-6 rounded-3xl bg-slate-900/50 ring-1 ring-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono">
              01
            </div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              Edge Sensors
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Overhead cameras detect AprilTag 36h11 markers on fixtures and trays; ESP32 devices stream calibrated digital tool presets and torque.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/50 ring-1 ring-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold font-mono">
              02
            </div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              ESP32 Light Edge
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Embedded microcontrollers buffer telemetry, validate signal integrity, and push live HTTP updates into the cloud dispatcher.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/50 ring-1 ring-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono">
              03
            </div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Deterministic Engine
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enforces zero-skip step progression, checks loaded SOP approvals, blocks incorrect fixtures, and flags deviations with rule-based fixes.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/50 ring-1 ring-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold font-mono">
              04
            </div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              Digital Passport
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supervisor signs with PIN 1234. Generates an immutable changeover certificate hashed with SHA-256 for audit and quality assurance.
            </p>
          </div>
        </div>
      </section>

      {/* The Two Modules Overview */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">Dual Modules</h2>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">Integrated Platform Capabilities</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Module 1 Card */}
          <div className="p-8 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 hover:ring-emerald-500/50 transition space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold">
              <Wrench className="w-3.5 h-3.5" />
              Headline Demo • Module 1
            </div>

            <div className="space-y-2">
              <h4 className="text-xl font-bold text-white">Station Changeover Guide</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Manual motor assembly workstation building Motor A and Motor B. The engine computes an automated diff of what changes, guides the operator, verifies tooling via camera and ESP32, and records deviations.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Overhead AprilTag verification (TAG-A-01 → TAG-B-02)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>ESP32 digital tool preset verification (8.0 Nm → 12.5 Nm)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Superseded SOP detection (v2.0 blocked, v2.1 required)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Supervisor PIN approval & SHA-256 Digital Passport</span>
              </div>
            </div>

            <Link
              to="/station"
              className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
            >
              Open Workstation Changeover Guide ➔
            </Link>
          </div>

          {/* Module 2 Card */}
          <div className="p-8 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 hover:ring-sky-500/50 transition space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs font-semibold">
              <Truck className="w-3.5 h-3.5" />
              Predictive Maintenance • Module 2
            </div>

            <div className="space-y-2">
              <h4 className="text-xl font-bold text-white">Fleet Predictive Health</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Continuous telemetry from 12 commercial freightliner trucks operating across Chennai logistics corridors. Computes linear regression slope ($m$) to predict time until critical minimum threshold (93.5 PSI).
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>12 Chennai trucks with 6-tyre pneumatic & thermal telemetry</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Least-squares linear regression (t_remaining = (P - P_min) / -m)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Fault injection: Slow Leak, Sudden Drop, Thermal Overheat</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Ask-EcoStream rule-based diagnostic checklists</span>
              </div>
            </div>

            <Link
              to="/fleet"
              className="inline-flex items-center gap-2 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
            >
              Inspect Fleet Predictive Health ➔
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
