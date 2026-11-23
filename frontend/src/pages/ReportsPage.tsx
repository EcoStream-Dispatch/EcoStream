import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CheckCircle2, FileWarning, Info, OctagonAlert } from 'lucide-react'
import { getAlerts, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { ErrorBox, Loading } from '../components/PageState'
import { useAlertText } from '../lib/alertText'
import { useLang } from '../lib/i18n'
import { COMPLIANCE_NAME, dueState, dueText, formatDate, type DueState } from '../lib/compliance'
import type { Alert, AlertType, ComplianceKind, TruckSummary } from '../types'

/**
 * Reports: monthly alert summary and how long alerts stayed open, worked out from the
 * alerts we actually have, plus compliance reminders (permit, fitness, PUC, insurance).
 * No savings numbers: we don't measure savings yet.
 */

/** "2026-11" for an ISO time, in India time. */
const monthOf = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date(iso)).slice(0, 7)

const monthName = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/** "3 h 20 min" / "45 min" */
function duration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${min % 60} min`
  return `${Math.round(h / 24)} days`
}

export default function ReportsPage() {
  const alertsQ = useApi(() => getAlerts(), [])
  const { t: tr } = useLang()
  const trucksQ = useApi(getTrucks, [])
  const thisMonth = monthOf(new Date().toISOString())
  const [month, setMonth] = useState(thisMonth)

  // Last 3 months, newest first
  const months = useMemo(() => {
    const now = new Date()
    return [0, 1, 2].map((i) => monthOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15)).toISOString()))
  }, [])

  if ((alertsQ.loading && !alertsQ.data) || (trucksQ.loading && !trucksQ.data)) return <Loading what="reports" />
  if (alertsQ.error) return <ErrorBox message={alertsQ.error} onRetry={alertsQ.reload} />
  if (trucksQ.error) return <ErrorBox message={trucksQ.error} onRetry={trucksQ.reload} />

  const trucks = trucksQ.data ?? []
  const inMonth = (alertsQ.data ?? []).filter((a) => monthOf(a.created_at) === month)

  return (
    <>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">{tr('nav.reports')}</h1>
          <p className="mt-1 text-navy-700">{tr('reports.sub')}</p>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-navy-700">{tr('reports.month')}</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg bg-white px-3 text-base ring-1 ring-gray-300 focus:outline-none focus:ring-2 focus:ring-green-300 sm:w-56"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <AlertSummary alerts={inMonth} trucks={trucks} />
      <Compliance trucks={trucks} />

      <p className="mt-6 flex gap-2 rounded-xl bg-green-50 p-4 text-sm text-navy-700 ring-1 ring-green-500/20">
        <Info size={18} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
        {tr('reports.savingsLater')}
      </p>
    </>
  )
}

function AlertSummary({ alerts, trucks }: { alerts: Alert[]; trucks: TruckSummary[] }) {
  const { t: tr } = useLang()
  const at = useAlertText()
  const critical = alerts.filter((a) => a.severity === 'critical').length
  const open = alerts.filter((a) => !a.acknowledged_at)
  const closed = alerts.filter((a) => a.acknowledged_at)
  const now = Date.now()
  const openMs = (a: Alert) => new Date(a.acknowledged_at ?? now).getTime() - new Date(a.created_at).getTime()
  const avgClosed = closed.length ? closed.reduce((n, a) => n + openMs(a), 0) / closed.length : null

  const byType = new Map<AlertType, number>()
  for (const a of alerts) byType.set(a.type, (byType.get(a.type) ?? 0) + 1)

  return (
    <section className="mt-5" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="text-lg font-bold">
        {tr('nav.alerts')}
      </h2>
      {alerts.length === 0 ? (
        <p className="mt-2 rounded-xl bg-white p-5 text-navy-700 ring-1 ring-gray-200">No alerts in this month.</p>
      ) : (
        <>
          <ul className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={tr('reports.raised')} value={String(alerts.length)} icon={AlertTriangle} />
            <Tile label={tr('status.critical')} value={String(critical)} icon={OctagonAlert} tone={critical ? 'text-critical' : undefined} />
            <Tile label={tr('reports.stillOpen')} value={String(open.length)} icon={FileWarning} tone={open.length ? 'text-amber-800' : undefined} />
            <Tile label="Avg. time to acknowledge" value={avgClosed === null ? '—' : duration(avgClosed)} icon={CheckCircle2} small />
          </ul>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h3 className="font-bold">{tr('reports.byType')}</h3>
              <ul className="mt-2 divide-y divide-gray-100">
                {[...byType.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, n]) => (
                    <li key={type} className="flex justify-between py-2 text-sm">
                      <span>{at.title(type)}</span>
                      <span className="font-semibold">{n}</span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="min-w-0 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h3 className="font-bold">{tr('reports.byTruck')}</h3>
              <p className="text-xs text-navy-700">
                "Time open" is how long alerts stayed open before someone acknowledged them (open ones: until now). It is not
                the time the truck stood still: we don't track that yet.
              </p>
              <ul className="mt-2 divide-y divide-gray-100">
                {trucks.map((t) => {
                  const mine = alerts.filter((a) => a.truck_id === t.id)
                  const totalMs = mine.reduce((n, a) => n + openMs(a), 0)
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <Link to={`/trucks/${t.id}`} className="font-heading font-bold hover:text-green-700">
                        {t.reg_no}
                      </Link>
                      <span className="text-right text-navy-700">
                        <span className="font-semibold text-navy-900">{mine.length}</span> alerts
                        {mine.length > 0 && <> · {duration(totalMs)} open</>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

const DUE_STYLE: Record<DueState, { label: string; cls: string }> = {
  overdue: { label: 'Overdue', cls: 'bg-red-50 text-critical ring-critical/30' },
  due_soon: { label: 'Due soon', cls: 'bg-amber-50 text-amber-800 ring-warning/40' },
  ok: { label: 'OK', cls: 'bg-green-50 text-green-700 ring-green-500/30' },
}

function Compliance({ trucks }: { trucks: TruckSummary[] }) {
  const { t: tr } = useLang()
  const dueLabel = (s: DueState) => (s === 'overdue' ? tr('reports.overdue') : s === 'due_soon' ? tr('reports.dueSoon') : tr('status.ok'))
  const rows = trucks
    .flatMap((t) => (t.compliance ?? []).map((c) => ({ truck: t, ...c, state: dueState(c.due_date) })))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const urgent = rows.filter((r) => r.state !== 'ok').length

  return (
    <section className="mt-6" aria-labelledby="compliance-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="compliance-heading" className="flex items-center gap-2 text-lg font-bold">
          <CalendarClock size={20} className="text-green-700" aria-hidden /> {tr('reports.compliance')}
        </h2>
        {urgent > 0 && <span className="text-sm font-semibold text-critical">{urgent} need action</span>}
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-xl bg-white p-5 text-navy-700 ring-1 ring-gray-200">No document dates added yet.</p>
      ) : (
        <ul className="mt-2 grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li
              key={`${r.truck.id}-${r.kind}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200"
            >
              <div className="min-w-0">
                <p className="font-semibold">{COMPLIANCE_NAME[r.kind as ComplianceKind]}</p>
                <p className="text-sm text-navy-700">
                  <span className="font-heading font-bold text-navy-900">{r.truck.reg_no}</span> · {formatDate(r.due_date)}
                </p>
                <p className={`text-sm ${r.state === 'overdue' ? 'font-semibold text-critical' : 'text-navy-700'}`}>{dueText(r.due_date)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${DUE_STYLE[r.state].cls}`}>
                {dueLabel(r.state)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-navy-700">"Due soon" means within 30 days. Dates in the demo are sample dates.</p>
    </section>
  )
}

function Tile({
  label,
  value,
  icon: Icon,
  tone,
  small = false,
}: {
  label: string
  value: string
  icon: typeof AlertTriangle
  tone?: string
  small?: boolean
}) {
  return (
    <li className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className={`flex items-center justify-between gap-2 font-heading text-[11px] font-bold uppercase tracking-wider ${tone ?? 'text-navy-700'}`}>
        {label} <Icon size={16} className="shrink-0" aria-hidden />
      </p>
      <p className={`mt-1 font-heading font-extrabold ${small ? 'text-2xl' : 'text-4xl'} ${tone ?? 'text-navy-900'}`}>{value}</p>
    </li>
  )
}
