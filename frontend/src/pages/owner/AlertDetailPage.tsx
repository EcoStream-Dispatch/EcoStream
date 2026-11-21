import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CalendarCheck, CheckCheck, CheckCircle2, Clock, MapPin, Phone, Share2, Star, Timer } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useLiveEvents, useThrottled } from '../../services/live'
import {
  ackAlert,
  bookGarage,
  garageInfo,
  getAlerts,
  getNearestGarages,
  getTrucks,
  priceFor,
  resolveAlert,
  truckExtrasFor,
  tyrePredictions,
} from '../../services/api'
import { ALERT_TITLE, formatAlertValue } from '../../lib/status'
import { formatDateTimeIST, timeAgo } from '../../lib/format'
import { positionName } from '../../lib/tyreLayout'
import { placeName } from '../../lib/route'
import { Card, CardTitle, DemoTag, RiskBadge, rupees } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import StatusBadge from '../../components/StatusBadge'
import { useLanguage } from '../../i18n/LanguageProvider'
import { alertState } from '../AlertsPage'
import type { Alert, Booking, NearbyGarage, TruckSummary } from '../../types'

/*
 * Alert detail (docs/WEBSITE_SPEC.md section 2.6): countdown ("unsafe in ~3 h"),
 * what to do, 3 nearest open verified garages (distance, open 24x7 / open till,
 * price estimate, rating, Call, Book slot), Share with driver, Mark resolved.
 * Flow from the spec: Dashboard -> Truck -> Alert -> Garage booked.
 *
 * Alert, truck and garages are real API data. Ratings, prices and bookings are sample data.
 */

const STEPS: Record<Alert['type'], string[]> = {
  slow_leak: ['Tell the driver to slow down and stop at the garage below.', 'Check for a nail, cut or a loose valve.', 'Re-inflate to the recommended pressure after the repair.'],
  low_pressure: ['Inflate the tyre to the recommended pressure at the next stop.', 'If it drops again within a day, get it checked for a leak.'],
  critical_pressure: ['Stop as soon as it is safe. Do not drive far on this tyre.', 'Change to the spare or call the nearest garage below.', 'Check the dual partner tyre too: it has been carrying extra load.'],
  high_temp: ['Pressure is normal, so this is heat, not a leak.', 'Check for a dragging brake or a failing wheel bearing.', 'Let the wheel cool before touching it.'],
  sensor_offline: ['The tyre may be fine: the sensor stopped reporting.', 'Check the sensor battery or signal at the next stop.'],
}

