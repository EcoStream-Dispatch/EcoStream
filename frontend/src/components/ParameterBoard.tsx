import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BatteryCharging, ChevronDown, Cog, Disc, Disc3, Lock, MapPin, Package, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import {
  ADD_ON_NAME,
  GROUP_NAME,
  PARAMETERS,
  PARKED,
  accessFor,
  derivedValues,
  type Access,
  type ParamDef,
  type ParamGroup,
  type ParamStatus,
  type ParamValue,
  type Role,
} from '../lib/parameters'
import { PLAN_NAME, planOf } from '../lib/plans'
import { USING_MOCK_DATA } from '../services/api'
import type { Alert, TruckSummary } from '../types'

const GROUP_ICON: Record<ParamGroup, LucideIcon> = {
  tyres: Disc3,
  location: MapPin,
  power: BatteryCharging,
  engine: Cog,
  brakes: Disc,
  cargo: Package,
  driver: UserRound,
  device: ShieldCheck,
}
const GROUP_ORDER: ParamGroup[] = ['tyres', 'location', 'power', 'engine', 'brakes', 'cargo', 'driver', 'device']

const DOT: Record<ParamStatus, string> = {
  ok: 'bg-green-500',
  warning: 'bg-warning',
  critical: 'bg-critical',
  info: 'bg-navy-700/30',
}

interface Row {
  def: ParamDef
  access: Access
  value: ParamValue | null
}

const TITLE: Record<Role, string> = {
  owner: 'Every data point',
  driver: 'Truck vitals',
  shipper: 'Shipment & vehicle',
}
const INTRO: Record<Role, string> = {
  owner: "Everything EcoStream reads from this truck, grouped. What the truck's plan doesn't include is listed at the end.",
  driver: 'What matters while you drive: tyres, engine warnings, brakes, fuel and safety.',
  shipper: 'Where your goods are, how the truck is doing, and the cargo sensors.',
}

/**
 * All data points for one truck, filtered by who is looking (owner / driver / shipper)
 * and by the truck's plan and add-ons (lib/parameters.ts).
 * Tyre, position and battery values come from the API; the rest are demo values until the
 * engine (CAN) plug-in and add-on sensors exist, and say "Not connected yet" otherwise.
 */
