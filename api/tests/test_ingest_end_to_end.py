"""
The simulator (simulator/simulate.py) feeding /api/ingest's logic (ingest.py),
with a fake clock and an in-memory database.

This checks acceptance criteria 2 and 3 through the real ingest path,
without waiting 20 real minutes.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "simulator"))
import simulate  # noqa: E402

from fakes import DEVICE_KEY, DEVICE_ID, SALT, FakeStore  # noqa: E402
from ingest import IncomingReading, process_ingest  # noqa: E402
from fleet import parse_ts  # noqa: E402
from security import hash_device_key  # noqa: E402

START = datetime(2026, 11, 20, 4, 0, tzinfo=timezone.utc)


def drive(minutes: float, scenario=None, step_s: int = 10):
    """
    Run simulator TRUCK1 for `minutes`, sending a batch every `step_s` seconds into process_ingest.
    Returns (store, [(minute, alert_row), ...]).
    """
    trucks = simulate.build_trucks()
    if scenario:
        scenario(trucks)
    truck = trucks["TRUCK1"]
    store = FakeStore(hash_device_key(DEVICE_KEY, SALT))
    device = store.find_device(DEVICE_ID, hash_device_key(DEVICE_KEY, SALT))
    rnd = simulate.random.Random(3)
    raised = []
    for i in range(int(minutes * 60 / step_s) + 1):
        elapsed = i * step_s
        now = START + timedelta(seconds=elapsed)
        body = truck.batch(elapsed, now, rnd)
        readings = [IncomingReading(**{**r, "ts": parse_ts(r["ts"])}) for r in body["readings"]]
        result = process_ingest(store, device, readings, now=now)
        assert result.rejected == []
        raised += [(elapsed / 60, a) for a in result.alerts]
    return store, raised


def test_normal_two_hour_trip_gives_no_alerts():
    store, raised = drive(120)
    assert raised == []
    assert len(store.readings) == 6 * (120 * 6 + 1)
    # corrected_kpa is stored with every reading
    assert all("corrected_kpa" in r for r in store.readings)


def test_criterion_2_slow_leak_detected_within_20_minutes():
    store, raised = drive(30, lambda t: simulate.apply_leak(t, "TRUCK1:RL-O:3psi_per_hour"))
    leaks = [(m, a) for m, a in raised if a["type"] == "slow_leak"]
    assert leaks, "no slow_leak alert"
    minute, alert = leaks[0]
    assert minute <= 20
    assert alert["tyre_id"] == "tyre-RL-O"
    assert alert["severity"] == "warning"
    assert {a["type"] for _, a in raised} == {"slow_leak"}  # nothing else fired
    assert len(leaks) == 1  # de-duplicated


def test_criterion_3_hot_but_not_leaking_gives_no_pressure_alert():
    # Below the 85 °C limit: no alert at all.
    _, raised = drive(60, lambda t: simulate.apply_hot(t, "TRUCK1:FR:80C"))
    assert raised == []


def test_hot_95c_only_gives_high_temp():
    # Spec scenario --hot TRUCK2:FR:95C: high_temp is right, a leak/pressure alert would be wrong.
    _, raised = drive(60, lambda t: simulate.apply_hot(t, "TRUCK1:FR:95C"))
    assert {a["type"] for _, a in raised} == {"high_temp"}
    assert all(a["tyre_id"] == "tyre-FR" for _, a in raised)


def test_offline_sensor_raises_sensor_offline_after_10_minutes():
    _, raised = drive(20, lambda t: simulate.apply_offline(t, "TRUCK1:FL"))
    offline = [(m, a) for m, a in raised if a["type"] == "sensor_offline"]
    assert len(offline) == 1
    minute, alert = offline[0]
    # Sensor stops after 1 minute; alert once it's been quiet for 10 minutes.
    assert 11 <= minute <= 12
    assert alert["tyre_id"] == "tyre-FL"


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def _one(**overrides):
    base = dict(sensor_id="1A0001", ts=START, pressure_kpa=850.0, temp_c=35.0)
    return IncomingReading(**{**base, **overrides})


@pytest.mark.parametrize(
    "overrides, reason_part",
    [
        ({"pressure_kpa": -1}, "pressure_kpa"),
        ({"pressure_kpa": 1501}, "pressure_kpa"),
        ({"temp_c": -41}, "temp_c"),
        ({"temp_c": 151}, "temp_c"),
        ({"sensor_id": "NOPE"}, "unknown sensor"),
        ({"ts": START + timedelta(hours=1)}, "future"),
    ],
)
def test_impossible_readings_are_rejected(overrides, reason_part):
    store = FakeStore(hash_device_key(DEVICE_KEY, SALT))
    device = store.devices[0]
    good, bad = _one(), _one(**overrides)
    result = process_ingest(store, device, [good, bad], now=START)
    assert result.accepted == 1
    assert len(result.rejected) == 1
    assert result.rejected[0]["index"] == 1
    assert reason_part in result.rejected[0]["reason"]
    assert len(store.readings) == 1


def test_corrected_pressure_is_computed_on_ingest():
    store = FakeStore(hash_device_key(DEVICE_KEY, SALT))
    process_ingest(store, store.devices[0], [_one(pressure_kpa=830.0, temp_c=20.0)], now=START)
    assert store.readings[0]["corrected_kpa"] == pytest.approx(830.0)


def test_device_last_seen_is_updated():
    store = FakeStore(hash_device_key(DEVICE_KEY, SALT))
    process_ingest(store, store.devices[0], [_one()], now=START)
    assert store.devices[0]["last_seen_at"] == START.isoformat()
