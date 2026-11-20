# Simulator: pretends to be the ESP32 (spec section 7). Owner: Adithya.

2 trucks × 6 tyres, one reading per tyre every 10 s, driving Chennai → Salem.
Tyres warm from 30 °C to ~55 °C over the first hour and pressure rises with them
(corrected pressure stays flat). Plain Python 3.10+, no packages to install.

## One-time setup (after docs/SUPABASE_SETUP.md)
1. Make sure `.env` (repo root) has `DEVICE_KEY_SALT` set.
2. Create a key for each simulated device. From the `api` folder, with its venv active:
   ```bash
   python scripts/new_device_key.py --device-id 11111111-1111-4111-8111-000000000101 --env-name SIM_DEVICE_KEY_TRUCK1
   python scripts/new_device_key.py --device-id 11111111-1111-4111-8111-000000000102 --env-name SIM_DEVICE_KEY_TRUCK2
   ```
   Each one saves the key into `.env` and prints an `update public.devices ...` line.
   Paste **both** lines into Supabase → SQL Editor → Run.

## Run
Start the API first (see `api/README.md`), then from the repo root:
```bash
python3 simulator/simulate.py                                   # normal driving
python3 simulator/simulate.py --leak TRUCK1:RL-O:3psi_per_hour  # slow leak (alert within ~10-20 min)
python3 simulator/simulate.py --hot TRUCK2:FR:95C               # hot tyre: high_temp only, no leak alert
python3 simulator/simulate.py --offline TRUCK1:FL               # sensor stops after 1 min: alert ~10 min later
python3 simulator/simulate.py --dry-run --once                  # print one batch, send nothing
```
Flags combine. `--api https://your-app.vercel.app` sends to the deployed API. Ctrl+C stops.

Each line shows what was sent and stored, and any **NEW ALERTS** the API raised.

| Truck | Device ID | Sensor IDs (FL, FR, RL-O, RL-I, RR-I, RR-O) |
|---|---|---|
| TRUCK1 (TN 99 ZZ 0001) | `...000000000101` | 1A0001 … 1A0006 |
| TRUCK2 (TN 99 ZZ 0002) | `...000000000102` | 2A0001 … 2A0006 |

These match `supabase/seed.sql`. The real ESP32 must send the same JSON (see `--dry-run`).
