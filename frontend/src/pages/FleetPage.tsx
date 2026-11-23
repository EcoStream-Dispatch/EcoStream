import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, ChevronRight, Clock, Package, Search, Store, Truck, UserRound, Users, Wrench, type LucideIcon } from 'lucide-react'
import { getAlerts, getDrivers, getNearestGarages, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useLiveEvents, useThrottled } from '../services/live'
import StatusBadge from '../components/StatusBadge'
import PlanBadge from '../components/PlanBadge'
import { planOf } from '../lib/plans'
import FleetMap from '../components/FleetMap'
import { ErrorBox, Loading } from '../components/PageState'
import { ALERT_TITLE, STATUS_STYLE, formatAlertValue } from '../lib/status'
import { timeAgo } from '../lib/format'
import { SEVERITY_RANK, hoursUntilUnsafe, unsafeLabel } from '../lib/alerts'
import { positionName } from '../lib/tyreLayout'
import { AVAILABILITY } from '../lib/drivers'
import type { Alert, Driver, DriverAvailability, TruckSummary, TyreStatus } from '../types'

/**
 * Owner home - "Fleet Command Center" (Stitch v2: EcoStream Logistic Owner Portal).
 * Command bar + search, KPI pods, "Needs attention now" with the time-to-unsafe countdown,
 * corridor map, then every truck (spec section 6.2: reg no, status, last seen).
 *
 * Left out on purpose: shipments, tonnage, fuel chart, ₹ saved, crew/licence compliance and
 * driver applications. They are Phase 3 or need data we don't collect yet, and the
 * Stitch numbers for them were made up (docs/BRAND.md: no made-up numbers).
 */

/** A truck with no reading for this long counts as Offline. */
const OFFLINE_AFTER_MS = 30 * 60_000
const RANK = SEVERITY_RANK

type FleetState = TyreStatus

function fleetState(t: TruckSummary, now = Date.now()): FleetState {
  if (!t.last_seen_at || now - new Date(t.last_seen_at).getTime() > OFFLINE_AFTER_MS) return 'offline'
  return t.status
}

