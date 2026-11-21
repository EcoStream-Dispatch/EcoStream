import { Suspense, lazy } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CircleDot, FileText, Phone, Route as RouteIcon, Snowflake, Truck } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { getShipperShipment, shipmentEvents, shipmentRoute } from '../../services/api'
import { DemoTag, ShipmentBadge, Sparkline, shortTime } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import StatusBadge from '../../components/StatusBadge'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { ShipmentEvent } from '../../types'
import { ConditionBadge } from './ShipperLayout'

const FleetMap = lazy(() => import('../../components/owner/FleetMap'))

/*
 * Shipper: shipment tracking (docs/WEBSITE_SPEC.md section 4.2): live map of the truck,
 * ETA, distance left, timeline, driver and truck details with a contact button,
 * "Truck condition: Good", and cargo temperature for cold-chain loads.
 * Shippers see plain words about the truck, not the owner's technical alerts.
 * This is also where the owner's "share tracking link" lands. Sample data.
 */

const ICON: Record<ShipmentEvent['kind'], typeof Truck> = {
  created: CircleDot,
  picked_up: Truck,
  checkpoint: RouteIcon,
  alert: CircleDot,
  delivered: CheckCircle2,
}

export default function TrackShipmentPage() {
  const { id = '' } = useParams()
  const { t } = useLanguage()
  const q = useApi(() => getShipperShipment(id), [id])
  if (q.loading && !q.data) return <Loading what="shipment" />
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />
  if (!q.data)
    return (
      <p className="py-10 text-center">
        Shipment not found.{' '}
        <Link to="/shipper" className="font-semibold text-green-700">
          {t('shipper.shipments')}
        </Link>
      </p>
    )

  const { shipment: s, truck, driver, condition, cargoTemp } = q.data
  const info = shipmentRoute(s, truck ?? undefined)
  const moving = s.status === 'in_transit' || s.status === 'delayed'
  const eta = moving ? new Date(Date.now() + (info.leftKm / 45) * 3_600_000).toISOString() : s.eta
  // Shippers see the journey, not the owner's technical alerts.
  const events = shipmentEvents(s, truck ?? undefined, []).filter((e) => e.kind !== 'alert')

  return (
    <>
      <Link to="/shipper" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
        <ArrowLeft size={16} aria-hidden /> {t('shipper.shipments')}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {s.sender.city} → {s.receiver.city}
          </h1>
          <p className="text-sm text-navy-700">
            {s.id} · {s.goods} · {s.weight_t} t
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShipmentBadge status={s.status} />
          <DemoTag />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Box label={s.status === 'delivered' ? 'Delivered' : 'ETA'} value={shortTime(eta)} />
        <Box label="Distance left" value={`${Math.round(info.leftKm)} km`} />
        <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200 sm:col-span-1">
          <p className="text-xs font-semibold text-navy-700">{t('shipper.condition')}</p>
          <div className="mt-1">
            <ConditionBadge c={condition} />
          </div>
        </div>
      </div>

      {cargoTemp && (
        <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold">
              <Snowflake size={18} className="text-navy-700" aria-hidden /> Cargo temperature
            </h2>
            <StatusBadge status={cargoTemp.status} />
          </div>
          <p className="mt-1 font-heading text-3xl font-extrabold">{cargoTemp.value}</p>
          <p className="text-sm text-navy-700">
            {cargoTemp.detail} · should stay {cargoTemp.normal}
          </p>
          {cargoTemp.series && <Sparkline values={cargoTemp.series} className="mt-2 h-10" />}
          <p className="text-xs text-navy-700">Last 24 hours</p>
        </section>
      )}

      <div className="mt-4 overflow-hidden rounded-xl shadow-sm ring-1 ring-gray-200">
        <Suspense fallback={<div className="flex h-64 items-center justify-center bg-gray-100">Loading map…</div>}>
          <FleetMap trucks={truck && info.truckAt ? [truck] : []} route={info.route} selectedId={truck?.id} className="h-64 sm:h-80" />
        </Suspense>
      </div>

      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700">Driver and truck</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">{driver?.name ?? 'Driver not assigned yet'}</p>
            <p className="text-sm text-navy-700">{truck ? `${truck.reg_no} · ${truck.make} ${truck.model}` : 'Truck not assigned yet'}</p>
          </div>
          {driver && (
            <a href={`tel:${driver.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white hover:bg-green-500">
              <Phone size={16} aria-hidden /> Call driver
            </a>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-700">Timeline</h2>
        <ol className="relative ml-2 border-l-2 border-gray-200">
          {events.map((e, i) => {
            const Icon = ICON[e.kind]
            return (
              <li key={i} className="mb-4 ml-5 last:mb-0">
                <span className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-green-700 ring-4 ring-white">
                  <Icon size={14} aria-hidden />
                </span>
                <p className="text-sm font-semibold">{e.text}</p>
                <p className="text-xs text-navy-700">{shortTime(e.ts)}</p>
              </li>
            )
          })}
        </ol>
      </section>

      {s.status === 'delivered' && (
        <Link to="/shipper/deliveries" className="mt-4 inline-flex items-center gap-2 font-semibold text-green-700">
          <FileText size={18} aria-hidden /> Proof of delivery and invoice
        </Link>
      )}
    </>
  )
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
      <p className="text-xs font-semibold text-navy-700">{label}</p>
      <p className="font-heading text-lg font-extrabold">{value}</p>
    </div>
  )
}
