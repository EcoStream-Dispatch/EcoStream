import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BatteryCharging, ChevronDown, Cog, Disc, Disc3, Lock, MapPin, Package, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import {
  ADD_ON_NAME,
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
import { useLang, type Key } from '../lib/i18n'
import { paramLabel } from '../lib/paramLabels'
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

const RANK = { critical: 2, warning: 1, other: 0 } as const
const rankOf = (r: Row) => (r.value?.status === 'critical' ? 'critical' : r.value?.status === 'warning' ? 'warning' : 'other')
const isIssue = (r: Row) => rankOf(r) !== 'other'

/** Phones: a group starts closed unless something in it needs a look. Tablets and up: always open. */
const isPhone = () => typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches

const DOT: Record<ParamStatus, string> = {
  ok: 'bg-green-500',
  warning: 'bg-warning',
  critical: 'bg-critical',
  // Just a reading, no good/bad judgement: hollow, so it doesn't look like "no data".
  info: 'bg-white ring-2 ring-inset ring-navy-700/40',
}

interface Row {
  def: ParamDef
  access: Access
  value: ParamValue | null
}


/**
 * All data points for one truck, filtered by who is looking (owner / driver / shipper)
 * and by the truck's plan and add-ons (lib/parameters.ts).
 * Tyre, position and battery values come from the API; the rest are demo values until the
 * engine (CAN) plug-in and add-on sensors exist, and say "Not connected yet" otherwise.
 */
export default function ParameterBoard({ truck, role, alerts = [], className = '' }: { truck: TruckSummary; role: Role; alerts?: Alert[]; className?: string }) {
  const plan = planOf(truck)
  const { t } = useLang()
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

  const live = rows.filter((r) => r.access.kind === 'on').sort((a, b) => RANK[rankOf(b)] - RANK[rankOf(a)])
  const locked = rows.filter((r) => r.access.kind !== 'on')
  const issues = live.filter(isIssue)
  const shown = onlyIssues ? issues : live

  return (
    <section className={`min-w-0 ${className}`} aria-labelledby={`params-${role}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`params-${role}`} className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {t(`pb.title.${role}` as Key)}
            {USING_MOCK_DATA && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-warning/40">{t('pb.demo')}</span>
            )}
          </h2>
          <p className="text-sm text-navy-700">{t(`pb.intro.${role}` as Key)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700 ring-1 ring-green-500/30">{t('pb.onTruck', { n: live.length })}</span>
          <button
            type="button"
            onClick={() => setOnlyIssues((v) => !v)}
            aria-pressed={onlyIssues}
            className={`min-h-[32px] rounded-full px-2.5 py-1 ring-1 transition ${
              onlyIssues ? 'bg-warning text-navy-900 ring-warning' : 'bg-amber-50 text-amber-800 ring-warning/40 hover:bg-amber-100'
            }`}
          >
            {t('pb.needLook', { n: issues.length })}
            {onlyIssues ? t('pb.showAll') : ''}
          </button>
          {locked.length > 0 && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-navy-700 ring-1 ring-gray-200">{t('pb.notOn', { n: locked.length })}</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {GROUP_ORDER.map((g) => {
          const list = shown.filter((r) => r.def.group === g)
          if (!list.length) return null
          return <GroupCard key={g} group={g} list={list} forceOpen={onlyIssues} />
        })}
        {onlyIssues && issues.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-navy-700 ring-1 ring-gray-200">{t('pb.nothing')}</p>}
      </div>

      {(locked.length > 0 || role === 'owner') && !onlyIssues && <LockedList rows={locked} role={role} planName={PLAN_NAME[plan]} />}
    </section>
  )
}

function GroupCard({ group, list, forceOpen }: { group: ParamGroup; list: Row[]; forceOpen: boolean }) {
  const { t } = useLang()
  const issueCount = list.filter(isIssue).length
  const [open, setOpen] = useState(() => !isPhone() || issueCount > 0)
  const shown = open || forceOpen
  const Icon = GROUP_ICON[group]
  // A long group (engine data on Pro) takes two columns, so it doesn't leave a tall gap beside it.
  const wide = list.length > 8
  const listId = `group-${group}`
  return (
    <div className={`min-w-0 rounded-xl bg-white shadow-sm ring-1 ring-gray-200 ${wide ? 'md:col-span-2' : ''}`}>
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={shown}
          aria-controls={listId}
          className={`flex min-h-[44px] w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold uppercase tracking-wide text-navy-700 md:pointer-events-none ${
            shown ? 'border-b border-gray-100' : 'md:border-b md:border-gray-100'
          }`}
        >
          <Icon size={17} className="shrink-0 text-green-700" aria-hidden /> {t(`pb.g.${group}` as Key)}
          <span className="ml-auto flex items-center gap-2 text-xs font-semibold normal-case tracking-normal">
            {issueCount > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-warning/40">{t('pb.needLook', { n: issueCount })}</span>
            ) : (
              <span className="text-green-700">{t('pb.allNormal')}</span>
            )}
            <span className="text-navy-700/70">{list.length}</span>
            <ChevronDown size={18} className={`text-navy-700 transition md:hidden ${shown ? 'rotate-180' : ''}`} aria-hidden />
          </span>
        </button>
      </h3>
      <ul
        id={listId}
        className={`${shown ? '' : 'hidden'} ${
          wide ? 'divide-y divide-gray-100 md:grid md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b md:[&>li]:border-gray-100' : 'divide-y divide-gray-100 md:block'
        } ${wide && !shown ? 'md:grid' : ''}`}
      >
        {list.map((r) => (
          <ValueRow key={r.def.key} row={r} />
        ))}
      </ul>
    </div>
  )
}

function ValueRow({ row }: { row: Row }) {
  const { def, value } = row
  const { t, lang } = useLang()
  const status = value?.status
  return (
    <li className="flex gap-3 px-4 py-2.5">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${status ? DOT[status] : 'bg-gray-200'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2 text-xs text-navy-700">
          <span className="min-w-0">{paramLabel(def, lang)}</span>
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-navy-700/80" title={`Source: ${def.source}`}>
            {t(SOURCE_KEY[def.source])}
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
            {t('pb.notConnected')} <span className="text-xs">· {def.powers}</span>
          </p>
        )}
      </div>
    </li>
  )
}

const SOURCE_KEY: Record<ParamDef['source'], Key> = {
  'Our sensor': 'pb.src.sensor',
  'Truck CAN': 'pb.src.can',
  Derived: 'pb.src.computed',
  'Add-on sensor': 'pb.src.addon',
  'Garage tool': 'pb.src.garage',
}

/** Data points this truck doesn't have, and what would turn them on. Owner also sees the parked list. */
function LockedList({ rows, role, planName }: { rows: Row[]; role: Role; planName: string }) {
  const [open, setOpen] = useState(false)
  const { t, lang } = useLang()
  const label = (a: Access) =>
    a.kind === 'plan'
      ? t('pb.planNeeded', { plan: PLAN_NAME[a.needs] })
      : a.kind === 'addon'
        ? t('pb.addonNeeded', { name: ADD_ON_NAME[a.addOn] }) + (a.needs ? ` (${PLAN_NAME[a.needs]})` : '')
        : ''
  return (
    <div className="mt-3 rounded-xl bg-gray-50 ring-1 ring-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[48px] w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-navy-900"
      >
        <Lock size={16} className="shrink-0 text-navy-700" aria-hidden />
        <span className="min-w-0">
          {t('pb.lockedHead', { n: rows.length, plan: planName })}
          {role === 'owner' && <span className="block text-xs font-normal text-navy-700 sm:inline sm:text-sm"><span className="hidden sm:inline"> · </span>{t('pb.parkedShort', { n: PARKED.length })}</span>}
        </span>
        <ChevronDown size={18} className={`ml-auto shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-gray-200 px-4 pb-4 pt-2">
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.def.key} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 text-navy-900">{paramLabel(r.def, lang)}</span>
                <span className="shrink-0 text-xs font-semibold text-navy-700">{label(r.access)}</span>
              </li>
            ))}
          </ul>
          {role === 'owner' && (
            <>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-navy-700">{t('pb.parkedTitle')}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-navy-700">
                {PARKED.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <Link to="/plans" className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-500">
                {t('pb.seePlans')}
              </Link>
            </>
          )}
          {role !== 'owner' && <p className="mt-3 text-xs text-navy-700">{t('pb.ownerCan')}</p>}
        </div>
      )}
    </div>
  )
}
