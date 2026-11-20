# EcoStream Dispatch - Prototype Spec (Phase 1b: tyre, end to end)

Version 0.1 - 20 Nov 2026. Business context: `EcoStream_Market_Research_v6.xlsx`
(sheets: Data Points Master, Hardware Proto vs Industry, Software & ML Architecture, App Screens, Phase Plan).

## 1. Goal
Show, on a live dashboard, a truck's tyre pressure and temperature, detect a slow leak or
low pressure correctly (temperature-corrected), alert the owner, and suggest the nearest
verified garage. Works with simulated data first, then with the real ESP32 + CC1101 + TPMS sensor.

### Done when (acceptance criteria)
1. Simulator sends readings for 2 trucks × 6 tyres every 10 s; the dashboard updates live without refresh.
2. A simulated slow leak (−3 psi/hour) raises a "slow leak" alert within 20 minutes.
3. A tyre that is hot but NOT leaking (pressure rises with temperature) raises NO alert.
4. Each alert shows the 3 nearest garages that are open now, with distance.
5. Owner can log in and sees only their own trucks (row-level security tested).
6. Alert logic has unit tests covering cases 2 and 3; all pass.

### Out of scope for now
Engine/CAN data, fuel, driver app, shipper app, dispatch/scheduling, payments, ML models,
WhatsApp (stub only), MQTT, Pathway streaming. These are later phases (see Phase Plan sheet).

## 2. Architecture (prototype)
```
TPMS sensor (433 MHz) -> CC1101 -> ESP32-S3 --HTTPS POST--> /api/ingest (Vercel, FastAPI)
simulator.py ---------------------------------^                 |
                                                                v
                                     Supabase Postgres (readings, alerts)
                                                                |
                                    Supabase Realtime ----> React dashboard (Vercel)
```
Why this differs from the industry plan (MQTT + TimescaleDB + AWS Mumbai): a prototype
needs to be cheap and simple. The industry version replaces `/api/ingest` with an MQTT
broker + stream processor; the database tables stay almost the same.

## 3. Database (Supabase / Postgres)
```
fleet_owners   id uuid pk (= auth.users.id), name, phone, company, created_at
trucks         id uuid pk, owner_id fk, reg_no, make, model, axle_config, created_at
devices        id uuid pk, truck_id fk, device_key_hash text, firmware, last_seen_at
tyres          id uuid pk, truck_id fk, position text  -- e.g. 'FL','FR','RL-O','RL-I','RR-O','RR-I'
               sensor_id text (TPMS ID), recommended_cold_kpa numeric, max_temp_c numeric default 85
readings       id bigint pk, tyre_id fk, ts timestamptz, pressure_kpa numeric, temp_c numeric,
               ambient_c numeric null, lat numeric null, lon numeric null, rssi int null,
               corrected_kpa numeric   -- computed on ingest (section 4)
alerts         id uuid pk, tyre_id fk, truck_id fk, type text ('low_pressure','critical_pressure',
               'slow_leak','high_temp','sensor_offline'), severity text ('warning','critical'),
               value numeric, message text, created_at, acknowledged_at null
garages        id uuid pk, name, lat, lon, phone, open_24x7 bool, opens time, closes time,
               services text[] ('tyre','air_brake','engine'), verified bool
```
- Index `readings (tyre_id, ts desc)`.
- RLS: owners can read trucks/tyres/readings/alerts where truck.owner_id = auth.uid().
  Garages are readable by any logged-in user. Inserts into readings/alerts only via the API (service role).
- Keep 30 days of raw readings in the prototype; delete older rows with a scheduled job.

## 4. Alert logic (the core - test this first)
Tyre pressure changes with temperature, so compare pressures at a reference temperature.
Gauge pressure must be converted to absolute pressure first:

```
P_atm      = 101.325 kPa
T_ref      = 20 °C  (293.15 K)
P_abs      = pressure_kpa + P_atm
corrected_kpa = P_abs * (T_ref_K / (temp_c + 273.15)) - P_atm
```

Rules (all thresholds configurable per tyre / in one config file):
| Alert | Rule | Severity |
|---|---|---|
| low_pressure | corrected < 90% of recommended_cold_kpa for 3 readings in a row | warning |
| critical_pressure | corrected < 80% of recommended_cold_kpa | critical |
| slow_leak | slope of corrected_kpa over last 30 min (linear regression, ≥ 10 points) < −13.8 kPa/hour (≈ −2 psi/h) | warning (critical if < −41 kPa/h) |
| high_temp | temp_c > max_temp_c (default 85 °C) | warning |
| sensor_offline | no reading for 10 min while device is online | warning |

