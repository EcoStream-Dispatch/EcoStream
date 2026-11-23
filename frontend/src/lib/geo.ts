/*
 * Distance and opening-hours helpers for "nearest garage".
 * The real API (spec section 5) does this on the server; the mock uses the same logic.
 */

/** Straight-line distance between two points on Earth, in km (haversine formula). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth radius, km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Current time in India as minutes since midnight (e.g. 14:30 -> 870). */
export function istMinutesNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value)
  return hour * 60 + minute
}

/** "08:30" -> 510 */
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Is a garage open right now (IST)?
 * Handles hours that cross midnight, e.g. opens 18:00, closes 02:00.
 */
export function isOpenNow(
  g: { open_24x7: boolean; opens: string | null; closes: string | null },
  now: Date = new Date(),
): boolean {
  if (g.open_24x7) return true
  if (!g.opens || !g.closes) return false
  const t = istMinutesNow(now)
  const open = toMinutes(g.opens)
  const close = toMinutes(g.closes)
  return open <= close ? t >= open && t < close : t >= open || t < close
}

/** Towns along our corridor (Chennai - Salem - Namakkal), used by the map and "near ..." labels. */
export const TOWNS: { name: string; lat: number; lon: number }[] = [
  { name: 'Chennai', lat: 13.08, lon: 80.27 },
  { name: 'Sriperumbudur', lat: 12.96, lon: 79.95 },
  { name: 'Vellore', lat: 12.92, lon: 79.13 },
  { name: 'Krishnagiri', lat: 12.52, lon: 78.22 },
  { name: 'Dharmapuri', lat: 12.13, lon: 78.16 },
  { name: 'Salem', lat: 11.66, lon: 78.15 },
  { name: 'Namakkal', lat: 11.22, lon: 78.17 },
]

/** Closest corridor town to a point, with the straight-line distance in km. */
export function nearestTown(lat: number, lon: number): { name: string; km: number } {
  let best = { name: TOWNS[0].name, km: Infinity }
  for (const t of TOWNS) {
    const km = haversineKm(lat, lon, t.lat, t.lon)
    if (km < best.km) best = { name: t.name, km }
  }
  return best
}
