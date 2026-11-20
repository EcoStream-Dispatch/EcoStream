"""
Tests for api/alert_logic.py (spec section 4).

Run:  cd api && pytest -v

The four tests the founder asked for are marked REQUIRED. The rest check the
details of each rule so we notice if a change breaks something.
"""

import random
from datetime import datetime, timedelta, timezone

import pytest

from alert_config import AlertConfig
from alert_logic import (
    P_ATM_KPA,
    T_REF_K,
    RecentAlert,
    Reading,
    Tyre,
    corrected_kpa,
    evaluate_offline,
    evaluate_tyre,
    leak_slope_kpa_per_hour,
)

REC = 830.0  # recommended cold pressure, kPa (seed data)
PSI = 6.894757  # kPa per psi
T0 = datetime(2026, 11, 20, 4, 0, tzinfo=timezone.utc)  # trip start
TYRE = Tyre(id="tyre-1", truck_id="truck-1", recommended_cold_kpa=REC, max_temp_c=85)


# ---------------------------------------------------------------------------
# Helpers that fake a tyre's readings, the way the simulator will.
# ---------------------------------------------------------------------------


def gauge_from_corrected(corrected: float, temp_c: float) -> float:
    """Inverse of corrected_kpa(): what the sensor reads at temp_c."""
    return (corrected + P_ATM_KPA) * ((temp_c + 273.15) / T_REF_K) - P_ATM_KPA


def make_readings(minutes, temp_at, corrected_at, every_s=10, noise_kpa=1.0, seed=1):
    """
    Readings every `every_s` seconds for `minutes` minutes after T0.
    temp_at(m) and corrected_at(m) give temperature and true corrected pressure at minute m.
    Pressure gets a little random sensor noise and is rounded like a real sensor.
    corrected_kpa is computed from the sensor value, exactly as /api/ingest will.
    """
    rnd = random.Random(seed)
    out = []
    for i in range(int(minutes * 60 / every_s) + 1):
        m = i * every_s / 60
        temp = round(temp_at(m), 1)
        pressure = round(gauge_from_corrected(corrected_at(m), temp) + rnd.uniform(-noise_kpa, noise_kpa), 1)
        out.append(Reading(T0 + timedelta(minutes=m), pressure, temp, corrected_kpa(pressure, temp)))
    return out


def warming(start_c=30.0, end_c=55.0, minutes_to_warm=60):
    """Temperature that rises from start to end over the first hour, then stays."""
    return lambda m: start_c + (end_c - start_c) * min(m / minutes_to_warm, 1.0)


