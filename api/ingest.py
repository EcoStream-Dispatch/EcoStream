"""
What POST /api/ingest does with a batch of readings (spec section 5):

  1. check each reading (known sensor? possible values? sensible time?)
  2. compute corrected_kpa and store the good ones
  3. run the alert logic for every tyre on the truck
  4. store any new alerts

Kept separate from the web layer (index.py) and the database (db.py), so tests
can drive it with an in-memory store and a fake clock.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from alert_config import DEFAULT_CONFIG, AlertConfig
from alert_logic import (
    Reading,
    RecentAlert,
    Tyre,
    corrected_kpa,
    evaluate_offline,
    evaluate_tyre,
)
from db import IngestStore
from fleet import parse_ts

# Spec section 5: "Reject readings with impossible values".
PRESSURE_MIN_KPA, PRESSURE_MAX_KPA = 0.0, 1500.0
TEMP_MIN_C, TEMP_MAX_C = -40.0, 150.0
# Not in the spec: a reading stamped in the future (device clock wrong) would look like
# the "latest" reading forever and confuse the alert logic, so we refuse it.
MAX_CLOCK_AHEAD = timedelta(minutes=5)


@dataclass
class IncomingReading:
    sensor_id: str
    ts: datetime
    pressure_kpa: float
    temp_c: float
    lat: Optional[float] = None
    lon: Optional[float] = None
    rssi: Optional[int] = None
    ambient_c: Optional[float] = None


@dataclass
class IngestResult:
    accepted: int = 0
    rejected: list[dict] = field(default_factory=list)  # [{"index": 3, "reason": "..."}]
    alerts: list[dict] = field(default_factory=list)  # new alert rows


def reject_reason(r: IncomingReading, now: datetime) -> Optional[str]:
    """Why this reading can't be stored, or None if it's fine."""
    if not (PRESSURE_MIN_KPA <= r.pressure_kpa <= PRESSURE_MAX_KPA):
        return f"pressure_kpa {r.pressure_kpa} outside {PRESSURE_MIN_KPA:.0f}-{PRESSURE_MAX_KPA:.0f}"
    if not (TEMP_MIN_C <= r.temp_c <= TEMP_MAX_C):
        return f"temp_c {r.temp_c} outside {TEMP_MIN_C:.0f} to {TEMP_MAX_C:.0f}"
    if r.ts > now + MAX_CLOCK_AHEAD:
        return "ts is in the future (check the device clock)"
    return None


def process_ingest(
    store: IngestStore,
    device: dict,
    readings: list[IncomingReading],
    now: Optional[datetime] = None,
    config: AlertConfig = DEFAULT_CONFIG,
) -> IngestResult:
    """
    device: the row from `devices` (already checked against the X-Device-Key header).
    now:    current time; tests pass a fake clock.
    """
    now = now or datetime.now(timezone.utc)
    truck_id = device["truck_id"]
    result = IngestResult()

    tyres = store.tyres_for_truck(truck_id)
    tyre_by_sensor = {t["sensor_id"]: t for t in tyres}

    # ---- 1 + 2: validate, correct, store -------------------------------------
    rows = []
    for i, r in enumerate(readings):
        ts = r.ts if r.ts.tzinfo else r.ts.replace(tzinfo=timezone.utc)
        r.ts = ts.astimezone(timezone.utc)
        tyre = tyre_by_sensor.get(r.sensor_id)
        reason = "unknown sensor_id for this truck" if tyre is None else reject_reason(r, now)
        if reason:
            result.rejected.append({"index": i, "sensor_id": r.sensor_id, "reason": reason})
            continue
        rows.append(
            {
                "tyre_id": tyre["id"],
                "ts": r.ts.isoformat(),
                "pressure_kpa": r.pressure_kpa,
                "temp_c": r.temp_c,
                "ambient_c": r.ambient_c,
                "lat": r.lat,
                "lon": r.lon,
                "rssi": r.rssi,
                "corrected_kpa": round(corrected_kpa(r.pressure_kpa, r.temp_c), 2),
            }
        )
    store.insert_readings(rows)
    result.accepted = len(rows)
    store.touch_device(device["id"], now)
    if not rows:
        return result  # nothing new, nothing to evaluate

    # ---- 3: alert logic ---------------------------------------------------------
    since = now - timedelta(minutes=max(config.leak_window_min, config.dedup_window_min))
    recent_alerts = store.alerts_since(truck_id, since)
    tyres_with_new_data = {row["tyre_id"] for row in rows}
    latest_by_tyre = {r["tyre_id"]: r for r in store.latest_readings([t["id"] for t in tyres])}

    new_alerts = []
    for t in tyres:
        tyre = Tyre(
            id=t["id"],
            truck_id=truck_id,
            recommended_cold_kpa=float(t["recommended_cold_kpa"]),
            max_temp_c=float(t["max_temp_c"]) if t.get("max_temp_c") is not None else None,
        )
        tyre_alerts = [
            RecentAlert(a["type"], parse_ts(a["created_at"])) for a in recent_alerts if a["tyre_id"] == t["id"]
        ]

        if t["id"] in tyres_with_new_data:
            history = [
                Reading(parse_ts(x["ts"]), float(x["pressure_kpa"]), float(x["temp_c"]), float(x["corrected_kpa"]))
                for x in store.readings_since(t["id"], now - timedelta(minutes=config.leak_window_min))
            ]
            new_alerts += evaluate_tyre(tyre, history, tyre_alerts, now, config)
        else:
            # This tyre sent nothing in this batch, but the device is clearly online.
            last = latest_by_tyre.get(t["id"])
            alert = evaluate_offline(tyre, parse_ts(last["ts"]) if last else None, now, tyre_alerts, now, config)
            if alert:
                new_alerts.append(alert)

    # ---- 4: store alerts ----------------------------------------------------
    alert_rows = [
        {
            "tyre_id": a.tyre_id,
            "truck_id": a.truck_id,
            "type": a.type,
            "severity": a.severity,
            "value": a.value,
            "message": a.message,
            "created_at": now.isoformat(),
        }
        for a in new_alerts
    ]
    result.alerts = store.insert_alerts(alert_rows)
    return result
