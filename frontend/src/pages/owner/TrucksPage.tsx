import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, Search } from 'lucide-react'
import { useOwnerData } from '../../hooks/useOwnerData'
import { truckExtrasFor } from '../../services/api'
import { STATUS_STYLE, truckHealth } from '../../lib/status'
import { timeAgo } from '../../lib/format'
import { AXLE_CONFIG_LABEL } from '../../lib/tyreLayout'
import { Card, DemoTag, PageHeader, PlanBadge, formatDate } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import StatusBadge from '../../components/StatusBadge'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { PlanId } from '../../data/plans'
import type { Shipment, TruckSummary, TyreStatus } from '../../types'

/*
 * Trucks list (docs/WEBSITE_SPEC.md section 2.3): registration, make/model, plan,
 * driver, current shipment, health, last seen, next service. Filters + CSV export.
 * Plan, driver, shipment and next service are sample data for now.
 */

type Row = {
  truck: TruckSummary
  health: TyreStatus
  plan: PlanId
  driver: string
  shipment: Shipment | undefined
  nextService: { date: string; what: string }
}

export default function TrucksPage() {
  const { t } = useLanguage()
  const { trucks, shipments, loading, error, reload } = useOwnerData()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<TyreStatus | 'all'>('all')
  const [plan, setPlan] = useState<PlanId | 'all'>('all')

  const rows: Row[] = useMemo(() => {
    const shipmentOf = new Map((shipments ?? []).filter((s) => s.truck_id).map((s) => [s.truck_id!, s]))
    return (trucks ?? []).map((truck) => {
      const x = truckExtrasFor(truck)
      return {
        truck,
        health: truckHealth(truck),
        plan: x.plan,
        driver: x.driver?.name ?? '-',
        shipment: shipmentOf.get(truck.id),
        nextService: x.nextService,
      }
    })
  }, [trucks, shipments])

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const filtered = rows.filter(
    (r) =>
      (status === 'all' || r.health === status) &&
      (plan === 'all' || r.plan === plan) &&
      (!q || norm(`${r.truck.reg_no} ${r.truck.make} ${r.truck.model} ${r.driver}`).includes(norm(q))),
  )

  if (loading && !trucks) return <Loading what="trucks" />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  return (
    <>
      <PageHeader
        title={t('owner.trucks')}
        subtitle={`${filtered.length} of ${rows.length} trucks`}
        right={
          <button
            onClick={() => exportCsv(filtered)}
            className="inline-flex items-center gap-2 rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-sm font-semibold hover:bg-green-50"
          >
            <Download size={16} aria-hidden /> Export CSV
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <span className="sr-only">Filter trucks</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-700" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Number, model or driver"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-green-300 sm:text-sm"
          />
        </label>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TyreStatus | 'all')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          <option value="all">All statuses</option>
          {(['ok', 'warning', 'critical', 'offline'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select
          aria-label="Plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanId | 'all')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          <option value="all">All plans</option>
          <option value="lite">Lite</option>
          <option value="pro">Pro</option>
          <option value="fleet">Fleet</option>
        </select>
        <DemoTag />
      </div>

      {/* Phones: cards */}
      <ul className="space-y-3 md:hidden">
        {filtered.map((r) => (
          <li key={r.truck.id}>
            <Link to={`/owner/trucks/${r.truck.id}`} className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 hover:ring-green-300">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading text-lg font-bold">{r.truck.reg_no}</p>
                  <p className="text-sm text-navy-700">
                    {r.truck.make} {r.truck.model} · <PlanBadge plan={r.plan} />
                  </p>
                </div>
                <StatusBadge status={r.health} />
              </div>
              <p className="mt-2 text-sm">
                {r.driver} · {r.shipment ? `${r.shipment.id} to ${r.shipment.receiver.city}` : 'No shipment'}
              </p>
              <p className="mt-1 flex items-center justify-between text-xs text-navy-700">
                <span>
                  Last seen {timeAgo(r.truck.last_seen_at)} · service {formatDate(r.nextService.date)}
                </span>
                <ChevronRight size={16} aria-hidden />
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Wider screens: table */}
      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-navy-700">
            <tr>
              {['Registration', 'Make / model', 'Plan', 'Driver', 'Current shipment', 'Health', 'Last seen', 'Next service'].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <tr key={r.truck.id} className="hover:bg-green-50/60">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link to={`/owner/trucks/${r.truck.id}`} className="font-heading font-bold text-navy-900 hover:text-green-700">
                    {r.truck.reg_no}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {r.truck.make} {r.truck.model}
                  <span className="block text-xs text-navy-700">{AXLE_CONFIG_LABEL[r.truck.axle_config]}</span>
                </td>
                <td className="px-4 py-3">
                  <PlanBadge plan={r.plan} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">{r.driver}</td>
                <td className="px-4 py-3">
                  {r.shipment ? (
                    <>
                      {r.shipment.id}
                      <span className="block text-xs text-navy-700">
                        {r.shipment.sender.city} → {r.shipment.receiver.city}
                      </span>
                    </>
                  ) : (
                    <span className="text-navy-700">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.health} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">{timeAgo(r.truck.last_seen_at)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {formatDate(r.nextService.date)}
                  <span className="block text-xs text-navy-700">{r.nextService.what}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-navy-700">
                  No trucks match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  )
}

/** Download the visible rows as a CSV file (opens in Excel / Google Sheets). */
function exportCsv(rows: Row[]) {
  const header = ['Registration', 'Make', 'Model', 'Wheels', 'Plan', 'Driver', 'Shipment', 'Health', 'Last seen (UTC)', 'Next service', 'Service work']
  const lines = rows.map((r) => [
    r.truck.reg_no,
    r.truck.make,
    r.truck.model,
    r.truck.axle_config,
    r.plan.toUpperCase(),
    r.driver,
    r.shipment?.id ?? '',
    STATUS_STYLE[r.health].label,
    r.truck.last_seen_at ?? '',
    r.nextService.date,
    r.nextService.what,
  ])
  const csv = [header, ...lines].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `ecostream-trucks-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
