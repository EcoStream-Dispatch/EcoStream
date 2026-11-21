import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useOwnerData } from '../../hooks/useOwnerData'
import { getDrivers } from '../../services/api'
import { Card, DemoTag, PageHeader, SHIPMENT_STATUSES, ShipmentBadge, shipmentLabel, shortTime } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { ShipmentStatus } from '../../types'

/*
 * Shipments (docs/WEBSITE_SPEC.md section 2.7): ID, sender, receiver, goods, truck,
 * driver, status (Scheduled / Loading / In transit / Delivered / Delayed), ETA.
 * Sample data: there is no shipments backend yet.
 */
export default function ShipmentsPage() {
  const { t } = useLanguage()
  const { trucks, shipments, loading, error, reload } = useOwnerData()
  const driversQ = useApi(() => (trucks ? getDrivers(trucks) : Promise.resolve([])), [trucks])
  const [status, setStatus] = useState<ShipmentStatus | 'all'>('all')

  if ((loading && !trucks) || !shipments) return <Loading what="shipments" />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const truckOf = new Map((trucks ?? []).map((tr) => [tr.id, tr]))
  const driverOf = new Map((driversQ.data ?? []).map((d) => [d.id, d]))
  const shown = shipments.filter((s) => status === 'all' || s.status === status)

  return (
    <>
      <PageHeader
        title={t('owner.shipments')}
        subtitle={`${shown.length} shipments`}
        right={
          <Link to="/owner/shipments/new" className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white hover:bg-green-500">
            <Plus size={18} aria-hidden /> Create shipment
          </Link>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ShipmentStatus | 'all')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          <option value="all">All statuses</option>
          {SHIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {shipmentLabel(s)}
            </option>
          ))}
        </select>
        <DemoTag />
      </div>

      {/* Phones: cards */}
      <ul className="space-y-3 md:hidden">
        {shown.map((s) => (
          <li key={s.id}>
            <Link to={`/owner/shipments/${s.id}`} className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading font-bold">{s.id}</span>
                <ShipmentBadge status={s.status} />
              </div>
              <p className="mt-1 font-semibold">
                {s.sender.city} → {s.receiver.city}
              </p>
              <p className="text-sm text-navy-700">
                {s.goods} · {s.weight_t} t
              </p>
              <p className="mt-1 flex items-center justify-between text-xs text-navy-700">
                <span>
                  {(s.truck_id && truckOf.get(s.truck_id)?.reg_no) || 'No truck'} · ETA {shortTime(s.eta)}
                </span>
                <ChevronRight size={16} aria-hidden />
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-navy-700">
            <tr>
              {['ID', 'Sender', 'Receiver', 'Goods', 'Truck', 'Driver', 'Status', 'ETA'].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((s) => (
              <tr key={s.id} className="hover:bg-green-50/60">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link to={`/owner/shipments/${s.id}`} className="font-heading font-bold hover:text-green-700">
                    {s.id}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {s.sender.name}
                  <span className="block text-xs text-navy-700">{s.sender.city}</span>
                </td>
                <td className="px-4 py-3">
                  {s.receiver.name}
                  <span className="block text-xs text-navy-700">{s.receiver.city}</span>
                </td>
                <td className="px-4 py-3">
                  {s.goods}
                  <span className="block text-xs text-navy-700">{s.weight_t} t</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{(s.truck_id && truckOf.get(s.truck_id)?.reg_no) || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3">{(s.driver_id && driverOf.get(s.driver_id)?.name) || '-'}</td>
                <td className="px-4 py-3">
                  <ShipmentBadge status={s.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">{shortTime(s.eta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
