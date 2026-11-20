# API: FastAPI backend (Vercel Python functions). Owner: Hari.

| File | What |
|---|---|
| `index.py` | The FastAPI app: every endpoint from spec section 5. HTTP only, no business logic. |
| `ingest.py` | What `/api/ingest` does: validate, correct, store, run alert logic, store alerts |
| `alert_logic.py` | Temperature correction + all alert rules (spec section 4). Pure Python. |
| `alert_config.py` | Every threshold in one place. Tune here. |
| `fleet.py` | Truck/tyre status and nearest open garages |
| `db.py` | All Supabase access (service role for ingest, owner's token + RLS for everything else) |
| `security.py` | Device-key hashing, reading the login token |
| `settings.py` | Environment variables (from the repo-root `.env` locally) |
| `scripts/new_device_key.py` | Creates a device key (see `simulator/README.md`) |
| `tests/` | 54 pytest tests (alert rules, ingest, API, status, garages, simulator end-to-end) |

## Set up and test
Needs Python 3.10+.
```bash
cd api
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -v
```
Tests use an in-memory fake database, so they need no Supabase account and no `.env`.

## Run locally
Needs `.env` filled in (`docs/SUPABASE_SETUP.md`).
```bash
cd api && source .venv/bin/activate
uvicorn index:app --reload --port 8000
```
- http://localhost:8000/api/health → `{"ok": true}`
- http://localhost:8000/docs → try every endpoint in the browser

## Endpoints (spec section 5)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/ingest` | `X-Device-Key` | ≤ 500 readings. Bad readings are skipped and listed in `rejected`, the rest are stored. |
| GET | `/api/trucks` | owner | Trucks + latest tyre status (same shape as `TruckSummary` in `frontend/src/types.ts`) |
| GET | `/api/trucks/{id}/readings?from=&to=` | owner | ISO times; default last 2 h, max 24 h |
| GET | `/api/alerts?open=true` | owner | `open=false` for acknowledged, leave out for all |
| POST | `/api/alerts/{id}/ack` | owner | 404 if not the owner's alert |
| GET | `/api/garages/nearest?lat=&lon=&service=tyre` | owner | 3 nearest open now (IST), straight-line km |
| GET | `/api/health` | none | `{"ok": true}` |

Owner = `Authorization: Bearer <Supabase access token>` (the frontend sends it after login, Stage 6).

## Try ingest with curl
```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" -H "X-Device-Key: $SIM_DEVICE_KEY_TRUCK1" \
  -d '{"device_id":"11111111-1111-4111-8111-000000000101","readings":[{"sensor_id":"1A0001","ts":"2026-11-20T10:00:00Z","pressure_kpa":850,"temp_c":35}]}'
```

## The alert rules in one screen
Everything compares **corrected** pressure (the pressure at 20 °C), so a tyre heating up or
cooling down never looks like a leak.

| Alert | Fires when | Severity |
|---|---|---|
| critical_pressure | corrected < 80% of recommended | critical |
| low_pressure | corrected < 90% for 3 readings in a row (not raised if critical already is) | warning |
| slow_leak | regression slope over last 30 min < −13.8 kPa/h (≈ −2 psi/h); needs ≥ 10 readings spanning ≥ 10 min | warning, critical below −41 kPa/h |
| high_temp | temp > tyre's max_temp_c (default 85 °C) | warning |
| sensor_offline | tyre silent ≥ 10 min while its device is still sending (not for sensors that never reported) | warning |

Same type for the same tyre is not raised again within 30 minutes.
