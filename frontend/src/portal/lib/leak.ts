import type { Reading } from '../types'
import { kpaToPsi } from './units'

const LEAK_WINDOW_MS = 30 * 60 * 1000

/**
 * Leak rate in psi per hour from the last 30 minutes of corrected pressure
 * (least-squares slope, like the API's slow-leak check). Negative = losing air.
 * null when there isn't enough data.
 */
export function leakRate(readings: Reading[], now = Date.now()): number | null {
  const pts = readings.filter((r) => now - new Date(r.ts).getTime() <= LEAK_WINDOW_MS)
  if (pts.length < 5) return null
  const xs = pts.map((r) => new Date(r.ts).getTime() / 3_600_000)
  const ys = pts.map((r) => kpaToPsi(r.corrected_kpa))
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my)
    den += (x - mx) ** 2
  })
  return den === 0 ? null : num / den
}

