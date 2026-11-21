import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { PARAMS, type Param, type ParamGroup } from '../../../data/plans'
import { Sparkline } from '../../../components/owner/ui'
import StatusBadge from '../../../components/StatusBadge'
import type { ParamValue, TruckDetails, TruckSummary } from '../../../types'
import { isUnlocked, lockText } from './tabs'

/*
 * Engine / Brakes & Chassis / Power & Device / Driver / Cargo tabs.
 * One card per parameter: live value, status (icon + word), 24 h sparkline, normal range.
 * Cards the truck's plan doesn't include are greyed out with a lock and an Upgrade link
 * to Plan & Billing (docs/WEBSITE_SPEC.md: "locked card -> Plan & Billing").
 */
export default function ParamsTab({ truck, details, groups }: { truck: TruckSummary; details: TruckDetails; groups: ParamGroup[] }) {
  const values = new Map(details.params.map((v) => [v.key, v]))
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const params = PARAMS.filter((p) => p.group === g)
        const open = params.filter((p) => isUnlocked(p, details.profile)).length
        return (
          <section key={g}>
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-bold uppercase tracking-wide text-navy-700">
              {g === 'Engine' ? 'Engine (from the truck’s CAN bus)' : g}
              <span className="text-xs font-semibold normal-case tracking-normal">
                {open} of {params.length} in this truck’s plan
              </span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {params.map((p) =>
                isUnlocked(p, details.profile) ? (
                  <ValueCard key={p.key} param={p} value={values.get(p.key)} />
                ) : (
                  <LockedCard key={p.key} param={p} truckId={truck.id} />
                ),
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function ValueCard({ param, value }: { param: Param; value?: ParamValue }) {
  return (
    <li className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy-700">{param.name}</h3>
        {value && <StatusBadge status={value.status} />}
      </div>
      <p className="mt-1 font-heading text-xl font-extrabold">{value?.value ?? 'No data'}</p>
      {value?.detail && <p className="text-xs text-navy-700">{value.detail}</p>}
      {value?.series && <Sparkline values={value.series} className="mt-2" />}
      <p className="mt-auto pt-2 text-xs text-navy-700">{value?.normal ? `Normal: ${value.normal}` : `Unit: ${param.unit}`}</p>
    </li>
  )
}

function LockedCard({ param, truckId }: { param: Param; truckId: string }) {
  return (
    <li className="flex flex-col rounded-xl bg-gray-100 p-4 text-gray-500 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{param.name}</h3>
        <Lock size={16} aria-label="Locked" />
      </div>
      <p className="mt-1 font-heading text-xl font-extrabold tracking-widest" aria-hidden>
        - - -
      </p>
      <p className="mt-auto pt-2 text-xs">
        {lockText(param)} -{' '}
        <Link to={`/owner/plan?truck=${truckId}`} className="font-semibold text-green-700 underline hover:text-green-500">
          Upgrade
        </Link>
      </p>
    </li>
  )
}
