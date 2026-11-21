import { Suspense, lazy, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  OctagonAlert,
  Package,
  ShieldCheck,
  WifiOff,
  Wrench,
} from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useOwnerData } from '../../hooks/useOwnerData'
import {
  AVOIDED_BREAKDOWN_RUPEES,
  breakdownsAvoidedThisMonth,
  getAlerts,
  predictionsFor,
  upcomingMaintenance,
  bookGarageHref,
} from '../../services/api'
import { truckHealth } from '../../lib/status'
import { Card, CardTitle, DemoTag, Kpi, PageHeader, RiskBadge, dueText, formatDate, rupees } from '../../components/owner/ui'
import { MapLegend } from '../../components/owner/mapStyle'
import { ErrorBox, Loading } from '../../components/PageState'
import StatusBadge from '../../components/StatusBadge'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { Prediction, Shipment, TruckSummary, TyreStatus } from '../../types'

const FleetMap = lazy(() => import('../../components/owner/FleetMap'))

/*
 * Owner dashboard (docs/WEBSITE_SPEC.md section 2.1).
 * Goal: understand the worst problem and act on it in under 10 seconds.
 * Order on phones: KPIs, "Needs attention now", map, shipments, maintenance.
 */
export default function DashboardPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { trucks, openAlerts, shipments, loading, error, reload } = useOwnerData()
  const allAlertsQ = useApi(() => getAlerts(), [openAlerts])

  const counts = useMemo(() => {
    const c: Record<TyreStatus, number> = { ok: 0, warning: 0, critical: 0, offline: 0 }
    for (const tr of trucks ?? []) c[truckHealth(tr)]++
    return c
  }, [trucks])

  const attention = useMemo(() => {
    if (!trucks || !openAlerts) return []
    const rank = { high: 0, medium: 1, low: 2 }
    return trucks
      .flatMap((tr) => predictionsFor(tr, openAlerts).map((p) => ({ p, truck: tr })))
      .filter(({ p }) => p.risk !== 'low')
      .sort((a, b) => rank[a.p.risk] - rank[b.p.risk])
  }, [trucks, openAlerts])

  if (loading && !trucks) return <Loading what="your fleet" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!trucks) return null

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const alertsToday = (allAlertsQ.data ?? []).filter((a) => new Date(a.created_at) >= startOfToday).length
  const avoided = breakdownsAvoidedThisMonth(allAlertsQ.data ?? [])
  const moving = (shipments ?? []).filter((s) => ['in_transit', 'loading', 'delayed'].includes(s.status))
  const byId = new Map(trucks.map((tr) => [tr.id, tr]))
  const upcoming = upcomingMaintenance(trucks)

  return (
    <>
      <PageHeader title={t('owner.dashboard')} subtitle={`${trucks.length} trucks · ${counts.ok} OK, ${trucks.length - counts.ok} need a look`} />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={`Trucks ${t('status.ok')}`} value={counts.ok} icon={CheckCircle2} tone="ok" />
        <Kpi label={`Trucks ${t('status.warning')}`} value={counts.warning} icon={AlertTriangle} tone="warning" />
        <Kpi label={`Trucks ${t('status.critical')}`} value={counts.critical} icon={OctagonAlert} tone="critical" />
        <Kpi label={`Trucks ${t('status.offline')}`} value={counts.offline} icon={WifiOff} tone="offline" />
        <Kpi label="Active shipments" value={moving.length} icon={Package} />
        <Kpi label="Alerts today" value={alertsToday} icon={BellRing} />
        <Kpi label="Breakdowns avoided this month" value={avoided} icon={ShieldCheck} tone="ok" note="problems fixed in time" />
        <Kpi
          label="Estimated ₹ saved this month"
          value={rupees(avoided * AVOIDED_BREAKDOWN_RUPEES)}
          icon={IndianRupee}
          tone="ok"
          note={`estimate: ${rupees(AVOIDED_BREAKDOWN_RUPEES)} per breakdown`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        {/* Needs attention now */}
        <Card className="xl:order-2">
          <CardTitle right={<DemoTag />}>Needs attention now</CardTitle>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 size={18} aria-hidden /> Nothing urgent. All trucks look fine.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {attention.slice(0, 6).map(({ p, truck }) => (
                <AttentionRow key={p.id} p={p} truck={truck} />
              ))}
            </ul>
          )}
        </Card>

        {/* Map */}
        <Card className="xl:order-1">
          <CardTitle right={<Link to="/owner/map" className="text-sm font-semibold text-green-700 hover:text-green-500">Open live map →</Link>}>
            {t('owner.map')}
          </CardTitle>
          <Suspense fallback={<div className="flex h-72 items-center justify-center rounded-lg bg-gray-100 text-sm text-navy-700">Loading map…</div>}>
            <FleetMap trucks={trucks} className="h-72 lg:h-80" onSelect={(id) => navigate(`/owner/trucks/${id}`)} />
          </Suspense>
          <MapLegend />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle right={<DemoTag />}>Shipments in transit</CardTitle>
          {moving.length === 0 ? (
            <p className="text-sm text-navy-700">No shipments on the road.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {moving.map((s) => (
                <ShipmentRow key={s.id} s={s} truck={s.truck_id ? byId.get(s.truck_id) : undefined} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle right={<DemoTag />}>Upcoming maintenance (next 7 days)</CardTitle>
          {upcoming.length === 0 ? (
            <p className="text-sm text-navy-700">Nothing due in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((u, i) => {
                const overdue = dueText(u.date).includes('overdue')
                return (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${overdue ? 'bg-red-50 text-critical' : 'bg-green-50 text-green-700'}`}>
                      <CalendarClock size={18} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <Link to={`/owner/trucks/${u.truck.id}?tab=maintenance`} className="font-semibold hover:text-green-700">
                        {u.truck.reg_no}
                      </Link>{' '}
                      · {u.title}
                      <span className={`block text-xs ${overdue ? 'font-semibold text-critical' : 'text-navy-700'}`}>
                        {formatDate(u.date)} ({dueText(u.date)})
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function AttentionRow({ p, truck }: { p: Prediction; truck: TruckSummary }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Link to={`/owner/trucks/${truck.id}?tab=predictions`} className="font-bold hover:text-green-700">
            {truck.reg_no}
          </Link>{' '}
          - {p.issue} - <span className="font-semibold">{p.window.toLowerCase()}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <RiskBadge risk={p.risk} />
          <span className="text-xs text-navy-700">{p.action}</span>
        </div>
      </div>
      {p.needs_garage && (
        <Link
          to={bookGarageHref(p)}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500"
        >
          <Wrench size={16} aria-hidden /> Book garage
        </Link>
      )}
    </li>
  )
}

function ShipmentRow({ s, truck }: { s: Shipment; truck?: TruckSummary }) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <Link to={`/owner/shipments/${s.id}`} className="w-20 shrink-0 font-heading text-xs font-bold text-green-700 hover:text-green-500">{s.id}</Link>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">
          {s.sender.city} → {s.receiver.city}
        </span>
        <span className="block truncate text-xs text-navy-700">
          {truck ? (
            <Link to={`/owner/trucks/${truck.id}`} className="hover:text-green-700">
              {truck.reg_no}
            </Link>
          ) : (
            'No truck yet'
          )}{' '}
          · {s.goods}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs">
        {s.status === 'delayed' ? (
          <span className="inline-flex items-center gap-1 font-semibold text-critical">
            <AlertTriangle size={12} aria-hidden /> Delayed
          </span>
        ) : (
          <span className="font-semibold text-navy-900">ETA</span>
        )}
        <span className="block text-navy-700">
          {s.eta ? new Date(s.eta).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-'}
        </span>
      </span>
      {truck && <StatusBadge status={truckHealth(truck)} className="hidden sm:inline-flex" />}
    </li>
  )
}
