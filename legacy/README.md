# EcoStream Dispatch

**Edge-Stream Predictive Maintenance & Deterministic Guided Operations Platform**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB?logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![X Follow](https://img.shields.io/badge/Follow-%40EcoStreamD-0ea5e9?logo=x)](https://x.com/EcoStreamD)

Official X Account: [@EcoStreamD](https://x.com/EcoStreamD)

---

## 1. Product Overview

**EcoStream Dispatch** is a dual-module industrial operations platform built on live sensor streams from edge devices (simulating ESP32 microcontrollers and classical computer vision AprilTag tracking). The platform ingests telemetry, detects faults and deviations early, guides floor operators step-by-step, enforces zero-skip quality gates, and generates immutable cryptographic records.

### Module 1 — Station Changeover Guide (Headline Demo)
- **Scenario**: A manual electric-motor assembly line alternating between **Motor A** (`MTR-A-STD`) and **Motor B** (`MTR-B-PRO`) at a tabletop workstation.
- **Problem**: Monolithic 40-line paper checklists rely on operator tribal memory. Operators forget to swap fixtures, leave tools on outdated presets, skip dielectric checks, or assemble against obsolete SOP revisions—leading to scrap and line downtime caught only at end-of-line testing.
- **Solution**: 
  1. Computes an automated **config diff** between Motor A and Motor B, showing only the 4 changed parameters plus 2 mandatory quality gates.
  2. Verifies physical fixture and tray AprilTags via overhead camera.
  3. Verifies torque tool presets (8.0 Nm vs 12.5 Nm) via ESP32 telemetry.
  4. Enforces strict sequential order: skips return HTTP 409 Conflict.
  5. Flags deviations with rule-based root cause explanations and fixes.
  6. Requires supervisor signoff (PIN `1234`), generating a tamper-evident **Digital Changeover Passport** sealed with SHA-256.

### Module 2 — Fleet Health (Predictive Maintenance)
- **Scenario**: Telemetry from 12 commercial freightliner trucks operating across Chennai industrial corridors (e.g., Ennore Port, Sriperumbudur, Oragadam Auto Cluster), monitoring 6 wheel positions per vehicle (72 nodes).
- **Predictive Engine**: Computes ordinary least-squares linear regression slope ($m = \text{d}P/\text{d}t$ in $\text{PSI/h}$) over a rolling window. When slope is negative and fit is stable ($R^2 > 0.6$), predicts remaining time until the 85% critical threshold ($93.5\text{ PSI}$):
  $$t_{\text{remaining}} = \frac{P_{\text{current}} - 93.5}{|m|}$$
- **Features**: Interactive 6-wheel chassis diagram, dynamic trend chart with warning (95% = 104.5 PSI) and critical (85% = 93.5 PSI) lines, fault scenario injection (`slow_leak`, `sudden_drop`, `overheat`), and an "Ask-EcoStream" rule-based diagnostic engine.

---

## 2. System Architecture

```
   [ Overhead Vision Camera ]       [ ESP32 Smart Torque Tool ]       [ Commercial Truck TPMS ]
        (AprilTag 36h11)                  (ESP-IDF / Wi-Fi)              (6-Tyre Pressure/Temp)
               │                                   │                                │
               ▼                                   ▼                                ▼
     POST /device/tag-detections          POST /device/tool-preset           POST /sim/inject
               │                                   │                                │
               └───────────────────────────┬────────────────────────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │     EcoStream FastAPI Dispatcher       │
                       │────────────────────────────────────────│
                       │ • Deterministic State Machine Engine   │
                       │ • Automated Config Diff Generator      │
                       │ • Least-Squares Linear Predictor (OIS) │
                       │ • In-Memory Thread-Safe Data Store     │
                       │ • SSE Event Broadcaster (/api/events)  │
                       └────────────────────────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │       Vite + React 18 Ops UI           │
                       │────────────────────────────────────────│
                       │ • Tablet-First Operator Interface      │
                       │ • Scripted 2-Minute Demo Control Panel │
                       │ • Recharts Degradation Projection      │
                       │ • Printable SHA-256 Digital Passport   │
                       │ • Empirical POC Trial Ledger & Charts  │
                       └────────────────────────────────────────┘
```

> **Pathway Integration Note**: In high-throughput industrial deployments, the in-memory simulator and least-squares regression can be replaced with a streaming [Pathway](https://pathway.com) pipeline (`pathway.io.http`, `pw.temporal`, `pw.ml`) for distributed real-time windowing and predictive regression without changing the consumer REST or SSE interfaces.

---

## 3. Quickstart: Run Locally in 3 Commands

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

```bash
# 1. Clone repository
git clone https://github.com/EcoStream-Dispatch/EcoStream.git && cd EcoStream

# 2. Setup and run Backend (Terminal 1)
python3.11 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
PYTHONPATH=backend backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8780

# 3. Setup and run Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## 4. Hardware Simulation Scripts

EcoStream Dispatch includes standalone scripts that mimic real physical IoT hardware transmitting telemetry over HTTP:

### ESP32 Smart Tool Simulator (`scripts/esp32_sim.py`)
Simulates a digital torque wrench or screwdriver posting calibrated preset and torque readings over Wi-Fi:
```bash
# Send Tool Preset 2 (12.5 Nm)
python backend/scripts/esp32_sim.py http://localhost:8780 preset_2

# Send Tool Preset 1 (8.0 Nm)
python backend/scripts/esp32_sim.py http://localhost:8780 preset_1
```

### Overhead AprilTag Camera Simulator (`scripts/camera_sim.py`)
Simulates an overhead OpenCV / AprilTag detector transmitting identified tag IDs:
```bash
# Send Fixture B tag detection
python backend/scripts/camera_sim.py http://localhost:8780 TAG-B-02 fixture

# Send Fixture A tag detection (fault injection)
python backend/scripts/camera_sim.py http://localhost:8780 TAG-A-01 fixture

# Send Component Kit Tray B tag
python backend/scripts/camera_sim.py http://localhost:8780 TRAY-B-02 tray
```

---

## 5. Automated Verification & Testing

### Backend Unit Tests (Pytest)
The test suite enforces all 8 deterministic workflow rules, the config diff logic, and the least-squares prediction math:
```bash
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests -v
```

### Frontend Build Verification
Verify type safety and clean bundle generation:
```bash
cd frontend
npm run build
```

---

## 6. End-to-End Walkthrough Script

Visit `/demo` in the application for an interactive 2-minute walkthrough:
1. **Reset Demo Environment**: Resets physical state to Motor A baseline with superseded SOP v2.0 loaded.
2. **Start Motor B Changeover**: Auto-detects SOP mismatch, triggers reload to approved v2.1, and computes setup diff.
3. **Inject Fixture Fault**: Mounts Fixture A (`TAG-A-01`).
4. **Trigger Verification**: Vision camera flags mismatch; rule engine outputs root cause explanation and step-by-step fix.
5. **Apply Physical Correction**: Mounts Fixture B (`TAG-B-02`); re-verify passes and marks deviation corrected.
6. **Execute Remaining Steps**: Validates Tray B, confirms M5x16 fasteners, validates ESP32 12.5 Nm tool preset, confirms first-piece inspection, and confirms station readiness.
7. **Supervisor Signoff**: Enters supervisor PIN `1234`.
8. **Digital Passport**: Generates immutable certificate with SHA-256 seal and complete deviations audit log.
9. **Fleet Simulation**: Injects slow leak into Truck 04 rear-left tyre; least-squares model computes time-to-threshold countdown.

---

## 7. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check and state version |
| `POST` | `/api/sim/reset` | Resets in-memory state to seed baseline |
| `GET` | `/api/events` | Server-Sent Events (SSE) live telemetry stream |
| `GET` | `/api/station` | Current station variant, mounted tags, tool preset, SOP |
| `POST` | `/api/sim/station` | Fault injection & physical hardware simulation |
| `POST` | `/api/device/tag-detections` | Vision camera AprilTag detection ingest |
| `POST` | `/api/device/tool-preset` | ESP32 tool preset & torque telemetry ingest |
| `POST` | `/api/changeovers` | Computes diff and launches changeover session |
| `POST` | `/api/changeovers/{id}/steps/{step_id}/verify` | Validates sensor step against physical state |
| `POST` | `/api/changeovers/{id}/steps/{step_id}/confirm` | Validates operator checklist item |
| `POST` | `/api/changeovers/{id}/reload-sop` | Synchronizes station to approved SOP |
| `POST` | `/api/changeovers/{id}/approve` | Supervisor PIN signoff & passport creation |
| `GET` | `/api/passports/{id}` | Fetches printable digital passport & SHA-256 hash |
| `GET` | `/api/poc/trials` | Fetches empirical paper vs SetWise comparative trials |
| `GET` | `/api/fleet` | Telemetry from 12 commercial trucks |
| `POST` | `/api/sim/inject` | Injects pneumatic/thermal scenarios on truck tyres |
| `POST` | `/api/diagnose` | Returns rule-based troubleshooting checklist |

---

## 8. Deployment Guide

### Backend → Render
1. Push repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** $\to$ **Web Service**.
3. Select this repository. Render automatically reads `render.yaml` and `backend/Dockerfile`.
4. Set environment variable `ALLOWED_ORIGINS` to your Vercel frontend URL (e.g. `https://ecostream-dispatch.vercel.app`).
5. Health check path: `/api/health`.

### Frontend → Vercel
1. In the [Vercel Dashboard](https://vercel.com), click **Add New...** $\to$ **Project**.
2. Import this repository.
3. Configure settings:
   - Framework Preset: **Vite**
   - Root Directory: **`frontend`**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add Environment Variable:
   - `VITE_API_BASE`: URL of your deployed Render backend (e.g. `https://ecostream-dispatch-backend.onrender.com`).
5. Click **Deploy**. Vercel will bundle the app and apply the SPA rewrite defined in `vercel.json`.

---

## 9. Technology Transparency & Hard Truths

- **AprilTag Vision**: Classical computer vision fiducial tracking using OpenCV / AprilTag 36h11 markers. Not probabilistic deep learning.
- **Workflow State Engine**: Deterministic finite state automaton with strict order and permission gating.
- **Explanations**: Deterministic rule-based expert system mapping fault codes to engineering countermeasures.
- **Predictive Math**: Ordinary least-squares linear regression ($PSI/h$) with Pearson $R^2$ stability filtering.
- **Thresholds**: Nominal 110 PSI, Warning <95% (104.5 PSI), Critical <85% (93.5 PSI). These are demo defaults; confirm with tyre manufacturer specifications before operational deployment.
- **Demo Data**: All baseline trials and fleet routes are labelled demo data.
