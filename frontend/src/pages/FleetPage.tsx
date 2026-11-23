import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, BellRing, ChevronRight, Clock, Wrench } from 'lucide-react'
import { getAlerts, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useLiveEvents, useThrottled } from '../services/live'
import StatusBadge from '../components/StatusBadge'
import FleetMap from '../components/FleetMap'
import { ErrorBox, Loading } from '../components/PageState'
import { ALERT_TITLE, STATUS_STYLE } from '../lib/status'
import { timeAgo } from '../lib/format'
import { positionName } from '../lib/tyreLayout'
import type { Alert, TruckSummary, TyreStatus } from '../types'

/**
 * Owner home - "Fleet command" (Stitch: Logistic Owner Portal, redrawn in the light brand).
 * Status gauge + summary chips, live map, maintenance alerts, then one card per truck
 * (spec section 6.2: reg no, status, last seen).
 *
 * Left out on purpose (Phase 3 dispatch): applications, contracts, shipments, stock.
 */

/** A truck with no reading for this long counts as Offline in the summary. */
const OFFLINE_AFTER_MS = 30 * 60_000

type FleetState = TyreStatus // ok | warning | critical | offline

function fleetState(t: TruckSummary, now = Date.now()): FleetState {
  if (!t.last_seen_at || now - new Date(t.last_seen_at).getTime() > OFFLINE_AFTER_MS) return 'offline'
  return t.status
}

const SEVERITY_RANK = { critical: 2, warning: 1 } as const

