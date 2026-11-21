import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Hourglass } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { getShipperShipments } from '../../services/api'
import { DemoTag, ShipmentBadge, formatDate, shortTime } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'
import { ConditionBadge } from './ShipperLayout'

/*
 * Shipper: My shipments (docs/WEBSITE_SPEC.md section 4.1): list with status and ETA,
 * plus shipment requests waiting for the transporter. Sample data.
 */
export default function MyShipmentsPage() {
  const { t } = useLanguage()
  const q = useApi(getShipperShipments, [])
  if (q.loading && !q.data) return <Loading what="shipments" />
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />
  const { shipper, items, requests } = q.data!
  const waiting = requests.filter((r) => r.status === 'waiting')

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('shipper.shipments')}</h1>
          <p className="text-sm text-navy-700">{shipper}</p>
        </div>
        <DemoTag />
      </div>

      {waiting.length > 0 && (
        <section className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700">Requests</h2>
          <ul className="mt-2 divide-y divide-gray-100">
            {waiting.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">
                    {r.pickup_city} → {r.drop_city}
                  </span>
                  <span className="block text-xs text-navy-700">
                    {r.id} · {r.goods}, {r.weight_t} t · {formatDate(r.date)}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-navy-700 ring-1 ring-gray-300">
                  <Hourglass size={12} aria-hidden /> Waiting for transporter
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-3">
        {items.map(({ shipment: s, condition }) => (
          <li key={s.id}>
            <Link to={`/shipper/track/${s.id}`} className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 hover:ring-green-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-heading font-bold">{s.id}</span>
                <ShipmentBadge status={s.status} />
              </div>
              <p className="mt-1 text-lg font-bold">
                {s.sender.city} → {s.receiver.city}
              </p>
              <p className="text-sm text-navy-700">
                {s.goods} · {s.weight_t} t
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} aria-hidden />
                  {s.status === 'delivered' ? `Delivered ${shortTime(s.eta)}` : `ETA ${shortTime(s.eta)}`}
                </span>
                {s.status !== 'delivered' && s.status !== 'scheduled' && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    {t('shipper.condition')}: <ConditionBadge c={condition} />
                  </span>
                )}
              </div>
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-green-700">
                {t('shipper.track')} <ArrowRight size={14} aria-hidden />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
