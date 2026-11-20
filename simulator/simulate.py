"""
EcoStream simulator: pretends to be the ESP32 on two trucks (spec section 7).

Every 10 seconds each truck sends one reading per tyre (6 tyres) to POST /api/ingest,
exactly like the real device will.

    python simulator/simulate.py                                   # normal driving
    python simulator/simulate.py --leak TRUCK1:RL-O:3psi_per_hour  # slow leak
    python simulator/simulate.py --hot TRUCK2:FR:95C               # hot tyre, no leak
    python simulator/simulate.py --offline TRUCK1:FL               # sensor stops after 1 min
    python simulator/simulate.py --dry-run --once                  # print one batch, send nothing

Flags can be combined and repeated. Ctrl+C to stop.

Needs in the repo-root .env (see simulator/README.md):
    SIM_API_URL=http://localhost:8000
    SIM_DEVICE_KEY_TRUCK1=...   (made by api/scripts/new_device_key.py)
    SIM_DEVICE_KEY_TRUCK2=...

No extra Python packages needed - only the standard library.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

P_ATM_KPA = 101.325
T_REF_K = 293.15
KPA_PER_PSI = 6.894757

# Must match supabase/seed.sql (fixed device IDs and sensor IDs).
POSITIONS = ["FL", "FR", "RL-O", "RL-I", "RR-I", "RR-O"]
TRUCKS = {
    "TRUCK1": {
        "device_id": "11111111-1111-4111-8111-000000000101",
        "sensor_prefix": "1A000",
        "key_env": "SIM_DEVICE_KEY_TRUCK1",
        "route_start": 0.0,  # starts in Chennai
    },
    "TRUCK2": {
        "device_id": "11111111-1111-4111-8111-000000000102",
        "sensor_prefix": "2A000",
        "key_env": "SIM_DEVICE_KEY_TRUCK2",
        "route_start": 0.3,  # starts 30% of the way along
    },
}

# Chennai -> Salem along the highway (lat, lon)
ROUTE = [
    (13.0827, 80.2707),  # Chennai
    (12.9675, 79.9419),  # Sriperumbudur
    (12.9165, 79.1325),  # Vellore
    (12.6820, 78.6206),  # Vaniyambadi
    (12.5186, 78.2137),  # Krishnagiri
    (12.1277, 78.1579),  # Dharmapuri
    (11.6643, 78.1460),  # Salem
]
ROUTE_KM = 340
SPEED_KMH = 50

AMBIENT_C = 30.0
NORMAL_RUNNING_C = 55.0  # spec: ~55 °C after the first hour
RECOMMENDED_KPA = 830.0  # seed data
OFFLINE_AFTER_S = 60  # an --offline sensor works for 1 minute, then goes quiet


# ---------------------------------------------------------------------------
# Physics, kept simple
# ---------------------------------------------------------------------------


def gauge_from_corrected(corrected_kpa: float, temp_c: float) -> float:
    """What the gauge reads at temp_c if the tyre's pressure at 20 °C is corrected_kpa."""
    return (corrected_kpa + P_ATM_KPA) * ((temp_c + 273.15) / T_REF_K) - P_ATM_KPA


def point_on_route(fraction: float) -> tuple[float, float]:
    """Lat/lon at a fraction (0..1) of the way from Chennai to Salem. Loops back after Salem."""
    f = fraction % 1.0
    x = f * (len(ROUTE) - 1)
    i = min(int(x), len(ROUTE) - 2)
    t = x - i
    (a_lat, a_lon), (b_lat, b_lon) = ROUTE[i], ROUTE[i + 1]
    return a_lat + (b_lat - a_lat) * t, a_lon + (b_lon - a_lon) * t