export default function FleetPage() {
  const trucksQ = useApi(getTrucks, [])
  const alertsQ = useApi(() => getAlerts(true), [])
  // Live: new readings/alerts -> refresh (at most every 3 s).
  const refresh = useThrottled(() => {
    trucksQ.reload()
    alertsQ.reload()
  })
  useLiveEvents({ onReading: refresh, onAlert: refresh })

  const trucks = trucksQ.data
  const alerts = alertsQ.data ?? []

  // Worst open alert per truck -> the one-line issue on its card.
  const topAlert = new Map<string, Alert>()
  for (const a of alerts) {
    const cur = topAlert.get(a.truck_id)
    if (!cur || SEVERITY_RANK[a.severity] > SEVERITY_RANK[cur.severity]) topAlert.set(a.truck_id, a)
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Fleet command</h1>
          {trucks && (
            <p className="mt-1 text-sm text-navy-700">
              {trucks.length} truck{trucks.length === 1 ? '' : 's'} · {trucks.filter((t) => fleetState(t) !== 'ok').length} need
              attention
            </p>
          )}
        </div>
        <Link
          to="/alerts"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold shadow-sm ring-1 ring-green-500/15 hover:ring-green-500"
        >
          <BellRing size={18} className="text-critical" aria-hidden />
          {alerts.length} open alert{alerts.length === 1 ? '' : 's'}
        </Link>
      </div>

      <div className="mt-4">
        {trucksQ.loading && !trucks && <Loading what="trucks" />}
        {trucksQ.error && <ErrorBox message={trucksQ.error} onRetry={trucksQ.reload} />}
        {trucks && trucks.length === 0 && <p className="text-navy-700">No trucks yet.</p>}
      </div>

      {trucks && trucks.length > 0 && (
        <>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <FleetStatus trucks={trucks} />
            </div>
            <div className="lg:col-span-8">
              <FleetMap trucks={trucks} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <section className="lg:col-span-5">
              <MaintenanceAlerts alerts={alerts} trucks={trucks} />
            </section>
            <section className="lg:col-span-7" aria-labelledby="trucks-heading">
              <h2 id="trucks-heading" className="mb-3 text-lg font-bold">
                My trucks
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {trucks.map((t) => (
                  <li key={t.id}>
                    <TruckCard truck={t} issue={topAlert.get(t.id)} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  )
}

/** Ring gauge (% of trucks OK) + OK / Warning / Critical / Offline chips. */
function FleetStatus({ trucks }: { trucks: TruckSummary[] }) {
  const counts: Record<FleetState, number> = { ok: 0, warning: 0, critical: 0, offline: 0 }
  trucks.forEach((t) => counts[fleetState(t)]++)
  const okPct = Math.round((counts.ok / trucks.length) * 100)
  const R = 58
  const C = 2 * Math.PI * R

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/15">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-bold">Fleet status</h2>
        <Activity size={20} className="text-navy-700" aria-hidden />
      </div>
      <div className="mt-4 flex flex-1 items-center justify-around gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="64" cy="64" r={R} fill="none" stroke="#F4F9F1" strokeWidth="10" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="#5C9A35"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - okPct / 100)}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-2xl font-extrabold">{okPct}%</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-navy-700">All OK</span>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {(Object.keys(counts) as FleetState[]).map((s) => {
            const { label, icon: Icon, badge } = STATUS_STYLE[s]
            return (
              <li key={s} className={`flex min-w-[76px] flex-col rounded-xl px-3 py-2 ring-1 ${badge}`}>
                <span className="inline-flex items-center gap-1 text-xs font-semibold">
                  <Icon size={14} aria-hidden /> {label}
                </span>
                <span className="font-heading text-xl font-extrabold">{counts[s]}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function MaintenanceAlerts({ alerts, trucks }: { alerts: Alert[]; trucks: TruckSummary[] }) {
  const byId = new Map(trucks.map((t) => [t.id, t]))
  const tyrePos = new Map(trucks.flatMap((t) => t.tyres.map((ty) => [ty.id, ty.position] as const)))
  const sorted = [...alerts].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.created_at.localeCompare(a.created_at))
  const critical = alerts.filter((a) => a.severity === 'critical').length

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/15">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold">
          <AlertTriangle size={20} className="text-critical" aria-hidden /> Maintenance alerts
        </h2>
        {critical > 0 && (
          <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-critical">{critical} critical</span>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-navy-700">No open alerts. All tyres look fine.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.slice(0, 4).map((a) => {
            const truck = byId.get(a.truck_id)
            const pos = tyrePos.get(a.tyre_id)
            return (
              <li key={a.id}>
                <Link
                  to="/alerts"
                  className="group flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100 transition hover:ring-green-500"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-center font-heading text-[10px] font-bold leading-tight ring-1 ring-gray-200">
                      {truck?.reg_no.slice(-4) ?? '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {ALERT_TITLE[a.type]} <StatusBadge status={a.severity} />
                      </p>
                      <p className="truncate text-sm text-navy-700">
                        {truck?.reg_no}
                        {pos ? ` · ${positionName(pos)}` : ''} · {timeAgo(a.created_at)}
                      </p>
                    </div>
                  </div>
                  <Wrench size={18} className="shrink-0 text-green-700" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {sorted.length > 4 && (
        <Link to="/alerts" className="mt-3 text-sm font-semibold text-green-700 hover:underline">
          See all {sorted.length} alerts →
        </Link>
      )}
    </div>
  )
}

function TruckCard({ truck, issue }: { truck: TruckSummary; issue?: Alert }) {
  const state = fleetState(truck)
  const counts = truck.tyres.reduce<Partial<Record<TyreStatus, number>>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})
  const pos = issue ? truck.tyres.find((t) => t.id === issue.tyre_id)?.position : undefined

  return (
    <Link
      to={`/trucks/${truck.id}`}
      className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-green-500/15 transition hover:-translate-y-0.5 hover:ring-green-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold tracking-wide">{truck.reg_no}</p>
          <p className="text-sm text-navy-700">
            {truck.make} {truck.model} · {truck.tyres.length} tyres
          </p>
        </div>
        <StatusBadge status={state} />
      </div>

      {issue && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${issue.severity === 'critical' ? 'bg-red-50 text-critical' : 'bg-amber-50 text-amber-900'}`}>
          {ALERT_TITLE[issue.type]}
          {pos ? `: ${positionName(pos)}` : ''}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="inline-flex items-center gap-1 text-sm text-navy-700">
          <Clock size={14} aria-hidden /> {timeAgo(truck.last_seen_at)}
        </span>
        <ul className="flex flex-wrap gap-3 text-xs text-navy-700">
          {(Object.keys(STATUS_STYLE) as TyreStatus[])
            .filter((s) => counts[s])
            .map((s) => (
              <li key={s} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_STYLE[s].hex }} aria-hidden />
                {counts[s]} {STATUS_STYLE[s].label}
              </li>
            ))}
        </ul>
        <ChevronRight size={18} className="text-navy-700" aria-hidden />
      </div>
    </Link>
  )
}
