"""
Turning raw rows into what the dashboard shows (pure functions, easy to test):
tyre / truck status and the nearest open garages.
"""

from __future__ import annotations

import math
from datetime import datetime, time, timedelta, timezone
from typing import Any, Iterable

from alert_config import DEFAULT_CONFIG

# India has no daylight saving, so a fixed +05:30 offset is exact.
IST = timezone(timedelta(hours=5, minutes=30))


def parse_ts(value: str | datetime) -> datetime:
    """Supabase returns timestamps as ISO strings. Make them timezone-aware datetimes."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


def tyre_status(latest_ts: datetime | None, open_alerts: list[dict], now: datetime) -> str:
    """
    'offline' if no reading for offline_after_min minutes (we don't know its real state),
    otherwise the worst open alert: 'critical' > 'warning' > 'ok'.
    """
    if latest_ts is None or now - latest_ts > timedelta(minutes=DEFAULT_CONFIG.offline_after_min):
        return "offline"
    return worst_severity(open_alerts)


def worst_severity(open_alerts: Iterable[dict]) -> str:
    severities = {a["severity"] for a in open_alerts}
    if "critical" in severities:
        return "critical"
    if "warning" in severities:
        return "warning"
    return "ok"


def build_truck_summaries(
    trucks: list[dict],
    tyres: list[dict],
    latest: list[dict],
    open_alerts: list[dict],
    now: datetime,
) -> list[dict]:
    """
    Shape of GET /api/trucks (matches TruckSummary in frontend/src/types.ts):
    each truck + status, last_seen_at, lat/lon, open_alerts count, tyres with status + latest reading.
    """
    latest_by_tyre = {r["tyre_id"]: r for r in latest}
    alerts_by_truck: dict[str, list[dict]] = {}
    for a in open_alerts:
        alerts_by_truck.setdefault(a["truck_id"], []).append(a)

    result = []
    for truck in trucks:
        truck_alerts = alerts_by_truck.get(truck["id"], [])
        tyre_list = []
        newest = None
        for ty in (t for t in tyres if t["truck_id"] == truck["id"]):
            r = latest_by_tyre.get(ty["id"])
            ts = parse_ts(r["ts"]) if r else None
            if r and (newest is None or ts > parse_ts(newest["ts"])):
                newest = r
            tyre_list.append(
                {
                    **ty,
                    "status": tyre_status(ts, [a for a in truck_alerts if a["tyre_id"] == ty["id"]], now),
                    "latest": (
                        {k: r[k] for k in ("ts", "pressure_kpa", "corrected_kpa", "temp_c")} if r else None
                    ),
                }
            )
        result.append(
            {
                **truck,
                "status": worst_severity(truck_alerts),
                "last_seen_at": newest["ts"] if newest else None,
                "lat": newest.get("lat") if newest else None,
                "lon": newest.get("lon") if newest else None,
                "open_alerts": len(truck_alerts),
                "tyres": tyre_list,
            }
        )
    return result


# ---------------------------------------------------------------------------
# Garages
# ---------------------------------------------------------------------------


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance between two points on Earth, in km."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _parse_time(value: str | time | None) -> time | None:
    if value is None or isinstance(value, time):
        return value
    return time.fromisoformat(value)  # "08:00:00" or "08:00"


def is_open_now(garage: dict, now: datetime) -> bool:
    """open_24x7, or now (in IST) is between opens and closes. Handles hours past midnight."""
    if garage.get("open_24x7"):
        return True
    opens, closes = _parse_time(garage.get("opens")), _parse_time(garage.get("closes"))
    if opens is None or closes is None:
        return False
    t = now.astimezone(IST).time()
    if opens <= closes:
        return opens <= t < closes
    return t >= opens or t < closes  # e.g. 18:00 -> 02:00


def nearest_open_garages(
    garages: list[dict], lat: float, lon: float, service: str, now: datetime, limit: int = 3
) -> list[dict]:
    """The `limit` nearest garages offering `service` that are open right now (spec section 5)."""
    out = []
    for g in garages:
        if service not in (g.get("services") or []):
            continue
        if not is_open_now(g, now):
            continue
        out.append(
            {
                **g,
                "distance_km": round(haversine_km(lat, lon, float(g["lat"]), float(g["lon"])), 1),
                "open_now": True,
            }
        )
    out.sort(key=lambda g: g["distance_km"])
    return out[:limit]
