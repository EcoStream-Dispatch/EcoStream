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
