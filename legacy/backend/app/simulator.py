import asyncio
import math
import uuid
from datetime import datetime, timezone
from typing import List, Tuple, Optional
from app.models import TyreReading, TyreState, Alert
from app.store import store, utc_now_str

# Note: In a production deployment, this in-memory simulator and least-squares
# regression engine can be substituted with a streaming Pathway pipeline
# (e.g., using pathway.io.http, pw.temporal sliding window joins, and pw.ml)
# for high-throughput distributed stream analytics without altering the REST/SSE interface.

NOMINAL_PRESSURE_PSI = 110.0
WARNING_THRESHOLD_PSI = 104.5  # 95% of nominal
CRITICAL_THRESHOLD_PSI = 93.5  # 85% of nominal

def compute_least_squares_slope(readings: List[TyreReading]) -> Tuple[float, float, str]:
    """
    Computes linear regression slope (PSI per hour) and R^2 goodness of fit.
    Returns (slope_psi_per_hour, r_squared, fit_status).
    """
    if len(readings) < 5:
        return 0.0, 0.0, "insufficient_data"

    # Convert timestamps to relative hours from first reading
    t_vals = []
    p_vals = []
    try:
        t0 = datetime.fromisoformat(readings[0].timestamp).timestamp()
        for r in readings:
            t = (datetime.fromisoformat(r.timestamp).timestamp() - t0) / 3600.0  # in hours
            t_vals.append(t)
            p_vals.append(r.pressure_psi)
    except Exception:
        # Fallback to index-based intervals if timestamps fail (e.g., 2 sec = 2/3600 h)
        for i, r in enumerate(readings):
            t_vals.append(i * (2.0 / 3600.0))
            p_vals.append(r.pressure_psi)

    n = len(t_vals)
    sum_t = sum(t_vals)
    sum_p = sum(p_vals)
    sum_tt = sum(t * t for t in t_vals)
    sum_tp = sum(t * p for t, p in zip(t_vals, p_vals))
    sum_pp = sum(p * p for p in p_vals)

    denom_t = n * sum_tt - sum_t * sum_t
    if abs(denom_t) < 1e-9:
        return 0.0, 0.0, "zero_time_span"

    slope = (n * sum_tp - sum_t * sum_p) / denom_t

    # R^2 calculation
    denom_p = n * sum_pp - sum_p * sum_p
    r_squared = 0.0
    if denom_p > 1e-9 and denom_t > 1e-9:
        num_r = (n * sum_tp - sum_t * sum_p) ** 2
        r_squared = num_r / (denom_t * denom_p)

    fit_status = "stable" if r_squared > 0.6 else "noisy"
    return round(slope, 3), round(r_squared, 3), fit_status

def estimate_time_to_threshold(current_psi: float, slope_psi_per_hour: float, r_squared: float) -> Tuple[Optional[float], str]:
    """
    Calculates time to critical threshold (93.5 PSI).
    Returns (hours_remaining, human_readable_text).
    """
    if slope_psi_per_hour >= -0.1 or r_squared < 0.6:
        return None, "Stable (no negative pressure degradation trend)"

    if current_psi <= CRITICAL_THRESHOLD_PSI:
        return 0.0, "Critical threshold already reached! Immediate maintenance required."

    hours_remaining = (current_psi - CRITICAL_THRESHOLD_PSI) / abs(slope_psi_per_hour)
    hours_remaining = round(hours_remaining, 2)

    total_mins = int(hours_remaining * 60)
    hrs = total_mins // 60
    mins = total_mins % 60
    if hrs > 0:
        time_text = f"Likely to reach minimum in about {hrs} h {mins} min"
    else:
        time_text = f"Likely to reach minimum in about {mins} min"

    return hours_remaining, time_text

