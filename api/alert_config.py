"""
All alert thresholds in ONE place (spec section 4).

These are starting guesses from the spec. Tune them with real data.
Per-tyre values (recommended pressure, max temperature) come from the `tyres` table;
everything else is here.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class AlertConfig:
    # --- low_pressure (warning) ---
    # corrected pressure below this fraction of recommended_cold_kpa...
    low_pressure_fraction: float = 0.90
    # ...for this many readings in a row
    low_pressure_consecutive: int = 3

    # --- critical_pressure (critical) ---
    critical_pressure_fraction: float = 0.80

    # --- slow_leak ---
    # Slope of corrected pressure over the last N minutes (linear regression).
    leak_window_min: float = 30
    # Need at least this many readings in the window to trust the slope.
    leak_min_points: int = 10
    # Also need the readings to cover at least this many minutes.
    # NOT in the spec - added so a few noisy readings right after a truck starts
    # can't fake a leak (1 kPa of sensor noise over 2 minutes looks like 30 kPa/hour).
    # Set to 0 to follow the spec exactly.
    leak_min_span_min: float = 10
    # kPa per hour. -13.8 kPa/h is about -2 psi/h; -41 kPa/h is about -6 psi/h.
    leak_warning_kpa_per_hour: float = -13.8
    leak_critical_kpa_per_hour: float = -41.0

    # --- high_temp (warning) ---
    # Used only when a tyre has no max_temp_c of its own.
    default_max_temp_c: float = 85.0

    # --- sensor_offline (warning) ---
    offline_after_min: float = 10

    # --- de-duplication ---
    # Don't raise the same alert type for the same tyre again within this many minutes.
    dedup_window_min: float = 30


# The config used everywhere unless a test passes its own.
DEFAULT_CONFIG = AlertConfig()
