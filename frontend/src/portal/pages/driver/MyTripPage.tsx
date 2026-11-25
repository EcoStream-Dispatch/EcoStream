import { Suspense, lazy, useState } from 'react'
import { CheckCircle2, CircleDot, Clock, Flag, Package, Phone, Play } from 'lucide-react'
import { setTripStatus, shipmentRoute } from '../../services/api'
import { CORRIDOR, kmAlong } from '../../lib/route'
import { shortTime } from '../../components/owner/ui'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { Place } from '../../types'
import { useDriver } from './DriverLayout'

const FleetMap = lazy(() => import('../../components/owner/FleetMap'))

/*
 * Driver: My trip (docs/WEBSITE_SPEC.md section 3.1). Sender and receiver with call buttons,
 * goods, pickup and delivery times, route map with the next town and ETA, Start trip / Reached.
 */
export default function MyTripPage() {
  const { t } = useLanguage()
  const { home, reload } = useDriver()
  const { shipment: s, truck } = home
  const [busy, setBusy] = useState(false)

  if (!s)
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
        <CheckCircle2 size={48} className="mx-auto text-green-700" aria-hidden />
        <p className="mt-3 text-xl font-bold">No trip right now</p>
        <p className="mt-1 text-navy-700">Your owner will assign the next trip here.</p>
      </div>
    )

  const info = shipmentRoute(s, truck)
  const next = info.towns
    .map((name) => ({ name, km: kmAlong(info.route, CORRIDOR.find((c) => c.name === name)!.at) }))
    .find((x) => x.km > info.doneKm + 2)
  const moving = s.status === 'in_transit' || s.status === 'delayed'
  const eta = moving ? new Date(Date.now() + (info.leftKm / 45) * 3_600_000).toISOString() : s.eta

  async function change(status: 'in_transit' | 'delivered') {
    setBusy(true)
    await setTripStatus(s!.id, status)
    setBusy(false)
    reload()
  }

  return (
    <div className="space-y-4">
      {/* Next town + ETA: the two things a driver looks for */}
      <section className="rounded-2xl bg-navy-900 p-4 text-white">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-300">{t('driver.next')}</p>
        <p className="font-heading text-3xl font-extrabold">
          {s.status === 'delivered' ? s.receiver.city : next ? next.name : s.receiver.city}
        </p>
        {moving && next && <p className="text-lg">{Math.round(next.km - info.doneKm)} km</p>}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">{t('driver.eta')}</p>
            <p className="text-2xl font-bold">{shortTime(eta)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">{t('driver.kmLeft')}</p>
            <p className="text-2xl font-bold">{Math.round(info.leftKm)}</p>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="flex h-56 items-center justify-center rounded-2xl bg-gray-100">Loading map…</div>}>
        <FleetMap trucks={info.truckAt ? [truck] : []} route={info.route} selectedId={truck.id} className="h-56" />
      </Suspense>

      <PlaceCard icon={CircleDot} label={t('driver.from')} place={s.sender} time={shortTime(s.pickup_at)} />
      <PlaceCard icon={Flag} label={t('driver.to')} place={s.receiver} time={shortTime(eta)} />

      <section className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <Package size={28} className="shrink-0 text-green-700" aria-hidden />
        <div>
          <p className="text-lg font-bold">{s.goods}</p>
          <p className="text-navy-700">
            {s.weight_t} t · {s.id}
          </p>
        </div>
      </section>

      {/* One big action */}
      {s.status === 'scheduled' || s.status === 'loading' ? (
        <button onClick={() => change('in_transit')} disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-green-700 py-5 text-2xl font-bold text-white active:bg-green-500 disabled:opacity-60">
          <Play size={28} aria-hidden /> {t('driver.startTrip')}
        </button>
      ) : moving ? (
        <button onClick={() => change('delivered')} disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-green-700 py-5 text-2xl font-bold text-white active:bg-green-500 disabled:opacity-60">
          <CheckCircle2 size={28} aria-hidden /> {t('driver.reached')}
        </button>
      ) : (
        <p role="status" className="flex items-center justify-center gap-2 rounded-2xl bg-green-50 py-5 text-xl font-bold text-green-700 ring-1 ring-green-500/30">
          <CheckCircle2 size={26} aria-hidden /> Delivered. Thank you!
        </p>
      )}
      <p className="text-center text-xs text-navy-700">Demo: the owner sees this change in this browser only.</p>
    </div>
  )
}

function PlaceCard({ icon: Icon, label, place, time }: { icon: typeof Flag; label: string; place: Place; time: string }) {
  const { t } = useLanguage()
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-navy-700">
        <Icon size={18} className="text-green-700" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-xl font-bold">{place.name}</p>
      <p className="text-navy-700">{place.address}</p>
      <p className="mt-1 flex items-center gap-1 text-sm text-navy-700">
        <Clock size={14} aria-hidden /> {time}
      </p>
      <a
        href={`tel:${place.phone.replace(/\s/g, '')}`}
        className="mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-green-700 py-3 text-lg font-bold text-green-700 active:bg-green-50"
      >
        <Phone size={22} aria-hidden /> {t('driver.call')} {place.contact}
      </a>
    </section>
  )
}
