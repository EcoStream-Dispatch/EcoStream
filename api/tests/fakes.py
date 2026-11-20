"""In-memory stand-in for the database, so ingest can be tested without Supabase."""

from __future__ import annotations

import uuid
from datetime import datetime

from fleet import parse_ts

DEVICE_KEY = "test-device-key"
SALT = "test-salt"
TRUCK_ID = "11111111-1111-4111-8111-000000000001"
DEVICE_ID = "11111111-1111-4111-8111-000000000101"
POSITIONS = ["FL", "FR", "RL-O", "RL-I", "RR-I", "RR-O"]


class FakeStore:
    def __init__(self, key_hash: str):
        self.devices = [{"id": DEVICE_ID, "truck_id": TRUCK_ID, "device_key_hash": key_hash, "last_seen_at": None}]
        # Same sensor IDs as supabase/seed.sql truck 1
        self.tyres = [
            {
                "id": f"tyre-{p}",
                "truck_id": TRUCK_ID,
                "position": p,
                "sensor_id": f"1A000{i}",
                "recommended_cold_kpa": 830,
                "max_temp_c": 85,
            }
            for i, p in enumerate(POSITIONS, start=1)
        ]
        self.readings: list[dict] = []
        self.alerts: list[dict] = []

    # --- IngestStore ---
    def find_device(self, device_id, key_hash):
        return next((d for d in self.devices if d["id"] == device_id and d["device_key_hash"] == key_hash), None)

    def tyres_for_truck(self, truck_id):
        return [t for t in self.tyres if t["truck_id"] == truck_id]

    def insert_readings(self, rows):
        self.readings.extend(rows)

    def readings_since(self, tyre_id, since: datetime):
        rows = [r for r in self.readings if r["tyre_id"] == tyre_id and parse_ts(r["ts"]) >= since]
        return sorted(rows, key=lambda r: parse_ts(r["ts"]))

    def latest_readings(self, tyre_ids):
        latest = {}
        for r in self.readings:
            if r["tyre_id"] in tyre_ids and (
                r["tyre_id"] not in latest or parse_ts(r["ts"]) > parse_ts(latest[r["tyre_id"]]["ts"])
            ):
                latest[r["tyre_id"]] = r
        return list(latest.values())

    def alerts_since(self, truck_id, since):
        return [a for a in self.alerts if a["truck_id"] == truck_id and parse_ts(a["created_at"]) >= since]

    def insert_alerts(self, rows):
        stored = [{**r, "id": str(uuid.uuid4()), "acknowledged_at": None} for r in rows]
        self.alerts.extend(stored)
        return stored

    def touch_device(self, device_id, ts):
        for d in self.devices:
            if d["id"] == device_id:
                d["last_seen_at"] = ts.isoformat()

    def acknowledge_alert(self, alert_id, ts):
        for a in self.alerts:
            if a["id"] == alert_id:
                a["acknowledged_at"] = a["acknowledged_at"] or ts.isoformat()
                return a
        return None


# ---------------------------------------------------------------------------
# Owner side: what OwnerRepo returns, for ONE owner who owns everything in the store.
# (Row-level security itself is tested in supabase/tests, not here.)
# ---------------------------------------------------------------------------

OWNER_ID = "00000000-0000-4000-8000-000000000001"

GARAGES = [
    {"id": "g1", "name": "Sample Tyre Works 5", "lat": 12.92, "lon": 79.14, "phone": "+91 90000 00005",
     "open_24x7": True, "opens": None, "closes": None, "services": ["tyre"], "verified": True},
    {"id": "g2", "name": "Sample Tyre Works 8", "lat": 12.52, "lon": 78.22, "phone": "+91 90000 00008",
     "open_24x7": True, "opens": None, "closes": None, "services": ["tyre"], "verified": True},
    {"id": "g3", "name": "Sample Tyre Works 1", "lat": 13.0475, "lon": 80.096, "phone": "+91 90000 00001",
     "open_24x7": True, "opens": None, "closes": None, "services": ["tyre"], "verified": True},
    {"id": "g4", "name": "Sample Tyre Works 11", "lat": 11.67, "lon": 78.14, "phone": "+91 90000 00011",
     "open_24x7": True, "opens": None, "closes": None, "services": ["tyre"], "verified": True},
]


class FakeOwnerRepo:
    def __init__(self, store: FakeStore, trucks: list[dict] | None = None):
        self.store = store
        self._trucks = trucks or [
            {"id": TRUCK_ID, "owner_id": OWNER_ID, "reg_no": "TN 99 ZZ 0001", "make": "Tata",
             "model": "Signa 4825.T", "axle_config": "6W", "created_at": "2026-11-20T00:00:00+00:00"}
        ]

    def trucks(self):
        return list(self._trucks)

    def truck(self, truck_id):
        return next((t for t in self._trucks if t["id"] == truck_id), None)

    def tyres(self, truck_ids):
        return [t for t in self.store.tyres if t["truck_id"] in truck_ids]

    def latest_readings(self, truck_ids):
        tyre_ids = [t["id"] for t in self.tyres(truck_ids)]
        rows = self.store.latest_readings(tyre_ids)
        truck_of = {t["id"]: t["truck_id"] for t in self.store.tyres}
        return [{**r, "truck_id": truck_of[r["tyre_id"]]} for r in rows]

    def readings(self, tyre_ids, start, end):
        rows = [r for r in self.store.readings if r["tyre_id"] in tyre_ids and start <= parse_ts(r["ts"]) <= end]
        return [{"id": i + 1, **r} for i, r in enumerate(sorted(rows, key=lambda r: parse_ts(r["ts"])))]

    def alerts(self, open_only):
        rows = self.store.alerts
        if open_only is True:
            rows = [a for a in rows if not a["acknowledged_at"]]
        elif open_only is False:
            rows = [a for a in rows if a["acknowledged_at"]]
        return sorted(rows, key=lambda a: a["created_at"], reverse=True)

    def alert(self, alert_id):
        return next((a for a in self.store.alerts if a["id"] == alert_id), None)

    def garages(self):
        return list(GARAGES)