export default function FleetPage() {
  const trucksQ = useApi(getTrucks, [])
  const alertsQ = useApi(() => getAlerts(true), [])
  // Drivers are demo-only for now (null when not connected): then the driver row is hidden.
  const driversQ = useApi(getDrivers, [])
  const drivers = driversQ.data
  const driverOf = new Map((drivers ?? []).filter((d) => d.truck_id).map((d) => [d.truck_id!, d]))
  const refresh = useThrottled(() => {
    trucksQ.reload()
    alertsQ.reload()
  })
  useLiveEvents({ onReading: refresh, onAlert: refresh })
  const [query, setQuery] = useState('')

  const trucks = trucksQ.data
  const alerts = alertsQ.data ?? []
  const byId = new Map((trucks ?? []).map((t) => [t.id, t]))

  // Most urgent first: severity, then the soonest "unsafe in", then newest.
  const eta = (a: Alert) => hoursUntilUnsafe(a, byId.get(a.truck_id)) ?? Infinity
  const urgent = [...alerts].sort(
    (a, b) => RANK[b.severity] - RANK[a.severity] || eta(a) - eta(b) || b.created_at.localeCompare(a.created_at),
  )
  // Most urgent open alert per truck
  const topAlert = new Map<string, Alert>()
  for (const a of urgent) if (!topAlert.has(a.truck_id)) topAlert.set(a.truck_id, a)

  const q = query.trim().toLowerCase().replace(/\s+/g, '')
  const shown = (trucks ?? []).filter(
    (t) => !q || `${t.reg_no}${t.make}${t.model}${t.goods_type ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(q),
  )

  return (
    <>
      {/* ---------- Command bar ---------- */}
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 text-sm text-navy-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" aria-hidden /> Live tyre data
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Fleet command center</h1>
          <p className="mt-0.5 text-sm text-navy-700">
            Corridor: <span className="font-semibold text-navy-900">Chennai — Salem — Namakkal</span>
          </p>
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Find a truck</span>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a truck (e.g. TN 99)"
            className="h-11 w-full rounded-lg bg-white pl-10 pr-3 text-base shadow-sm ring-1 ring-gray-200 placeholder:text-navy-700/50 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </label>
      </div>

      {trucksQ.loading && !trucks && <Loading what="trucks" />}
      {trucksQ.error && <ErrorBox message={trucksQ.error} onRetry={trucksQ.reload} />}
      {trucks && trucks.length === 0 && <p className="text-navy-700">No trucks yet.</p>}

      {trucks && trucks.length > 0 && (
        <>
          <KpiPods trucks={trucks} openAlerts={alerts.length} />
          {drivers && <DriverStrip drivers={drivers} />}

          {/* ---------- Needs attention + map ---------- */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
            <section className="min-w-0 lg:col-span-5" aria-labelledby="attention-heading">
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-green-500/10">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 id="attention-heading" className="flex items-center gap-2 text-lg font-bold">
                    <span className="relative flex h-3 w-3">
                      {urgent.length > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical opacity-75" />}
                      <span className={`relative inline-flex h-3 w-3 rounded-full ${urgent.length ? 'bg-critical' : 'bg-green-500'}`} />
                    </span>
                    Needs attention now
                  </h2>
                  {urgent.length > 0 && (
                    <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-critical">{urgent.length} open</span>
                  )}
                </div>
                {urgent.length === 0 ? (
                  <p className="text-sm text-navy-700">Nothing right now. All tyres look fine.</p>
                ) : (
                  <ul className="space-y-3">
                    {urgent.slice(0, 3).map((a) => (
                      <li key={a.id}>
                        <Incident alert={a} truck={byId.get(a.truck_id)} />
                      </li>
                    ))}
                  </ul>
                )}
                {urgent.length > 3 && (
                  <Link to="/alerts" className="mt-3 inline-block text-sm font-semibold text-green-700 hover:underline">
                    See all {urgent.length} alerts →
                  </Link>
                )}
              </div>
            </section>
            <section className="min-w-0 lg:col-span-7" aria-label="Map">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-lg font-bold">Live corridor</h2>
                <span className="text-sm text-navy-700">NH 48 / NH 44</span>
              </div>
              <FleetMap trucks={trucks} />
            </section>
          </div>

          {/* ---------- All trucks ---------- */}
          <section className="mt-6" aria-labelledby="trucks-heading">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="trucks-heading" className="text-lg font-bold">
                My trucks
              </h2>
              <span className="text-sm text-navy-700">
                {shown.length} of {trucks.length}
              </span>
            </div>
            {shown.length === 0 ? (
              <p className="text-sm text-navy-700">No truck matches "{query}".</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((t) => (
                  <li key={t.id}>
                    <TruckCard truck={t} issue={topAlert.get(t.id)} driver={driverOf.get(t.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  )
}

function KpiPods({ trucks, openAlerts }: { trucks: TruckSummary[]; openAlerts: number }) {
  const counts: Record<FleetState, number> = { ok: 0, warning: 0, critical: 0, offline: 0 }
  trucks.forEach((t) => counts[fleetState(t)]++)
  const pct = (n: number) => `${Math.round((n / trucks.length) * 100)}%`

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Pod label="Fleet total" icon={Truck} value={trucks.length} note={`${trucks.length - counts.offline} reporting`} bar={1 - counts.offline / trucks.length} />
      {(['ok', 'warning', 'critical', 'offline'] as FleetState[]).map((s) => (
        <Pod
          key={s}
          label={STATUS_STYLE[s].label}
          icon={STATUS_STYLE[s].icon}
          value={counts[s]}
          note={`${pct(counts[s])} of trucks`}
          tone={s}
        />
      ))}
      <Pod label="Open alerts" icon={BellRing} value={openAlerts} note="Tap to see all" to="/alerts" tone={openAlerts ? 'critical' : 'ok'} />
    </ul>
  )
}

const TONE_TEXT: Record<FleetState, string> = {
  ok: 'text-green-700',
  warning: 'text-amber-800',
  critical: 'text-critical',
  offline: 'text-gray-600',
}

function Pod({
  label,
  icon: Icon,
  value,
  note,
  tone,
  bar,
  to,
}: {
  label: string
  icon: LucideIcon
  value: number
  note: string
  tone?: FleetState
  bar?: number
  to?: string
}) {
  const color = tone ? TONE_TEXT[tone] : 'text-navy-900'
  const body = (
    <>
      <div className={`flex items-center justify-between ${tone ? color : 'text-navy-700'}`}>
        <span className="font-heading text-[11px] font-bold uppercase tracking-wider">{label}</span>
        <Icon size={18} aria-hidden />
      </div>
      <p className={`my-1.5 font-heading text-4xl font-extrabold leading-none ${color}`}>{String(value).padStart(2, '0')}</p>
      <p className="text-xs text-navy-700">{note}</p>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-green-700" style={{ width: `${Math.round(bar * 100)}%` }} />
        </div>
      )}
    </>
  )
  const cls = 'flex h-full flex-col justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-green-500/10'
  return <li>{to ? <Link to={to} className={`${cls} transition hover:ring-green-500`}>{body}</Link> : <div className={cls}>{body}</div>}</li>
}

/** One "needs attention" card: truck chip, countdown, 3-number readout, nearest garage. */
function Incident({ alert, truck }: { alert: Alert; truck?: TruckSummary }) {
  const tyre = truck?.tyres.find((t) => t.id === alert.tyre_id)
  const hours = hoursUntilUnsafe(alert, truck)
  const garages = useApi(
    () => (truck?.lat == null || truck?.lon == null ? Promise.resolve([]) : getNearestGarages(truck.lat, truck.lon, 'tyre')),
    [truck?.lat, truck?.lon],
  )
  const g = garages.data?.[0]

  return (
    <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-navy-900 px-2 py-0.5 font-heading text-[11px] font-bold text-white">{truck?.reg_no ?? '—'}</span>
            <span className="text-sm font-semibold">
              {truck?.make} {truck?.model}
            </span>
          </div>
          <p className="mt-1 font-semibold">{ALERT_TITLE[alert.type]}</p>
        </div>
        {hours !== null ? (
          <span className="shrink-0 animate-pulse rounded bg-critical px-2 py-1 text-center font-heading text-[11px] font-bold uppercase text-white">
            {unsafeLabel(hours)}
          </span>
        ) : (
          <StatusBadge status={alert.severity} className="shrink-0" />
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-white p-2 text-center">
        <div>
          <dt className="font-heading text-[10px] font-bold uppercase text-navy-700">Reading</dt>
          <dd className={`mt-0.5 text-sm font-bold ${alert.severity === 'critical' ? 'text-critical' : 'text-navy-900'}`}>
            {formatAlertValue(alert.type, alert.value).replace(' (corrected)', '')}
          </dd>
        </div>
        <div>
          <dt className="font-heading text-[10px] font-bold uppercase text-navy-700">Position</dt>
          <dd className="mt-0.5 text-sm font-semibold">{tyre ? positionName(tyre.position) : '—'}</dd>
        </div>
        <div>
          <dt className="font-heading text-[10px] font-bold uppercase text-navy-700">Tyre temp</dt>
          <dd className="mt-0.5 text-sm font-bold">{tyre?.latest ? `${tyre.latest.temp_c.toFixed(0)} °C` : '—'}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
        <span className="flex min-w-0 items-center gap-1 text-sm text-navy-700">
          <Store size={16} className="shrink-0 text-green-700" aria-hidden />
          <span className="truncate">{g ? `${g.name} (${g.distance_km.toFixed(1)} km)` : garages.loading ? 'Finding garage…' : 'No open garage nearby'}</span>
        </span>
        <Link
          to={`/alerts/${alert.id}`}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-500"
        >
          <Wrench size={16} aria-hidden /> What to do
        </Link>
      </div>
      <p className="mt-2 text-xs text-navy-700">Raised {timeAgo(alert.created_at)}</p>
    </div>
  )
}

function TruckCard({ truck, issue, driver }: { truck: TruckSummary; issue?: Alert; driver?: Driver }) {
  const state = fleetState(truck)
  const counts = truck.tyres.reduce<Partial<Record<TyreStatus, number>>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})
  const pos = issue ? truck.tyres.find((t) => t.id === issue.tyre_id)?.position : undefined
  const hours = issue ? hoursUntilUnsafe(issue, truck) : null

  return (
    <Link
      to={`/trucks/${truck.id}`}
      className="block h-full rounded-xl bg-white p-4 shadow-sm ring-1 ring-green-500/10 transition hover:-translate-y-0.5 hover:ring-green-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-lg font-bold tracking-wide">{truck.reg_no}</span>
            <PlanBadge plan={planOf(truck)} />
          </p>
          <p className="text-sm text-navy-700">
            {truck.make} {truck.model} · {truck.tyres.length} tyres
          </p>
        </div>
        <StatusBadge status={state} />
      </div>

      <ul className="mt-2 space-y-0.5 text-sm text-navy-700">
        {truck.goods_type && (
          <li className="flex items-center gap-1.5">
            <Package size={14} className="shrink-0" aria-hidden /> <span className="truncate">{truck.goods_type}</span>
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <UserRound size={14} className="shrink-0" aria-hidden />
          <span className="truncate">{driver ? driver.name : 'No driver assigned'}</span>
        </li>
      </ul>

      {issue && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
            issue.severity === 'critical' ? 'bg-red-50 text-critical' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {ALERT_TITLE[issue.type]}
          {pos ? `: ${positionName(pos)}` : ''}
          {hours !== null && hours >= 1 ? ` · unsafe in ~${Math.round(hours)} h` : ''}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <span className="inline-flex shrink-0 items-center gap-1 text-sm text-navy-700">
          <Clock size={14} aria-hidden /> {timeAgo(truck.last_seen_at)}
        </span>
        <ul className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs text-navy-700">
          {(Object.keys(STATUS_STYLE) as TyreStatus[])
            .filter((s) => counts[s])
            .map((s) => (
              <li key={s} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_STYLE[s].hex }} aria-hidden />
                {counts[s]} {STATUS_STYLE[s].label}
              </li>
            ))}
        </ul>
        <ChevronRight size={18} className="shrink-0 text-navy-700" aria-hidden />
      </div>
    </Link>
  )
}

/** One line with driver availability counts, linking to the Drivers page. */
function DriverStrip({ drivers }: { drivers: Driver[] }) {
  const n = (a: DriverAvailability) => drivers.filter((d) => d.availability === a).length
  return (
    <Link
      to="/drivers"
      className="mt-3 flex min-h-[48px] flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-green-500/10 transition hover:ring-green-500"
    >
      <span className="inline-flex items-center gap-2 font-bold">
        <Users size={18} className="text-green-700" aria-hidden /> Drivers
      </span>
      {(['on_duty', 'available', 'off_duty'] as DriverAvailability[]).map((a) => (
        <span key={a} className="text-navy-700">
          <span className="font-heading font-extrabold text-navy-900">{n(a)}</span> {AVAILABILITY[a].label.toLowerCase()}
        </span>
      ))}
      <ChevronRight size={18} className="ml-auto text-navy-700" aria-hidden />
    </Link>
  )
}
