import pytest
from datetime import datetime, timezone, timedelta
from app.models import TyreReading
from app.simulator import compute_least_squares_slope, estimate_time_to_threshold

def test_least_squares_linear_leak():
    # Simulate a steady pressure drop of 2.0 PSI per hour over 10 readings (spaced 10 minutes apart)
    t0 = datetime(2026, 11, 19, 10, 0, 0, tzinfo=timezone.utc)
    readings = []
    for i in range(10):
        t = t0 + timedelta(minutes=10 * i)
        # Pressure drops by (2.0 PSI / 60 min) * 10 min = 0.333 PSI per step
        p = 108.0 - (i * 0.3333)
        readings.append(TyreReading(
            timestamp=t.isoformat(),
            pressure_psi=round(p, 2),
            temperature_c=42.0
        ))

    slope, r2, status = compute_least_squares_slope(readings)
    assert status == "stable"
    assert r2 > 0.95
    # Slope should be approximately -2.0 PSI/h (+/- 0.1)
    assert abs(slope - (-2.0)) < 0.15

    # Estimate time to minimum threshold (93.5 PSI) from current pressure ~105.0 PSI
    # (105.0 - 93.5) / 2.0 = 5.75 hours
    hours, text = estimate_time_to_threshold(current_psi=105.0, slope_psi_per_hour=slope, r_squared=r2)
    assert hours is not None
    assert abs(hours - 5.75) < 0.5
    assert "about 5 h" in text

def test_stable_tyre_no_false_alarm():
    # Flat readings with slight sensor jitter (+/- 0.1 PSI)
    t0 = datetime(2026, 11, 19, 10, 0, 0, tzinfo=timezone.utc)
    readings = []
    for i in range(10):
        t = t0 + timedelta(minutes=5 * i)
        p = 110.0 + ((i % 2) * 0.1 - 0.05)
        readings.append(TyreReading(
            timestamp=t.isoformat(),
            pressure_psi=round(p, 1),
            temperature_c=42.0
        ))

    slope, r2, status = compute_least_squares_slope(readings)
    hours, text = estimate_time_to_threshold(current_psi=110.0, slope_psi_per_hour=slope, r_squared=r2)
    # Should not report a degradation countdown
    assert hours is None
    assert "Stable" in text