- De-duplicate: do not create the same alert type for the same tyre again within 30 minutes.
- The thresholds above are starting guesses - tune with real data. Truck tyres are usually
  around 7.5-9 bar cold; take the real value from the tyre sidewall / fleet's rule.

## 5. API (FastAPI on Vercel, folder `/api`)
| Method | Path | Who | What |
|---|---|---|---|
| POST | /api/ingest | device / simulator (header `X-Device-Key`) | batch of readings; validates, computes corrected_kpa, stores, runs alert logic |
| GET | /api/trucks | owner (Supabase JWT) | owner's trucks with latest tyre status |
| GET | /api/trucks/{id}/readings?from=&to= | owner | history for charts |
| GET | /api/alerts?open=true | owner | alerts |
| POST | /api/alerts/{id}/ack | owner | acknowledge |
| GET | /api/garages/nearest?lat=&lon=&service=tyre | owner | 3 nearest open garages (haversine distance; check open_24x7 or opens/closes in IST) |
| GET | /api/health | anyone | ok |

Ingest body:
```json
{ "device_id": "uuid", "readings": [
  { "sensor_id": "A1B2C3", "ts": "2026-11-20T10:00:00Z", "pressure_kpa": 820.5,
    "temp_c": 41.2, "lat": 11.2189, "lon": 78.1674, "rssi": -71 } ] }
```
Device keys are stored hashed (sha256). Reject readings with impossible values
(pressure < 0 or > 1500 kPa, temp < −40 or > 150 °C).

## 6. Frontend (React, folder `/frontend`) - Owner only for now
1. Login (Supabase email OTP or email+password).
2. Fleet page: card per truck - reg no, status (OK / warning / critical), last seen.
3. Truck page: tyre layout diagram (6 or 10 wheels) coloured by status; per-tyre pressure,
   corrected pressure, temperature; chart of last 2 hours (pressure + corrected + temp).
4. Alerts page: list, filter open/closed, acknowledge button; each alert shows 3 nearest garages
   with distance, phone, open-now flag.
5. Live updates through Supabase Realtime on `readings` and `alerts`.
Plain, readable design; mobile first (owners use phones). English first; Tamil/Hindi later.

## 7. Simulator (`/simulator/simulate.py`)
- 2 trucks × 6 tyres, one reading per tyre every 10 s, route along Chennai → Salem
  (interpolate lat/lon).
- Normal: temperature rises from ambient 30 °C to ~55 °C over the first hour while driving;
  pressure rises with it (so corrected stays flat).
- Scenario flags: `--leak TRUCK1:RL-O:3psi_per_hour`, `--hot TRUCK2:FR:95C`, `--offline TRUCK1:FL`.
- Sends to /api/ingest with the device key from `.env`.

## 8. Seed data
- 1 owner, 2 trucks (e.g. Tata Signa 4825.T, Ashok Leyland 3520), tyres with recommended 830 kPa.
- 10-15 garages along Chennai-Krishnagiri-Salem-Namakkal. Use clearly fake names
  ("Sample Tyre Works 1") until Rishi collects real verified garages.

## 9. Environment variables (`.env.example`)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=          # frontend
SUPABASE_SERVICE_ROLE_KEY=  # backend only
DEVICE_KEY_SALT=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE=
```

## 10. Build order for Claude Code
1. Supabase migration (tables, indexes, RLS) + seed script.
2. `alert_logic.py` + unit tests (section 4) - must pass before step 3.
3. FastAPI endpoints + local run (`uvicorn`), test with curl.
4. Simulator; check readings + alerts appear in Supabase.
5. React dashboard pages 1-4, then Realtime.
6. Deploy: Supabase project, Vercel (frontend + /api), set env vars.
7. Check every acceptance criterion in section 1 and write the results in `docs/STATUS.md`.

## 11. Next phases (not now)
Real ESP32 firmware (Test 2-4), WhatsApp alerts, engine/CAN plug-in, ML (anomaly detection on
simulated + Scania APS / NASA C-MAPSS / AI4I public data), driver + shipper apps, dispatch.