def run_over_time(readings, every_min=1):
    """Evaluate once a minute as data arrives (like ingest does). Returns (minute, alert) pairs."""
    raised, history = [], []
    last_m = int((readings[-1].ts - T0).total_seconds() // 60)
    for m in range(0, last_m + 1, every_min):
        now = T0 + timedelta(minutes=m)
        so_far = [r for r in readings if r.ts <= now]
        for a in evaluate_tyre(TYRE, so_far, history, now):
            raised.append((m, a))
            history.append(RecentAlert(a.type, now))
    return raised


# ---------------------------------------------------------------------------
# Temperature correction
# ---------------------------------------------------------------------------


def test_correction_does_nothing_at_20c():
    assert corrected_kpa(830.0, 20.0) == pytest.approx(830.0)


def test_correction_hot_tyre_matches_gas_law():
    # 830 kPa at 20 °C heated to 60 °C reads about 957 kPa on the gauge...
    hot = gauge_from_corrected(830.0, 60.0)
    assert hot == pytest.approx(957.1, abs=0.1)
    # ...but corrects back to 830.
    assert corrected_kpa(hot, 60.0) == pytest.approx(830.0)


# ---------------------------------------------------------------------------
# REQUIRED (a): hot tyre that isn't leaking -> NO alert   (acceptance criterion 3)
# ---------------------------------------------------------------------------


def test_required_a_hot_tyre_not_leaking_gives_no_alert():
    # Tyre heats from 30 °C to 80 °C over an hour of driving, no air lost.
    readings = make_readings(90, warming(30, 80), lambda m: REC)

    # Sanity: the raw gauge pressure really did rise a lot (a naive check would panic).
    assert readings[-1].pressure_kpa - readings[0].pressure_kpa > 100

    assert run_over_time(readings) == []


def test_hot_tyre_above_limit_not_leaking_only_gives_high_temp():
    # Simulator scenario --hot TRUCK2:FR:95C: over the 85 °C limit, but no air lost.
    # Only high_temp may fire - never a pressure or leak alert.
    readings = make_readings(90, warming(30, 95), lambda m: REC)
    types = {a.type for _, a in run_over_time(readings)}
    assert types == {"high_temp"}


def test_tyre_cooling_after_stop_is_not_a_leak():
    # Truck stops at a dhaba: tyre cools from 60 °C to 30 °C in 30 minutes.
    # Raw pressure drops ~70 kPa (looks like a fast leak), but no air is lost.
    # This is the case where temperature correction matters most.
    readings = make_readings(45, lambda m: 60.0 - 30.0 * min(m / 30, 1.0), lambda m: REC)
    assert readings[0].pressure_kpa - readings[-1].pressure_kpa > 60
    assert run_over_time(readings) == []


def test_normal_trip_gives_no_alert():
    readings = make_readings(120, warming(30, 55), lambda m: REC)
    assert run_over_time(readings) == []


# ---------------------------------------------------------------------------
# REQUIRED (b): -3 psi/hour leak -> slow_leak        (acceptance criterion 2)
# ---------------------------------------------------------------------------


def test_required_b_3_psi_per_hour_leak_gives_slow_leak_within_20_minutes():
    leak_starts_min = 60
    leak_kpa_per_min = 3 * PSI / 60

    def corrected(m):
        return REC - max(0.0, m - leak_starts_min) * leak_kpa_per_min

    # Tyre is also warming up, to prove the correction is doing its job.
    readings = make_readings(leak_starts_min + 30, warming(30, 55), corrected)
    raised = run_over_time(readings)

    leaks = [(m, a) for m, a in raised if a.type == "slow_leak"]
    assert leaks, "slow leak was never detected"
    first_min, alert = leaks[0]
    assert first_min - leak_starts_min <= 20, f"detected after {first_min - leak_starts_min} min"
    assert alert.severity == "warning"
    assert alert.value < -13.8  # kPa/hour
    # No false alarm before the leak started.
    assert all(m > leak_starts_min for m, _ in raised)


def test_fast_leak_is_critical():
    # -50 kPa/hour is past the -41 kPa/hour critical threshold.
    readings = make_readings(30, lambda m: 50.0, lambda m: REC - 50 * m / 60)
    now = readings[-1].ts
    alerts = evaluate_tyre(TYRE, readings, [], now)
    leak = [a for a in alerts if a.type == "slow_leak"]
    assert leak and leak[0].severity == "critical"


def test_leak_slope_is_accurate():
    readings = make_readings(30, lambda m: 40.0, lambda m: REC - 20 * m / 60, noise_kpa=0)
    slope = leak_slope_kpa_per_hour(readings, readings[-1].ts)
    assert slope == pytest.approx(-20, abs=0.5)


def test_leak_needs_at_least_10_points():
    # 9 readings, 2 minutes apart, steep fall: not enough points to trust.
    readings = make_readings(16, lambda m: 40.0, lambda m: REC - 100 * m / 60, every_s=120, noise_kpa=0)
    assert len(readings) == 9
    assert leak_slope_kpa_per_hour(readings, readings[-1].ts) is None


def test_leak_needs_minimum_time_span():
    # 10 readings in 90 seconds. Noise of +-1 kPa over 1.5 min can look like a huge slope.
    readings = make_readings(1.5, lambda m: 40.0, lambda m: REC, noise_kpa=0)
    readings = readings[:10]
    now = readings[-1].ts
    assert leak_slope_kpa_per_hour(readings, now) is None  # default: needs 10 min span
    # With the span check off (exactly as written in the spec) it does compute a slope.
    spec_only = AlertConfig(leak_min_span_min=0)
    assert leak_slope_kpa_per_hour(readings, now, spec_only) is not None


def test_leak_ignores_readings_older_than_window():
    # Big drop 60-40 min ago, flat for the last 30 min: no current leak.
    def corrected(m):
        return REC - 60 if m >= 20 else REC - 3 * m

    readings = make_readings(60, lambda m: 40.0, corrected, noise_kpa=0)
    slope = leak_slope_kpa_per_hour(readings, readings[-1].ts)
    assert slope == pytest.approx(0, abs=0.1)


# ---------------------------------------------------------------------------
# REQUIRED (c): 75% of recommended -> critical
# ---------------------------------------------------------------------------


def test_required_c_75_percent_of_recommended_gives_critical():
    readings = make_readings(5, lambda m: 40.0, lambda m: REC * 0.75, noise_kpa=0)
    alerts = evaluate_tyre(TYRE, readings, [], readings[-1].ts)
    types = {a.type: a for a in alerts}
    assert "critical_pressure" in types
    assert types["critical_pressure"].severity == "critical"
    assert types["critical_pressure"].value == pytest.approx(REC * 0.75, abs=0.2)
    # One problem, one pressure alert: low_pressure is not raised as well.
    assert "low_pressure" not in types


def test_low_pressure_needs_3_readings_in_a_row():
    ok = make_readings(1, lambda m: 40.0, lambda m: REC, noise_kpa=0)
    low = make_readings(1, lambda m: 40.0, lambda m: REC * 0.85, noise_kpa=0)

    def at(i, r):  # put reading r at position i in time
        return Reading(T0 + timedelta(seconds=10 * i), r.pressure_kpa, r.temp_c, r.corrected_kpa)

    two_low = [at(0, ok[0]), at(1, ok[0]), at(2, low[0]), at(3, low[0])]
    assert evaluate_tyre(TYRE, two_low, [], two_low[-1].ts) == []

    three_low = two_low + [at(4, low[0])]
    alerts = evaluate_tyre(TYRE, three_low, [], three_low[-1].ts)
    assert [(a.type, a.severity) for a in alerts] == [("low_pressure", "warning")]


# ---------------------------------------------------------------------------
# REQUIRED (d): duplicates are suppressed
# ---------------------------------------------------------------------------


def test_required_d_duplicate_within_30_minutes_is_suppressed():
    readings = make_readings(5, lambda m: 40.0, lambda m: REC * 0.75, noise_kpa=0)
    now = readings[-1].ts

    first = evaluate_tyre(TYRE, readings, [], now)
    assert [a.type for a in first] == ["critical_pressure"]

    # Same alert raised 10 minutes ago -> nothing new.
    recent = [RecentAlert("critical_pressure", now - timedelta(minutes=10))]
    assert evaluate_tyre(TYRE, readings, recent, now) == []

    # Raised 31 minutes ago -> allowed again.
    old = [RecentAlert("critical_pressure", now - timedelta(minutes=31))]
    assert [a.type for a in evaluate_tyre(TYRE, readings, old, now)] == ["critical_pressure"]


def test_dedup_only_blocks_the_same_type():
    readings = make_readings(5, lambda m: 95.0, lambda m: REC * 0.75, noise_kpa=0)
    now = readings[-1].ts
    recent = [RecentAlert("critical_pressure", now - timedelta(minutes=5))]
    assert [a.type for a in evaluate_tyre(TYRE, readings, recent, now)] == ["high_temp"]


def test_leak_raised_once_during_a_long_leak():
    # A 60-minute leak should give one alert per 30 minutes at most, not one per reading.
    readings = make_readings(120, lambda m: 50.0, lambda m: REC - max(0, m - 30) * 4 * PSI / 60)
    leak_minutes = [m for m, a in run_over_time(readings) if a.type == "slow_leak"]
    assert len(leak_minutes) >= 1
    gaps = [b - a for a, b in zip(leak_minutes, leak_minutes[1:])]
    assert all(g >= 30 for g in gaps)


# ---------------------------------------------------------------------------
# high_temp and sensor_offline
# ---------------------------------------------------------------------------


def test_high_temp_uses_tyre_limit():
    readings = make_readings(2, lambda m: 80.0, lambda m: REC, noise_kpa=0)
    strict = Tyre(id="t", truck_id="tr", recommended_cold_kpa=REC, max_temp_c=75)
    alerts = evaluate_tyre(strict, readings, [], readings[-1].ts)
    assert [(a.type, a.severity, a.value) for a in alerts] == [("high_temp", "warning", 80.0)]


def test_offline_when_tyre_quiet_but_device_online():
    now = T0 + timedelta(minutes=30)
    alert = evaluate_offline(TYRE, now - timedelta(minutes=12), now - timedelta(seconds=10), [], now)
    assert alert is not None
    assert (alert.type, alert.severity) == ("sensor_offline", "warning")
    assert alert.value == pytest.approx(12)


def test_not_offline_when_whole_device_is_quiet():
    # Truck parked / no network: don't blame the tyre sensor.
    now = T0 + timedelta(minutes=30)
    assert evaluate_offline(TYRE, now - timedelta(minutes=20), now - timedelta(minutes=20), [], now) is None


def test_not_offline_when_tyre_recent():
    now = T0 + timedelta(minutes=30)
    assert evaluate_offline(TYRE, now - timedelta(minutes=5), now, [], now) is None


def test_offline_is_deduplicated():
    now = T0 + timedelta(minutes=30)
    recent = [RecentAlert("sensor_offline", now - timedelta(minutes=5))]
    assert evaluate_offline(TYRE, now - timedelta(minutes=15), now, recent, now) is None


def test_no_readings_no_alerts():
    assert evaluate_tyre(TYRE, [], [], T0) == []
