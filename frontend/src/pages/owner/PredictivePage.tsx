import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Wrench } from 'lucide-react'
import { useOwnerData } from '../../hooks/useOwnerData'
import { predictionsFor, bookGarageHref } from '../../services/api'
import { Card, CardTitle, DemoTag, PageHeader, RiskBadge, rupees } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { Prediction, TruckSummary } from '../../types'

/*
 * Predictive Maintenance (docs/WEBSITE_SPEC.md section 2.5): fleet-wide risk ranking
 * (truck, component, issue, risk, time window, cost if ignored vs cost to fix now, action),
 * filter by component, and a simple "this week" plan.
 * Tyre predictions come from live alerts; the rest and all costs are sample data.
 */

const COMPONENTS: Prediction['component'][] = ['Tyres', 'Engine', 'Brakes', 'Power', 'Cargo']
type Row = { p: Prediction; truck: TruckSummary }

/** Which day this week to do it: high risk today, medium in 1-2 days, low later in the week. */
function planDay(p: Prediction): number {
  if (p.risk === 'high') return 0
  if (p.risk === 'medium') return /within 1 day|today|check today/i.test(p.window) ? 0 : 1
  return 4
}

export default function PredictivePage() {
  const { t } = useLanguage()
  const { trucks, openAlerts, loading, error, reload } = useOwnerData()
  const [component, setComponent] = useState<Prediction['component'] | 'all'>('all')

  const rows: Row[] = useMemo(() => {
    if (!trucks || !openAlerts) return []
    const rank = { high: 0, medium: 1, low: 2 }
    return trucks
      .flatMap((truck) => predictionsFor(truck, openAlerts).map((p) => ({ p, truck })))
      .sort((a, b) => rank[a.p.risk] - rank[b.p.risk] || b.p.cost_if_ignored - a.p.cost_if_ignored)
  }, [trucks, openAlerts])

  if (loading && !trucks) return <Loading what="predictions" />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const shown = rows.filter((r) => component === 'all' || r.p.component === component)
  const atRisk = shown.reduce((sum, r) => sum + r.p.cost_if_ignored, 0)
  const toFix = shown.reduce((sum, r) => sum + r.p.cost_now, 0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <>
      <PageHeader
        title={t('owner.predictive')}
        subtitle={`${shown.length} predicted problems · fix now about ${rupees(toFix)}, if ignored up to ${rupees(atRisk)}`}
        right={<DemoTag />}
      />

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Component">
        {(['all', ...COMPONENTS] as const).map((c) => (
          <button
            key={c}
            onClick={() => setComponent(c)}
            aria-pressed={component === c}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition ${
              component === c ? 'bg-green-700 text-white ring-green-700' : 'bg-white text-navy-700 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {c === 'all' ? 'All components' : c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* Ranking */}
        <Card className="p-0">
          {/* Phones: cards */}
          <ul className="divide-y divide-gray-100 md:hidden">
            {shown.map(({ p, truck }, i) => (
              <li key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-heading font-bold">#{i + 1}</span>{' '}
                    <Link to={`/owner/trucks/${truck.id}?tab=predictions`} className="font-bold hover:text-green-700">
                      {truck.reg_no}
                    </Link>{' '}
                    · {p.component}
                  </p>
                  <RiskBadge risk={p.risk} />
                </div>
                <p className="mt-1 font-semibold">{p.issue}</p>
                <p className="text-sm">{p.window}</p>
                <p className="mt-1 text-xs text-navy-700">
                  Fix now {rupees(p.cost_now)} · if ignored {rupees(p.cost_if_ignored)}
                </p>
                <ActionLink p={p} />
              </li>
            ))}
          </ul>
          {/* Wider screens: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-navy-700">
                <tr>
                  {['#', 'Truck', 'Component', 'Predicted issue', 'Risk', 'Time window', 'If ignored', 'Fix now', 'Action'].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map(({ p, truck }, i) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-3 py-3 font-heading font-bold">{i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <Link to={`/owner/trucks/${truck.id}?tab=predictions`} className="font-semibold hover:text-green-700">
                        {truck.reg_no}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{p.component}</td>
                    <td className="px-3 py-3">
                      {p.issue}
                      <span className="block text-xs text-navy-700">{p.action}</span>
                    </td>
                    <td className="px-3 py-3">
                      <RiskBadge risk={p.risk} />
                    </td>
                    <td className="px-3 py-3 font-semibold">{p.window}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-critical">{rupees(p.cost_if_ignored)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-green-700">{rupees(p.cost_now)}</td>
                    <td className="px-3 py-3">
                      <ActionLink p={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && <p className="p-4 text-sm text-navy-700">Nothing predicted for this component.</p>}
        </Card>

        {/* This week */}
        <Card>
          <CardTitle>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={16} aria-hidden /> This week’s plan
            </span>
          </CardTitle>
          <ol className="space-y-3">
            {days.map((d, i) => {
              const today = shown.filter((r) => planDay(r.p) === i)
              return (
                <li key={i}>
                  <p className="text-xs font-bold uppercase tracking-wide text-navy-700">
                    {i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  {today.length === 0 ? (
                    <p className="text-sm text-navy-700/70">Nothing planned</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {today.map(({ p, truck }) => (
                        <li key={p.id} className="text-sm">
                          <span className="font-semibold">{truck.reg_no.slice(-4)}</span> · {p.issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      </div>
    </>
  )
}

function ActionLink({ p }: { p: Prediction }) {
  if (!p.needs_garage) return <span className="mt-2 block text-xs text-navy-700">No garage needed</span>
  return (
    <Link
      to={bookGarageHref(p)}
      className="mt-2 inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
    >
      <Wrench size={14} aria-hidden /> Book garage
    </Link>
  )
}