async def simulate_fleet_step():
    """
    Advances simulated readings for 12 Chennai trucks by 1 tick (every 2 seconds).
    """
    now = utc_now_str()

    for truck_id, truck in store.trucks.items():
        truck_has_warning = False
        truck_has_critical = False

        for pos, tyre in truck.tyres.items():
            readings = truck.recent_readings.setdefault(pos, [])

            # Apply scenario behavior or normal road vibration jitter
            if tyre.scenario == "slow_leak":
                # Gradual drop of ~0.08 to 0.15 PSI per tick
                new_psi = max(70.0, tyre.current_pressure - 0.12)
                new_temp = tyre.current_temp + 0.1  # slightly warmer due to flex
            elif tyre.scenario == "sudden_drop":
                # Fast loss of 1.5 PSI per tick
                new_psi = max(40.0, tyre.current_pressure - 1.5)
                new_temp = tyre.current_temp - 0.2
            elif tyre.scenario == "overheat":
                # Heat buildup
                new_temp = min(115.0, tyre.current_temp + 1.2)
                # Pressure expands slightly with heat
                new_psi = round(110.0 + (new_temp - 40.0) * 0.12, 1)
            else:
                # Normal nominal road noise (+/- 0.05 PSI, +/- 0.1 C)
                # Slowly drift towards nominal 110 PSI
                drift = 0.02 if tyre.current_pressure < 110.0 else -0.02
                new_psi = round(tyre.current_pressure + drift, 1)
                new_temp = round(42.0 + (hash(pos + truck_id) % 5) * 0.5, 1)

            tyre.current_pressure = round(new_psi, 1)
            tyre.current_temp = round(new_temp, 1)

            # Record reading
            readings.append(TyreReading(
                timestamp=now,
                pressure_psi=tyre.current_pressure,
                temperature_c=tyre.current_temp
            ))
            # Keep rolling window of last 20 readings
            if len(readings) > 20:
                readings.pop(0)

            # Recompute regression & time-to-threshold
            slope, r2, _ = compute_least_squares_slope(readings)
            tyre.slope_psi_per_hour = slope
            hours, pred_text = estimate_time_to_threshold(tyre.current_pressure, slope, r2)
            tyre.predicted_hours_to_min = hours
            tyre.predicted_text = pred_text

            # Update tyre status
            if tyre.current_pressure <= CRITICAL_THRESHOLD_PSI or tyre.current_temp >= 95.0:
                tyre.status = "critical"
                truck_has_critical = True
                _raise_alert_if_not_exists(truck_id, pos, "critical", f"CRITICAL: {pos} tyre at {tyre.current_pressure} PSI ({tyre.current_temp}°C).")
            elif tyre.current_pressure <= WARNING_THRESHOLD_PSI or tyre.slope_psi_per_hour <= -1.0 or tyre.current_temp >= 85.0:
                tyre.status = "warning"
                truck_has_warning = True
                _raise_alert_if_not_exists(truck_id, pos, "warning", f"WARNING: {pos} tyre degradation detected. {pred_text}.")
            else:
                tyre.status = "nominal"

        # Update truck overall status
        if truck_has_critical:
            truck.status = "critical"
        elif truck_has_warning:
            truck.status = "warning"
        else:
            truck.status = "healthy"

        truck.last_updated = now

    # Broadcast fleet state update
    await store.broadcast("fleet_update", {"truck_count": len(store.trucks)})

def _raise_alert_if_not_exists(truck_id: str, pos: str, severity: str, message: str):
    # Check if unresolved alert already exists
    for a in store.alerts:
        if a.truck_id == truck_id and a.tyre_position == pos and not a.resolved:
            return

    store.alerts.append(Alert(
        id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
        truck_id=truck_id,
        tyre_position=pos,
        severity=severity,
        message=message,
        timestamp=utc_now_str(),
        acknowledged=False,
        resolved=False
    ))

async def run_simulator_loop():
    """Background simulator task running every 2 seconds."""
    while True:
        try:
            await asyncio.sleep(2.0)
            await simulate_fleet_step()
        except asyncio.CancelledError:
            break
        except Exception as e:
            await asyncio.sleep(2.0)