export default function ParameterBoard({ truck, role, alerts = [], className = '' }: { truck: TruckSummary; role: Role; alerts?: Alert[]; className?: string }) {
  const plan = planOf(truck)
  const [onlyIssues, setOnlyIssues] = useState(false)

  const rows = useMemo<Row[]>(() => {
    const leak = alerts.find((a) => a.truck_id === truck.id && a.type === 'slow_leak' && !a.acknowledged_at)
    const leakTyre = leak ? truck.tyres.find((t) => t.id === leak.tyre_id) : undefined
    const values = { ...(truck.params ?? {}), ...derivedValues(truck, leak && leakTyre ? { position: leakTyre.position, rate: leak.value } : null) }
    return PARAMETERS.filter((d) => d.roles.includes(role)).map((def) => ({
      def,
      access: accessFor(def, plan, truck.add_ons ?? []),
      value: values[def.key] ?? null,
    }))
  }, [truck, role, alerts, plan])

  const live = rows.filter((r) => r.access.kind === 'on')
  const locked = rows.filter((r) => r.access.kind !== 'on')
  const issues = live.filter((r) => r.value?.status === 'warning' || r.value?.status === 'critical')
  const shown = onlyIssues ? issues : live

  return (
    <section className={`min-w-0 ${className}`} aria-labelledby={`params-${role}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`params-${role}`} className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {TITLE[role]}
            {USING_MOCK_DATA && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-warning/40">Demo values</span>
            )}
          </h2>
          <p className="text-sm text-navy-700">{INTRO[role]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700 ring-1 ring-green-500/30">{live.length} on this truck</span>
          <button
            type="button"
            onClick={() => setOnlyIssues((v) => !v)}
            aria-pressed={onlyIssues}
            className={`min-h-[32px] rounded-full px-2.5 py-1 ring-1 transition ${
              onlyIssues ? 'bg-warning text-navy-900 ring-warning' : 'bg-amber-50 text-amber-800 ring-warning/40 hover:bg-amber-100'
            }`}
          >
            {issues.length} need a look{onlyIssues ? ' · show all' : ''}
          </button>
          {locked.length > 0 && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-navy-700 ring-1 ring-gray-200">{locked.length} not on this truck</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {GROUP_ORDER.map((g) => {
          const list = shown.filter((r) => r.def.group === g)
          if (!list.length) return null
          const Icon = GROUP_ICON[g]
          // A long group (engine data on Pro) takes two columns, so it doesn't leave a tall gap beside it.
          const wide = list.length > 8
          return (
            <div key={g} className={`min-w-0 rounded-xl bg-white shadow-sm ring-1 ring-gray-200 ${wide ? 'md:col-span-2' : ''}`}>
              <h3 className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-navy-700">
                <Icon size={17} className="text-green-700" aria-hidden /> {GROUP_NAME[g]}
                <span className="ml-auto text-xs font-semibold normal-case tracking-normal text-navy-700/70">{list.length}</span>
              </h3>
              <ul className={wide ? 'grid divide-y divide-gray-100 md:grid-cols-2 md:divide-y-0 [&>li]:border-gray-100 md:[&>li]:border-b' : 'divide-y divide-gray-100'}>
                {list.map((r) => (
                  <ValueRow key={r.def.key} row={r} />
                ))}
              </ul>
            </div>
          )
        })}
        {onlyIssues && issues.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-navy-700 ring-1 ring-gray-200">Nothing needs a look right now.</p>}
      </div>

      {(locked.length > 0 || role === 'owner') && !onlyIssues && <LockedList rows={locked} role={role} planName={PLAN_NAME[plan]} />}
    </section>
  )
}

function ValueRow({ row }: { row: Row }) {
  const { def, value } = row
  const status = value?.status
  return (
    <li className="flex gap-3 px-4 py-2.5">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${status ? DOT[status] : 'bg-gray-200'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2 text-xs text-navy-700">
          <span className="min-w-0">{def.label}</span>
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-navy-700/80" title={`Source: ${def.source}`}>
            {SOURCE_SHORT[def.source]}
          </span>
        </p>
        {value ? (
          <>
            <p className={`font-semibold leading-snug ${status === 'critical' ? 'text-critical' : status === 'warning' ? 'text-amber-800' : 'text-navy-900'}`}>
              {value.text}
              {status && status !== 'info' && <span className="sr-only"> ({status === 'ok' ? 'OK' : status})</span>}
            </p>
            {value.note && <p className="text-xs leading-snug text-navy-700">{value.note}</p>}
          </>
        ) : (
          <p className="text-sm text-navy-700">
            Not connected yet <span className="text-xs">· {def.powers}</span>
          </p>
        )}
      </div>
    </li>
  )
}

const SOURCE_SHORT: Record<ParamDef['source'], string> = {
  'Our sensor': 'Sensor',
  'Truck CAN': 'CAN',
  Derived: 'Computed',
  'Add-on sensor': 'Add-on',
  'Garage tool': 'Garage',
}

/** Data points this truck doesn't have, and what would turn them on. Owner also sees the parked list. */
function LockedList({ rows, role, planName }: { rows: Row[]; role: Role; planName: string }) {
  const [open, setOpen] = useState(false)
  const label = (a: Access) =>
    a.kind === 'plan'
      ? `${PLAN_NAME[a.needs]} plan`
      : a.kind === 'addon'
        ? `Add-on: ${ADD_ON_NAME[a.addOn]}${a.needs ? ` (${PLAN_NAME[a.needs]})` : ''}`
        : ''
  return (
    <div className="mt-3 rounded-xl bg-gray-50 ring-1 ring-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[48px] w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-navy-900"
      >
        <Lock size={16} className="text-navy-700" aria-hidden />
        {rows.length} data points not on this truck ({planName} plan)
        {role === 'owner' && <span className="font-normal text-navy-700"> · and {PARKED.length} planned for later</span>}
        <ChevronDown size={18} className={`ml-auto transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-gray-200 px-4 pb-4 pt-2">
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.def.key} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 text-navy-900">{r.def.label}</span>
                <span className="shrink-0 text-xs font-semibold text-navy-700">{label(r.access)}</span>
              </li>
            ))}
          </ul>
          {role === 'owner' && (
            <>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-navy-700">Planned for later (not in any plan yet)</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-navy-700">
                {PARKED.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <Link to="/plans" className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-500">
                See plans and add-ons
              </Link>
            </>
          )}
          {role !== 'owner' && <p className="mt-3 text-xs text-navy-700">The truck owner can turn these on with a plan upgrade or add-on.</p>}
        </div>
      )}
    </div>
  )
}
