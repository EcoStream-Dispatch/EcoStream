"""Truck/tyre status and nearest-garage logic (fleet.py)."""

from datetime import datetime, timedelta, timezone

from fleet import build_truck_summaries, is_open_now, nearest_open_garages, tyre_status
from security import bearer_token, hash_device_key

NOW = datetime(2026, 11, 20, 16, 30, tzinfo=timezone.utc)  # 22:00 IST


def test_tyre_status():
    recent = NOW - timedelta(minutes=1)
    assert tyre_status(recent, [], NOW) == "ok"
    assert tyre_status(recent, [{"severity": "warning"}], NOW) == "warning"
    assert tyre_status(recent, [{"severity": "warning"}, {"severity": "critical"}], NOW) == "critical"
    assert tyre_status(NOW - timedelta(minutes=11), [], NOW) == "offline"
    assert tyre_status(None, [], NOW) == "offline"


def test_truck_summary_shape_matches_frontend():
    trucks = [{"id": "t1", "reg_no": "TN 99 ZZ 0001", "axle_config": "6W"}]
    tyres = [{"id": "y1", "truck_id": "t1", "position": "FL"}, {"id": "y2", "truck_id": "t1", "position": "FR"}]
    latest = [
        {"tyre_id": "y1", "ts": (NOW - timedelta(minutes=1)).isoformat(), "pressure_kpa": 900,
         "corrected_kpa": 830, "temp_c": 50, "lat": 12.9, "lon": 79.1},
    ]
    alerts = [{"truck_id": "t1", "tyre_id": "y1", "severity": "warning"}]
    [s] = build_truck_summaries(trucks, tyres, latest, alerts, NOW)
    assert s["status"] == "warning"
    assert s["open_alerts"] == 1
    assert (s["lat"], s["lon"]) == (12.9, 79.1)
    assert [t["status"] for t in s["tyres"]] == ["warning", "offline"]
    assert s["tyres"][0]["latest"] == {"ts": latest[0]["ts"], "pressure_kpa": 900, "corrected_kpa": 830, "temp_c": 50}
    assert s["tyres"][1]["latest"] is None


def test_open_now_uses_ist_and_handles_midnight():
    day = {"open_24x7": False, "opens": "08:00:00", "closes": "20:00:00"}
    night = {"open_24x7": False, "opens": "18:00", "closes": "02:00"}
    at = lambda h, m=0: datetime(2026, 11, 20, h, m, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    assert is_open_now(day, at(9))
    assert not is_open_now(day, at(21))
    assert is_open_now(night, at(23))
    assert is_open_now(night, at(1))
    assert not is_open_now(night, at(12))
    assert is_open_now({"open_24x7": True}, at(3))


def test_nearest_open_garages():
    garages = [
        {"id": "far", "lat": 11.66, "lon": 78.14, "open_24x7": True, "services": ["tyre"]},
        {"id": "near", "lat": 12.92, "lon": 79.14, "open_24x7": True, "services": ["tyre"]},
        {"id": "closed", "lat": 12.93, "lon": 79.13, "open_24x7": False, "opens": "08:00", "closes": "20:00",
         "services": ["tyre"]},
        {"id": "engine-only", "lat": 12.92, "lon": 79.14, "open_24x7": True, "services": ["engine"]},
        {"id": "mid", "lat": 12.52, "lon": 78.22, "open_24x7": True, "services": ["tyre", "engine"]},
        {"id": "x", "lat": 13.08, "lon": 80.27, "open_24x7": True, "services": ["tyre"]},
    ]
    result = nearest_open_garages(garages, 12.9165, 79.1325, "tyre", NOW)  # Vellore, 22:00 IST
    assert [g["id"] for g in result] == ["near", "mid", "x"]
    assert result[0]["distance_km"] < 2
    assert all(g["open_now"] for g in result)


def test_device_key_hash_and_bearer():
    assert hash_device_key("k", "s") == hash_device_key("k", "s")
    assert hash_device_key("k", "s") != hash_device_key("k", "other")
    assert len(hash_device_key("k", "s")) == 64
    assert bearer_token("Bearer abc") == "abc"
    assert bearer_token("Basic abc") is None
    assert bearer_token(None) is None
