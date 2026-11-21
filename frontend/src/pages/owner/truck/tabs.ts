import { ADD_ONS, PLANS, availability, type Param, type ParamGroup } from '../../../data/plans'
import type { ParamStatus, ParamValue, TruckProfile, TyreStatus } from '../../../types'

/** Truck page tabs, and which parameter groups (src/data/plans.ts) each card tab shows. */
export type TabId = 'overview' | 'tyres' | 'engine' | 'brakes' | 'power' | 'driver' | 'cargo' | 'predictions' | 'maintenance'

export const TABS: { id: TabId; label: string; groups?: ParamGroup[] }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tyres', label: 'Tyres' },
  { id: 'engine', label: 'Engine', groups: ['Engine', 'Fuel'] },
  { id: 'brakes', label: 'Brakes & Chassis', groups: ['Brakes & Chassis'] },
  { id: 'power', label: 'Power & Device', groups: ['Power', 'Device', 'Location & Context'] },
  { id: 'driver', label: 'Driver', groups: ['Driver'] },
  { id: 'cargo', label: 'Cargo', groups: ['Cargo'] },
  { id: 'predictions', label: 'Predictions' },
  { id: 'maintenance', label: 'Maintenance & documents' },
]

/** Does this truck's plan (or one of its add-ons) include the parameter? */
export function isUnlocked(param: Param, profile: TruckProfile): boolean {
  if ('addOn' in param.unlock) return profile.add_ons.includes(param.unlock.addOn)
  return availability(param, profile.plan) === 'included'
}

/** Text on a locked card: "Available in Pro" / "Add-on: Cold chain". */
export function lockText(param: Param): string {
  if ('addOn' in param.unlock) {
    const id = param.unlock.addOn
    return `Add-on: ${ADD_ONS.find((a) => a.id === id)?.name ?? id}`
  }
  const tier = param.unlock.tier
  return `Available in ${PLANS.find((p) => p.id === tier)?.name ?? tier}`
}

/** Worst status of a list of values (for the Overview health summary). */
export function worst(values: ParamValue[]): ParamStatus {
  if (values.some((v) => v.status === 'critical')) return 'critical'
  if (values.some((v) => v.status === 'warning')) return 'warning'
  return 'ok'
}

export function worstTyreStatus(statuses: TyreStatus[]): TyreStatus {
  for (const s of ['critical', 'warning', 'offline'] as const) if (statuses.includes(s)) return s
  return 'ok'
}
