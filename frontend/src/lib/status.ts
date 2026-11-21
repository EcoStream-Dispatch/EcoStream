import { AlertTriangle, CheckCircle2, OctagonAlert, WifiOff, type LucideIcon } from 'lucide-react'
import type { AlertType, TyreStatus } from '../types'
import { kpaToPsi } from './units'

/*
 * How each status looks. Colours come from docs/BRAND.md.
 * Always show the label/icon with the colour, never colour alone.
 */
export const STATUS_STYLE: Record<
  TyreStatus,
  { label: string; icon: LucideIcon; hex: string; badge: string }
> = {
  ok: { label: 'OK', icon: CheckCircle2, hex: '#5C9A35', badge: 'bg-green-50 text-green-700 ring-green-500/30' },
  warning: { label: 'Warning', icon: AlertTriangle, hex: '#E0A100', badge: 'bg-amber-50 text-amber-800 ring-warning/40' },
  critical: { label: 'Critical', icon: OctagonAlert, hex: '#C62828', badge: 'bg-red-50 text-critical ring-critical/30' },
  offline: { label: 'Offline', icon: WifiOff, hex: '#9AA5B1', badge: 'bg-gray-100 text-gray-600 ring-gray-300' },
}

/** Short title for each alert type. */
export const ALERT_TITLE: Record<AlertType, string> = {
  low_pressure: 'Low pressure',
  critical_pressure: 'Critical pressure',
  slow_leak: 'Slow leak',
  high_temp: 'High temperature',
  sensor_offline: 'Sensor offline',
}

/**
 * Show an alert's numeric value with the right unit.
 * What `value` means per type (agreed with the API):
 *   low_pressure / critical_pressure: corrected pressure, kPa
 *   slow_leak: slope, kPa per hour (negative)
 *   high_temp: temperature, °C
 *   sensor_offline: minutes since last reading
 */
export function formatAlertValue(type: AlertType, value: number): string {
  switch (type) {
    case 'low_pressure':
    case 'critical_pressure':
      return `${kpaToPsi(value).toFixed(1)} psi (corrected)`
    case 'slow_leak':
      return `${kpaToPsi(value).toFixed(1)} psi/hour`
    case 'high_temp':
      return `${value.toFixed(0)} °C`
    case 'sensor_offline':
      return `no data for ${value.toFixed(0)} min`
  }
}
