import { haversineKm } from './geo'

/*
 * Routes along our first corridor: Chennai - Vellore - Krishnagiri - Salem - Namakkal (NH48 / NH44).
 * There is no road-routing service yet, so a "planned route" is the corridor's waypoints
 * between the two places. Good enough for the demo; a real routing API replaces this later.
 */

export type LatLon = [number, number]

export const CORRIDOR: { name: string; at: LatLon }[] = [
  { name: 'Chennai', at: [13.0827, 80.2707] },
  { name: 'Sriperumbudur', at: [12.9675, 79.9419] },
  { name: 'Vellore', at: [12.9165, 79.1325] },
  { name: 'Vaniyambadi', at: [12.682, 78.6206] },
  { name: 'Krishnagiri', at: [12.5186, 78.2137] },
  { name: 'Dharmapuri', at: [12.1277, 78.1579] },
  { name: 'Salem', at: [11.6643, 78.146] },
  { name: 'Namakkal', at: [11.2189, 78.1674] },
]

const dist = (a: LatLon, b: LatLon) => haversineKm(a[0], a[1], b[0], b[1])

/** Index of the corridor waypoint nearest to a point. */
function nearestIndex(p: LatLon): number {
  let best = 0
  CORRIDOR.forEach((c, i) => {
    if (dist(p, c.at) < dist(p, CORRIDOR[best].at)) best = i
  })
  return best
}

/** Planned route from `from` to `to` along the corridor (both ends included). */
export function plannedRoute(from: LatLon, to: LatLon): LatLon[] {
  const a = nearestIndex(from)
  const b = nearestIndex(to)
  const step = a <= b ? 1 : -1
  const mid: LatLon[] = []
  for (let i = a; i !== b + step; i += step) mid.push(CORRIDOR[i].at)
  return [from, ...mid.filter((p) => dist(p, from) > 3 && dist(p, to) > 3), to]
}

/** Waypoint names along a route, e.g. ["Vellore", "Vaniyambadi", "Krishnagiri"] */
export function townsOnRoute(route: LatLon[]): string[] {
  return route.map((p) => CORRIDOR.find((c) => dist(c.at, p) < 3)?.name).filter((n): n is string => !!n)
}

export function routeLengthKm(route: LatLon[]): number {
  let km = 0
  for (let i = 1; i < route.length; i++) km += dist(route[i - 1], route[i])
  return km
}

/** Where a point sits along a route: km from the start (snapped to the nearest segment). */
export function kmAlong(route: LatLon[], p: LatLon): number {
  let best = { d: Infinity, km: 0 }
  let done = 0
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]
    const b = route[i]
    const seg = dist(a, b)
    // Project onto the segment in plain lat/lon (fine for short distances).
    const dx = b[1] - a[1]
    const dy = b[0] - a[0]
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / len2))
    const q: LatLon = [a[0] + dy * t, a[1] + dx * t]
    const d = dist(p, q)
    if (d < best.d) best = { d, km: done + seg * t }
    done += seg
  }
  return best.km
}

/** Point a given number of km along a route. */
export function pointAtKm(route: LatLon[], km: number): LatLon {
  let left = km
  for (let i = 1; i < route.length; i++) {
    const seg = dist(route[i - 1], route[i])
    if (left <= seg) {
      const t = seg ? left / seg : 0
      return [route[i - 1][0] + (route[i][0] - route[i - 1][0]) * t, route[i - 1][1] + (route[i][1] - route[i - 1][1]) * t]
    }
    left -= seg
  }
  return route[route.length - 1]
}

/** Distance from a point to the nearest part of a route, km. */
export function kmFromRoute(route: LatLon[], p: LatLon): number {
  const along = kmAlong(route, p)
  return dist(pointAtKm(route, along), p)
}

/** "near Krishnagiri" / "12 km from Salem" for a position on the corridor. */
export function placeName(p: LatLon): string {
  let best = CORRIDOR[0]
  for (const c of CORRIDOR) if (dist(p, c.at) < dist(p, best.at)) best = c
  const km = Math.round(dist(p, best.at))
  return km < 5 ? `near ${best.name}` : `${km} km from ${best.name}`
}