export default function AlertDetailPage() {
  const { id = '' } = useParams()
  const { t } = useLanguage()
  const alertsQ = useApi(() => getAlerts(), [id])
  const trucksQ = useApi(getTrucks, [])
  const refresh = useThrottled(alertsQ.reload, 1000)
  useLiveEvents({ onAlert: (a) => a.id === id && refresh() })

  const alert = alertsQ.data?.find((a) => a.id === id)
  const truck = trucksQ.data?.find((tr) => tr.id === alert?.truck_id)

  if ((alertsQ.loading && !alertsQ.data) || (trucksQ.loading && !trucksQ.data)) return <Loading what="alert" />
  if (alertsQ.error) return <ErrorBox message={alertsQ.error} onRetry={alertsQ.reload} />
  if (!alert)
    return (
      <p className="py-10 text-center">
        Alert not found.{' '}
        <Link to="/owner/alerts" className="font-semibold text-green-700">
          Back to alerts
        </Link>
      </p>
    )

  const tyre = truck?.tyres.find((ty) => ty.id === alert.tyre_id)
  const state = alertState(alert)
  const prediction = truck ? tyrePredictions(truck, [alert])[0] : undefined
  const where = truck?.lat != null && truck.lon != null ? placeName([truck.lat, truck.lon]) : null

  return (
    <>
      <Link to="/owner/alerts" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
        <ArrowLeft size={16} aria-hidden /> {t('alerts.title')}
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{ALERT_TITLE[alert.type]}</h1>
          <p className="text-sm">
            {truck ? (
              <Link to={`/owner/trucks/${truck.id}`} className="font-semibold text-green-700 hover:text-green-500">
                {truck.reg_no}
              </Link>
            ) : (
              'Unknown truck'
            )}
            {tyre && ` · ${tyre.position} (${positionName(tyre.position)})`} · {formatAlertValue(alert.type, alert.value)}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-navy-700">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} aria-hidden /> {timeAgo(alert.created_at)} ({formatDateTimeIST(alert.created_at)} IST)
            </span>
            {where && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden /> {where}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={alert.severity} className="text-sm" />
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-navy-700">{state}</span>
        </div>
      </div>

      {/* Countdown first: the owner should understand the problem at a glance */}
      {prediction && state !== 'resolved' && (
        <Card className={`mt-4 ${prediction.risk === 'high' ? 'ring-2 ring-critical/40' : ''}`}>
          <div className="flex flex-wrap items-center gap-3">
            <Timer size={32} className={prediction.risk === 'high' ? 'text-critical' : 'text-warning'} aria-hidden />
            <p className="font-heading text-2xl font-extrabold">{prediction.window}</p>
            <RiskBadge risk={prediction.risk} />
          </div>
          <p className="mt-2 text-sm text-navy-700">{alert.message}</p>
        </Card>
      )}

      {/* Then the garages (to act on it), then what to do and the other actions */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {state !== 'resolved' && truck && <Garages alert={alert} truck={truck} />}
        {state === 'resolved' && (
          <Card>
            <p className="flex items-center gap-2 font-semibold text-green-700">
              <CheckCircle2 size={20} aria-hidden /> Resolved {alert.resolved_at ? timeAgo(alert.resolved_at) : ''}
            </p>
          </Card>
        )}
        <div className="space-y-4">
          <Card>
            <CardTitle>{t('alerts.whatToDo')}</CardTitle>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {STEPS[alert.type].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Card>
          {truck && <Actions alert={alert} truck={truck} where={where} onChanged={alertsQ.reload} />}
        </div>
      </div>
    </>
  )
}

/** Acknowledge, Share with driver, Mark resolved. */
function Actions({ alert, truck, where, onChanged }: { alert: Alert; truck: TruckSummary; where: string | null; onChanged: () => void }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const driver = truckExtrasFor(truck).driver
  const state = alertState(alert)

  async function run(what: string, fn: () => Promise<unknown>) {
    setBusy(what)
    setNote(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function share() {
    const text = `EcoStream alert for ${truck.reg_no}: ${ALERT_TITLE[alert.type]} (${formatAlertValue(alert.type, alert.value)}). ${STEPS[alert.type][0]}${where ? ` Truck is ${where}.` : ''}`
    try {
      if (navigator.share) await navigator.share({ title: 'EcoStream alert', text })
      else {
        await navigator.clipboard.writeText(text)
        setNote(`Message copied. Paste it to ${driver ? `${driver.name} (${driver.phone})` : 'the driver'} on WhatsApp or SMS.`)
      }
    } catch {
      setNote('Could not share from this browser. Copy the alert text by hand.')
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {state === 'open' && (
          <button
            onClick={() => run('ack', () => ackAlert(alert.id))}
            disabled={!!busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-900/20 px-4 py-2.5 text-sm font-semibold hover:bg-green-50 disabled:opacity-50"
          >
            <CheckCheck size={16} aria-hidden /> {busy === 'ack' ? 'Saving…' : t('alerts.acknowledge')}
          </button>
        )}
        <button
          onClick={share}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-900/20 px-4 py-2.5 text-sm font-semibold hover:bg-green-50"
        >
          <Share2 size={16} aria-hidden /> {t('alerts.share')}
        </button>
        {state !== 'resolved' && (
          <button
            onClick={() => run('resolve', () => resolveAlert(alert.id))}
            disabled={!!busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            <CheckCircle2 size={16} aria-hidden /> {busy === 'resolve' ? 'Saving…' : t('alerts.resolve')}
          </button>
        )}
      </div>
      {note && (
        <p role="status" className="mt-2 text-sm text-navy-700">
          {note}
        </p>
      )}
    </Card>
  )
}

/** 3 nearest open garages with price, rating, Call and Book slot. */
function Garages({ alert, truck }: { alert: Alert; truck: TruckSummary }) {
  const { t } = useLanguage()
  const q = useApi(
    () => (truck.lat == null || truck.lon == null ? Promise.resolve([] as NearbyGarage[]) : getNearestGarages(truck.lat, truck.lon, 'tyre')),
    [truck.lat, truck.lon],
  )
  const [booked, setBooked] = useState<Booking | null>(null)
  const price = priceFor(alert.type)

  return (
    <Card>
      <CardTitle right={<DemoTag />}>{t('alerts.garages')}</CardTitle>
      {booked ? (
        <div role="status" className="rounded-lg bg-green-50 p-4 ring-1 ring-green-500/30">
          <p className="flex items-center gap-2 text-lg font-bold text-green-700">
            <CalendarCheck size={22} aria-hidden /> Garage booked
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">{booked.garage_name}</span>, {formatDateTimeIST(booked.slot)} IST · {booked.what}
          </p>
          <p className="mt-1 text-xs text-navy-700">Booking {booked.id}. Demo only: the garage was not really contacted.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`tel:${booked.garage_phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white">
              <Phone size={16} aria-hidden /> Call garage
            </a>
            <Link to="/owner/garages" className="inline-flex items-center rounded-lg border border-navy-900/20 px-3 py-2 text-sm font-semibold">
              My bookings
            </Link>
          </div>
        </div>
      ) : truck.lat == null ? (
        <p className="text-sm text-navy-700">Truck location unknown.</p>
      ) : q.loading && !q.data ? (
        <p className="text-sm text-navy-700">Finding garages…</p>
      ) : q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data?.length ? (
        <p className="text-sm text-navy-700">No open tyre garages found nearby.</p>
      ) : (
        <ul className="space-y-3">
          {q.data.map((g) => (
            <GarageItem key={g.id} g={g} price={price} onBooked={setBooked} alert={alert} truck={truck} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-navy-700">Distance is a straight line from the truck’s last position, not road distance.</p>
    </Card>
  )
}

function GarageItem({
  g,
  price,
  alert,
  truck,
  onBooked,
}: {
  g: NearbyGarage
  price: { what: string; from: number; to: number }
  alert: Alert
  truck: TruckSummary
  onBooked: (b: Booking) => void
}) {
  const { t } = useLanguage()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const info = garageInfo(g.id)
  // Next three slots: 1, 2 and 3 hours from now, rounded to the half hour.
  const slots = [1, 2, 3].map((h) => {
    const d = new Date(Date.now() + h * 3_600_000)
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
    return d.toISOString()
  })

  async function book(slot: string) {
    setBusy(true)
    const trucks = await getTrucks()
    onBooked(await bookGarage(trucks, { truck_id: truck.id, alert_id: alert.id, garage: g, slot, what: price.what }))
  }

  return (
    <li className="rounded-lg p-3 ring-1 ring-gray-200">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-semibold">
            <span className="truncate">{g.name}</span>
            {g.verified && <BadgeCheck size={16} className="shrink-0 text-green-700" aria-label="Verified" />}
          </p>
          <p className="text-xs text-navy-700">
            {g.distance_km.toFixed(1)} km ·{' '}
            <span className="font-semibold text-green-700">{g.open_24x7 ? 'Open 24×7' : `Open now, till ${g.closes}`}</span>
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-navy-700">
            <span className="inline-flex items-center gap-0.5">
              <Star size={12} className="text-warning" aria-hidden /> {info.rating} ({info.jobs} jobs, sample)
            </span>
            <span>
              {price.what}: {price.from === 0 ? 'free' : rupees(price.from)}-{rupees(price.to)}
            </span>
          </p>
        </div>
        <a
          href={`tel:${g.phone.replace(/\s/g, '')}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-green-700 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
          aria-label={`Call ${g.name}, ${g.phone}`}
        >
          <Phone size={16} aria-hidden /> {t('alerts.call')}
        </a>
      </div>
      {picking ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => book(s)}
              className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
            >
              {new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
            </button>
          ))}
          <button onClick={() => setPicking(false)} className="px-2 text-sm font-semibold text-navy-700 underline">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 sm:w-auto"
        >
          <CalendarCheck size={16} aria-hidden /> {t('alerts.book')}
        </button>
      )}
    </li>
  )
}
