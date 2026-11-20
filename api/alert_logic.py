"""
EcoStream alert logic (spec section 4) - the core of the product.

Pure Python, no database, no web framework: give it readings, get back alerts.
That makes it easy to test (see tests/test_alert_logic.py) and to reuse later
(e.g. in a stream processor instead of /api/ingest).

Units: pressures in kPa GAUGE, temperatures in °C, times as timezone-aware UTC datetimes.

How /api/ingest will use it (Stage 5):
    1. For each new reading:  corrected = corrected_kpa(pressure, temp), store it.
    2. For each tyre that got readings:
           alerts = evaluate_tyre(tyre, last_30_min_of_readings, recent_alerts, now)
    3. For the device's other tyres:
           alert = evaluate_offline(tyre, tyre_last_reading_at, device_last_seen_at, recent_alerts, now)
    4. Insert whatever comes back into the `alerts` table.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Optional

from alert_config import DEFAULT_CONFIG, AlertConfig

# ---------------------------------------------------------------------------
# Temperature correction
# ---------------------------------------------------------------------------

P_ATM_KPA = 101.325  # atmospheric pressure. gauge + P_ATM = absolute
T_REF_K = 293.15  # 20 °C, the reference temperature
KPA_PER_PSI = 6.894757


def corrected_kpa(pressure_kpa: float, temp_c: float) -> float:
    """
    Pressure this tyre would show at 20 °C (spec section 4).

    Air in a tyre expands when it heats up, so a hot tyre reads higher.
    The gas law says absolute pressure is proportional to absolute temperature,
    so we scale the ABSOLUTE pressure (gauge + atmosphere) to 20 °C,
    then turn it back into gauge pressure.

    A hot tyre that isn't leaking keeps the same corrected pressure.
    A leaking tyre's corrected pressure goes down.
    """
    p_abs = pressure_kpa + P_ATM_KPA
    return p_abs * (T_REF_K / (temp_c + 273.15)) - P_ATM_KPA


# ---------------------------------------------------------------------------
# Data shapes (match the database tables in spec section 3)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Tyre:
    id: str
    truck_id: str
    recommended_cold_kpa: float
    max_temp_c: Optional[float] = None  # None -> config.default_max_temp_c


@dataclass(frozen=True)
class Reading:
    ts: datetime
    pressure_kpa: float
    temp_c: float
    corrected_kpa: float


@dataclass(frozen=True)
class RecentAlert:
    """An alert already in the database. Only what de-duplication needs."""

    type: str
    created_at: datetime


@dataclass(frozen=True)
class NewAlert:
    """An alert to insert into the `alerts` table."""

    tyre_id: str
    truck_id: str
    type: str  # low_pressure | critical_pressure | slow_leak | high_temp | sensor_offline
    severity: str  # warning | critical
    value: float  # see the units per type in frontend/src/lib/status.ts
    message: str


# ---------------------------------------------------------------------------
# Slow-leak slope
# ---------------------------------------------------------------------------


def leak_slope_kpa_per_hour(
    readings: Iterable[Reading],
    now: datetime,
    config: AlertConfig = DEFAULT_CONFIG,
) -> Optional[float]:
    """
    How fast corrected pressure is changing, in kPa per hour, over the last
    `leak_window_min` minutes. Negative = losing air.

    Uses ordinary least-squares linear regression (the "line of best fit").
    Returns None when there isn't enough data to trust the answer:
    fewer than `leak_min_points` readings, or they span less than `leak_min_span_min`.
    """
    window_start = now - timedelta(minutes=config.leak_window_min)
    points = sorted((r for r in readings if window_start <= r.ts <= now), key=lambda r: r.ts)
    if len(points) < config.leak_min_points:
        return None

    span_min = (points[-1].ts - points[0].ts).total_seconds() / 60
    if span_min < config.leak_min_span_min or span_min == 0:
        return None

    # x = hours since the first point, y = corrected pressure
    t0 = points[0].ts
    xs = [(p.ts - t0).total_seconds() / 3600 for p in points]
    ys = [p.corrected_kpa for p in points]
    n = len(points)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    sxx = sum((x - mean_x) ** 2 for x in xs)
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    return sxy / sxx


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------


def evaluate_tyre(
    tyre: Tyre,
    readings: Iterable[Reading],
    recent_alerts: Iterable[RecentAlert],
    now: datetime,
    config: AlertConfig = DEFAULT_CONFIG,
) -> list[NewAlert]:
    """
    Run every reading-based rule for one tyre and return the NEW alerts to create
    (duplicates already removed).

    readings:      this tyre's readings, at least the last `leak_window_min` minutes, any order.
    recent_alerts: this tyre's alerts from at least the last `dedup_window_min` minutes.
    """
    readings = sorted(readings, key=lambda r: r.ts)
    if not readings:
        return []
    latest = readings[-1]
    rec = tyre.recommended_cold_kpa
    found: list[NewAlert] = []

    def add(type_: str, severity: str, value: float, message: str) -> None:
        found.append(NewAlert(tyre.id, tyre.truck_id, type_, severity, round(value, 1), message))

    # 1. critical_pressure: latest corrected pressure below 80% of recommended.
    critical_limit = rec * config.critical_pressure_fraction
    is_critical = latest.corrected_kpa < critical_limit
    if is_critical:
        add(
            "critical_pressure",
            "critical",
            latest.corrected_kpa,
            f"Pressure is {_pct(latest.corrected_kpa, rec)} of recommended (corrected to 20 °C). "
            "Stop safely and inspect the tyre.",
        )

    # 2. low_pressure: below 90% for N readings in a row.
    #    Skipped when critical already fired - one alert for one problem.
    low_limit = rec * config.low_pressure_fraction
    last_n = readings[-config.low_pressure_consecutive :]
    if (
        not is_critical
        and len(last_n) == config.low_pressure_consecutive
        and all(r.corrected_kpa < low_limit for r in last_n)
    ):
        add(
            "low_pressure",
            "warning",
            latest.corrected_kpa,
            f"Pressure is {_pct(latest.corrected_kpa, rec)} of recommended (corrected to 20 °C). "
            "Top up at the next stop.",
        )

    # 3. slow_leak: corrected pressure falling faster than the threshold.
    slope = leak_slope_kpa_per_hour(readings, now, config)
    if slope is not None and slope < config.leak_warning_kpa_per_hour:
        severity = "critical" if slope < config.leak_critical_kpa_per_hour else "warning"
        add(
            "slow_leak",
            severity,
            slope,
            f"Pressure is falling about {abs(slope) / KPA_PER_PSI:.1f} psi per hour "
            "(temperature-corrected). Check for a puncture or valve leak.",
        )

    # 4. high_temp: hotter than the tyre's limit.
    max_temp = tyre.max_temp_c if tyre.max_temp_c is not None else config.default_max_temp_c
    if latest.temp_c > max_temp:
        add(
            "high_temp",
            "warning",
            latest.temp_c,
            f"Tyre temperature is {latest.temp_c:.0f} °C (limit {max_temp:.0f} °C). "
            "Check brakes and wheel bearings.",
        )

    return remove_duplicates(found, recent_alerts, now, config)


def evaluate_offline(
    tyre: Tyre,
    tyre_last_reading_at: Optional[datetime],
    device_last_seen_at: Optional[datetime],
    recent_alerts: Iterable[RecentAlert],
    now: datetime,
    config: AlertConfig = DEFAULT_CONFIG,
) -> Optional[NewAlert]:
    """
    sensor_offline: no reading from this tyre for `offline_after_min` minutes
    WHILE the device on the truck is still online (spec section 4).

    If the whole device is quiet (truck parked, no network) we don't blame the tyre sensor.
    """
    limit = timedelta(minutes=config.offline_after_min)
    device_online = device_last_seen_at is not None and now - device_last_seen_at < limit
    if not device_online:
        return None
    # A sensor that has NEVER reported has no "last reading" to measure 10 minutes from
    # (TPMS sensors are heard one at a time, so a new device's first batches are partial).
    # We don't alert on it here.
    if tyre_last_reading_at is None or now - tyre_last_reading_at < limit:
        return None

    minutes = (now - tyre_last_reading_at).total_seconds() / 60
    msg = (
        f"No reading from this tyre sensor for {minutes:.0f} minutes. "
        "Sensor battery or signal may be the problem."
    )
    alert = NewAlert(tyre.id, tyre.truck_id, "sensor_offline", "warning", round(minutes, 1), msg)
    kept = remove_duplicates([alert], recent_alerts, now, config)
    return kept[0] if kept else None


# ---------------------------------------------------------------------------
# De-duplication
# ---------------------------------------------------------------------------


def remove_duplicates(
    new_alerts: Iterable[NewAlert],
    recent_alerts: Iterable[RecentAlert],
    now: datetime,
    config: AlertConfig = DEFAULT_CONFIG,
) -> list[NewAlert]:
    """
    Drop any new alert whose type was already raised for this tyre within
    `dedup_window_min` minutes (spec section 4). Acknowledged or not doesn't matter.

    recent_alerts must be for the SAME tyre as new_alerts.
    """
    cutoff = now - timedelta(minutes=config.dedup_window_min)
    recent_types = {a.type for a in recent_alerts if a.created_at > cutoff}
    return [a for a in new_alerts if a.type not in recent_types]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _pct(value: float, of: float) -> str:
    return f"{value / of * 100:.0f}%"
