import type { AxleConfig, Driver, TruckSummary, TyreStatus } from '../types'
import type { AddOnId } from '../data/plans'
import { haversineKm } from './geo'
import type { LatLon } from './route'

/*
 * "Suggested truck + driver" for a new shipment (docs/WEBSITE_SPEC.md section 2.7):
 * based on availability, the right truck for the goods, and truck health.
 *
 * Simple, explainable rules (every suggestion says WHY):
 *   - Not suggested: truck Critical, too small for the weight, busy at pickup time,
 *     or the goods need cold chain and the truck has no cold-chain add-on.
 *   - Ranked by: health (OK first), how well the size fits, distance to the pickup.
 *     Points: OK +30, Warning +10, size fit up to +20, minus 1 per 10 km. So health is
 *     worth about 200 km: a nearby Warning truck beats an OK truck 300 km away.
 *
 * Payload limits per wheel layout are SAMPLE values for the demo, not legal limits.
 */

export const SAMPLE_PAYLOAD_T: Record<AxleConfig, number> = {
  '6W': 9,
  '10W': 16,
  '12W': 21,
  '14W': 25,
  '18W': 35,
}

export interface Candidate {
  truck: TruckSummary
  health: TyreStatus
  addOns: AddOnId[]
  /** The truck's regular driver, if any */
  driver: Driver | null
  /** When the current shipment ends (ETA), null if free now */
  busyUntil: string | null
  /** Where the truck will start from (current position or end of current trip) */
  startsAt: LatLon | null
}

export interface Suggestion {
  truck: TruckSummary
  driver: Driver | null
  ok: boolean
  score: number
  reasons: string[]
  problems: string[]
}

export function suggestTrucks(
  need: { weight_t: number; cold_chain: boolean; pickup_at: string; from: LatLon },
  candidates: Candidate[],
  freeDrivers: Driver[],
): Suggestion[] {
  const pickup = new Date(need.pickup_at).getTime()
  const usedDrivers = new Set<string>()

  const out = candidates.map((c): Suggestion => {
    const reasons: string[] = []
    const problems: string[] = []
    const cap = SAMPLE_PAYLOAD_T[c.truck.axle_config]
    let score = 0

    if (c.health === 'critical') problems.push('Critical problem open: fix before dispatch')
    else if (c.health === 'warning') {
      score += 10
      reasons.push('Health: warning (check the open alert)')
    } else if (c.health === 'offline') reasons.push('No data for over 30 min: check before dispatch')
    else {
      score += 30
      reasons.push('Health: OK')
    }

    if (need.weight_t > cap) problems.push(`Too small: carries about ${cap} t`)
    else {
      const spare = cap - need.weight_t
      score += Math.max(0, 20 - spare * 2)
      reasons.push(`Fits ${need.weight_t} t (about ${cap} t max)`)
    }

    if (need.cold_chain) {
      if (c.addOns.includes('cold_chain')) reasons.push('Has cold-chain monitoring')
      else problems.push('No cold-chain monitoring for chilled goods')
    }

    if (c.busyUntil && new Date(c.busyUntil).getTime() > pickup) problems.push('Still on another shipment at pickup time')
    else if (c.busyUntil) reasons.push('Free after its current delivery')
    else reasons.push('Free now')

    if (c.startsAt) {
      const km = Math.round(haversineKm(c.startsAt[0], c.startsAt[1], need.from[0], need.from[1]))
      score -= km / 10
      reasons.push(`${km} km from pickup`)
    }

    return { truck: c.truck, driver: c.driver, ok: problems.length === 0, score, reasons, problems }
  })

  out.sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score)

  // Driver: the truck's own driver, else a free driver (each driver suggested once).
  for (const s of out) {
    if (!s.ok) continue
    if (s.driver && s.driver.availability !== 'off' && !usedDrivers.has(s.driver.id)) {
      usedDrivers.add(s.driver.id)
      continue
    }
    const free = freeDrivers.find((d) => d.availability === 'available' && !usedDrivers.has(d.id)) ?? null
    s.driver = free
    if (free) usedDrivers.add(free.id)
    else s.reasons.push('No free driver: assign one by hand')
  }
  return out
}
