# EcoStream Prototype - instructions for Claude Code

Read `docs/PROTOTYPE_SPEC.md` before doing anything. It is the source of truth.

## What this repo is
A Phase-1 prototype: ONE sensor type (truck tyre pressure + temperature) going all the way
from device (or simulator) → database → alert logic → live dashboard.
Other truck parameters (engine, fuel, CAN/J1939) come later as plug-ins. Do not build them now.

## Stack (do not change without asking)
- Frontend: React + Vite + TypeScript + Tailwind, in `/frontend`. Hosted on Vercel.
- Database + auth + realtime: Supabase (Postgres). Schema in `/supabase/migrations`.
- Backend: Python FastAPI as Vercel serverless functions, in `/api`.
- Simulator: Python script in `/simulator` that pretends to be the ESP32.
- Firmware (later): `/firmware` (ESP32-S3 + CC1101). Not part of Phase 1b.

## Rules
- Never commit secrets. Use `.env` (gitignored) and `.env.example`.
- Supabase service-role key is used ONLY in `/api`, never in the frontend.
- Row-level security ON for every table.
- All pressures stored in kPa gauge, temperatures in °C, times in UTC.
- Keep it simple: no MQTT, no Kafka, no Pathway in Phase 1b.
- Write tests for the alert logic (`/api/tests`) before wiring it to the UI.
- The repo is PRIVATE until the provisional patent is filed. Do not add public links.

## Owners
- Frontend: Rishi
- Backend + database: Hari
- Hardware/firmware + simulator: Adithya
