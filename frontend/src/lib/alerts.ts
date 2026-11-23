import type { Alert, AlertType, TruckSummary } from '../types'

/*
 * Shared alert helpers: the "unsafe in ~N h" countdown and the plain-language
 * "what to do now" steps. Used by the Fleet, Alerts, Alert detail and Driver screens.
 */

/** Critical pressure = 80% of recommended (critical_pressure_fraction in api/alert_config.py). */
export const CRITICAL_FRACTION = 0.8

/** Most urgent first when sorting alerts. */
export const SEVERITY_RANK = { critical: 2, warning: 1 } as const

/**
 * For a slow leak: hours until the tyre reaches critical pressure at the current leak rate.
 * `alert.value` for slow_leak is the slope in kPa per hour (negative).
 * Returns null when it can't be worked out (other alert types, no reading, no truck).
 */
export function hoursUntilUnsafe(alert: Alert, truck: TruckSummary | undefined): number | null {
  if (alert.type !== 'slow_leak' || alert.value >= 0 || !truck) return null
  const tyre = truck.tyres.find((t) => t.id === alert.tyre_id)
  if (!tyre?.latest) return null
  const margin = tyre.latest.corrected_kpa - tyre.recommended_cold_kpa * CRITICAL_FRACTION
  if (margin <= 0) return 0
  return margin / -alert.value
}

/** "Unsafe now" / "Unsafe in ~3 h", or null when there is no countdown. */
export function unsafeLabel(hours: number | null): string | null {
  if (hours === null) return null
  return hours < 1 ? 'Unsafe now' : `Unsafe in ~${Math.round(hours)} h`
}

/** Plain-language "what to do now" steps for each alert type. */
export const WHAT_TO_DO: Record<AlertType, string[]> = {
  slow_leak: [
    'Tell the driver to slow down and avoid hard braking.',
    'Go to the nearest open tyre garage below, before the countdown runs out.',
    'Ask them to check for a puncture and the valve.',
  ],
  low_pressure: [
    'Ask the driver to fill this tyre at the next air point.',
    'If the pressure drops again, have it checked for a leak.',
  ],
  critical_pressure: [
    'Tell the driver to stop safely as soon as possible.',
    'Do not drive far on this tyre. Call a garage below.',
    'Check the tyre for damage before driving on.',
  ],
  high_temp: [
    'Ask the driver to stop in a shaded place and let the tyre cool.',
    'Pressure is fine once corrected, so this is heat, not a leak.',
    'Have the brakes and wheel bearing checked at the next garage.',
  ],
  sensor_offline: [
    'Ask the driver to look at this tyre at the next stop.',
    'The sensor battery or signal may be the problem.',
    'If the tyre looks fine, have the sensor checked at a garage.',
  ],
}