@dataclass
class TyreSim:
    position: str
    sensor_id: str
    fill_kpa: float  # pressure at 20 °C when the trip started
    leak_kpa_per_hour: float = 0.0
    hot_target_c: float | None = None
    goes_offline: bool = False

    def reading(self, elapsed_s: float, rnd: random.Random) -> dict | None:
        if self.goes_offline and elapsed_s > OFFLINE_AFTER_S:
            return None
        hours = elapsed_s / 3600

        # Normal: warms from ambient towards ~55 °C over the first hour.
        temp = AMBIENT_C + (NORMAL_RUNNING_C - AMBIENT_C) * (1 - math.exp(-3 * hours))
        if self.hot_target_c is not None:
            # Hot scenario (e.g. dragging brake): heads to the target over ~20 minutes.
            temp = AMBIENT_C + (self.hot_target_c - AMBIENT_C) * (1 - math.exp(-elapsed_s / 400))
        temp += rnd.uniform(-0.3, 0.3)

        # Corrected pressure stays flat unless leaking; the gauge rises with temperature.
        corrected = self.fill_kpa - self.leak_kpa_per_hour * hours
        pressure = gauge_from_corrected(corrected, temp) + rnd.uniform(-1.0, 1.0)

        return {
            "sensor_id": self.sensor_id,
            "pressure_kpa": round(pressure, 1),
            "temp_c": round(temp, 1),
            "ambient_c": AMBIENT_C,
        }


@dataclass
class TruckSim:
    name: str
    device_id: str
    key_env: str
    route_start: float
    tyres: list[TyreSim] = field(default_factory=list)

    def batch(self, elapsed_s: float, now: datetime, rnd: random.Random) -> dict:
        """One /api/ingest body: a reading for every tyre still sending."""
        lat, lon = point_on_route(self.route_start + SPEED_KMH * elapsed_s / 3600 / ROUTE_KM)
        readings = []
        for t in self.tyres:
            r = t.reading(elapsed_s, rnd)
            if r is None:
                continue
            r.update(
                ts=now.isoformat().replace("+00:00", "Z"),
                lat=round(lat, 5),
                lon=round(lon, 5),
                rssi=rnd.randint(-82, -60),
            )
            readings.append(r)
        return {"device_id": self.device_id, "readings": readings}


# ---------------------------------------------------------------------------
# Scenario flags
# ---------------------------------------------------------------------------


def _truck_and_tyre(trucks: dict[str, TruckSim], spec: str) -> tuple[TruckSim, TyreSim, list[str]]:
    parts = spec.split(":")
    if len(parts) < 2:
        raise ValueError(f"'{spec}': expected TRUCK:POSITION[:VALUE]")
    truck = trucks.get(parts[0].upper())
    if truck is None:
        raise ValueError(f"'{spec}': unknown truck {parts[0]} (use {', '.join(trucks)})")
    tyre = next((t for t in truck.tyres if t.position == parts[1].upper()), None)
    if tyre is None:
        raise ValueError(f"'{spec}': unknown tyre {parts[1]} (use {', '.join(POSITIONS)})")
    return truck, tyre, parts[2:]


def apply_leak(trucks, spec: str) -> None:
    """--leak TRUCK1:RL-O:3psi_per_hour   (or 20kpa_per_hour)"""
    _, tyre, rest = _truck_and_tyre(trucks, spec)
    m = re.fullmatch(r"(\d+(?:\.\d+)?)(psi|kpa)_per_hour", rest[0].lower()) if rest else None
    if not m:
        raise ValueError(f"'{spec}': rate must look like 3psi_per_hour or 20kpa_per_hour")
    rate = float(m.group(1))
    tyre.leak_kpa_per_hour = rate * KPA_PER_PSI if m.group(2) == "psi" else rate


def apply_hot(trucks, spec: str) -> None:
    """--hot TRUCK2:FR:95C"""
    _, tyre, rest = _truck_and_tyre(trucks, spec)
    m = re.fullmatch(r"(\d+(?:\.\d+)?)c", rest[0].lower()) if rest else None
    if not m:
        raise ValueError(f"'{spec}': temperature must look like 95C")
    tyre.hot_target_c = float(m.group(1))


def apply_offline(trucks, spec: str) -> None:
    """--offline TRUCK1:FL"""
    _, tyre, _ = _truck_and_tyre(trucks, spec)
    tyre.goes_offline = True


def build_trucks(seed: int = 7) -> dict[str, TruckSim]:
    rnd = random.Random(seed)
    trucks = {}
    for name, cfg in TRUCKS.items():
        truck = TruckSim(name, cfg["device_id"], cfg["key_env"], cfg["route_start"])
        for i, pos in enumerate(POSITIONS, start=1):
            # Each tyre filled a little differently (±1%).
            truck.tyres.append(TyreSim(pos, f"{cfg['sensor_prefix']}{i}", RECOMMENDED_KPA * (1 + rnd.uniform(-0.01, 0.01))))
        trucks[name] = truck
    return trucks


# ---------------------------------------------------------------------------
# Sending
# ---------------------------------------------------------------------------


def load_env() -> dict[str, str]:
    """Tiny .env reader (KEY=value lines). Real environment variables win."""
    values: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                values[k.strip()] = v.split(" #")[0].strip().strip('"').strip("'")
    values.update({k: v for k, v in os.environ.items() if k.startswith("SIM_")})
    return values


def send(api_url: str, device_key: str, body: dict) -> tuple[int, dict | str]:
    req = urllib.request.Request(
        api_url.rstrip("/") + "/api/ingest",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Device-Key": device_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")[:300]
    except (urllib.error.URLError, TimeoutError) as e:
        return 0, str(e)


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--leak", action="append", default=[], metavar="TRUCK:TYRE:RATE")
    p.add_argument("--hot", action="append", default=[], metavar="TRUCK:TYRE:TEMP")
    p.add_argument("--offline", action="append", default=[], metavar="TRUCK:TYRE")
    p.add_argument("--interval", type=float, default=10, help="seconds between batches (default 10)")
    p.add_argument("--api", help="API base URL (default: SIM_API_URL from .env, else http://localhost:8000)")
    p.add_argument("--once", action="store_true", help="send one batch per truck, then stop")
    p.add_argument("--dry-run", action="store_true", help="print the JSON instead of sending")
    args = p.parse_args(argv)

    trucks = build_trucks()
    try:
        for s in args.leak:
            apply_leak(trucks, s)
        for s in args.hot:
            apply_hot(trucks, s)
        for s in args.offline:
            apply_offline(trucks, s)
    except ValueError as e:
        sys.exit(f"Bad scenario flag: {e}")

    env = load_env()
    api_url = args.api or env.get("SIM_API_URL") or "http://localhost:8000"
    if not args.dry_run:
        missing = [t.key_env for t in trucks.values() if not env.get(t.key_env)]
        if missing:
            sys.exit(
                f"Missing {', '.join(missing)} in .env. Create keys with api/scripts/new_device_key.py "
                "(see simulator/README.md), or use --dry-run."
            )

    print(f"Simulating {len(trucks)} trucks x {len(POSITIONS)} tyres -> {api_url}/api/ingest every {args.interval:g}s")
    for s in args.leak + args.hot + args.offline:
        print(f"  scenario: {s}")

    rnd = random.Random()
    start = time.monotonic()
    while True:
        tick = time.monotonic()
        elapsed = tick - start
        now = datetime.now(timezone.utc)
        for truck in trucks.values():
            body = truck.batch(elapsed, now, rnd)
            if args.dry_run:
                print(json.dumps(body, indent=2))
                continue
            status, reply = send(api_url, env[truck.key_env], body)
            stamp = now.astimezone().strftime("%H:%M:%S")
            if status == 200 and isinstance(reply, dict):
                alerts = ", ".join(f"{a['type']} ({a['severity']})" for a in reply.get("alerts_created", []))
                rejected = f"  rejected {len(reply['rejected'])}" if reply.get("rejected") else ""
                print(f"{stamp} {truck.name}: sent {len(body['readings'])}, stored {reply.get('accepted')}{rejected}"
                      + (f"  NEW ALERTS: {alerts}" if alerts else ""))
            else:
                print(f"{stamp} {truck.name}: FAILED ({status or 'no connection'}): {reply}")
        if args.once:
            return
        time.sleep(max(0.0, args.interval - (time.monotonic() - tick)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
