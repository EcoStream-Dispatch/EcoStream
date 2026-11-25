import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCheck, Clock, Share2, Thermometer } from 'lucide-react'
import { ackAlert, bookGarage, getAlert, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useLiveEvents, useThrottled } from '../services/live'
import GarageList from '../components/GarageList'
import StatusBadge from '../components/StatusBadge'
import Pressure from '../components/Pressure'
import { ErrorBox, Loading } from '../components/PageState'
import { ALERT_TITLE, STATUS_STYLE, formatAlertValue } from '../lib/status'
import { useAlertText } from '../lib/alertText'
import { useLang } from '../lib/i18n'
import { WHAT_TO_DO, hoursUntilUnsafe } from '../lib/alerts'
import { formatDateTimeIST, timeAgo } from '../lib/format'
import { formatTemp } from '../lib/units'
import { positionName } from '../lib/tyreLayout'
import type { Alert, NearbyGarage, TruckSummary } from '../types'

/**
 * Alert detail (Stitch brief screen 5): big coloured header, the problem in plain words,
 * the "unsafe in ~N h" countdown, what to do now, the 3 nearest open garages with
 * Call / Book slot, Share with driver, and Acknowledge.
 */
export default function AlertDetailPage() {
  const { id = '' } = useParams()
  const alertQ = useApi(() => getAlert(id), [id])
  const trucksQ = useApi(getTrucks, [])
  const refresh = useThrottled(() => {
    alertQ.reload()
    trucksQ.reload()
  })
  useLiveEvents({ onAlert: (a) => a.id === id && refresh(), onReading: refresh })

  const alert = alertQ.data
  const truck = trucksQ.data?.find((t) => t.id === alert?.truck_id)

  if ((alertQ.loading && !alertQ.data) || (trucksQ.loading && !trucksQ.data)) return <Loading what="alert" />
  if (alertQ.error) return <ErrorBox message={alertQ.error} onRetry={alertQ.reload} />
  if (!alert) {
    return (
      <p className="py-10 text-center">
        Alert not found.{' '}
        <Link to="/alerts" className="font-semibold text-green-700">
          Back to alerts
        </Link>
      </p>
    )
  }
  return <Detail alert={alert} truck={truck} onChanged={alertQ.reload} />
}

function Detail({ alert, truck, onChanged }: { alert: Alert; truck?: TruckSummary; onChanged: () => void }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const at = useAlertText()
  const tyre = truck?.tyres.find((t) => t.id === alert.tyre_id)
  const where = tyre ? positionName(tyre.position) : 'a tyre'
  const isOpen = !alert.acknowledged_at
  const critical = alert.severity === 'critical'
  const countdown = isOpen ? at.unsafe(hoursUntilUnsafe(alert, truck)) : null
  const { icon: Icon } = STATUS_STYLE[alert.severity]

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [shared, setShared] = useState<string | null>(null)

  async function acknowledge() {
    setBusy(true)
    setError(null)
    try {
      await ackAlert(alert.id)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not acknowledge')
    } finally {
      setBusy(false)
    }
  }

  async function book(g: NearbyGarage) {
    setBookingId(g.id)
    setError(null)
    try {
      const b = await bookGarage(alert, g)
      navigate(`/bookings/${b.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book')
      setBookingId(null)
    }
  }

  async function share() {
    const url = new URL(`${import.meta.env.BASE_URL}driver`, window.location.origin).toString()
    const text = `${truck?.reg_no ?? 'Truck'}: ${ALERT_TITLE[alert.type]} on ${where}. ${WHAT_TO_DO[alert.type][0]}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'EcoStream alert', text, url })
        setShared('Shared.')
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        setShared('Copied. Paste it in WhatsApp or SMS to the driver.')
      }
    } catch (e) {
      // The user closing the share sheet is not an error.
      if (e instanceof DOMException && e.name === 'AbortError') return
      setShared('Could not share from this browser. Tell the driver: ' + text)
    }
  }

  return (
    <>
      <Link to="/alerts" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
        <ArrowLeft size={16} aria-hidden /> {t('nav.alerts')}
      </Link>

      {/* Big coloured header */}
      <header
        className={`mt-1 rounded-2xl p-5 shadow-md md:p-6 ${
          !isOpen ? 'bg-white ring-1 ring-gray-200' : critical ? 'bg-critical text-white' : 'bg-warning text-navy-900'
        }`}
      >
        <div className="flex items-start gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
              !isOpen ? 'bg-gray-100 text-navy-700' : critical ? 'bg-white/20' : 'bg-navy-900/10'
            }`}
          >
            <Icon size={30} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-xs font-bold uppercase tracking-widest">
              {isOpen ? t(critical ? 'status.critical' : 'status.warning') : t('alerts.closed')}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">
              {at.title(alert.type)} · {where}
            </h1>
            <p className="mt-1 text-sm font-semibold">
              {truck ? (
                <Link to={`/trucks/${truck.id}`} className="underline underline-offset-2">
                  {truck.reg_no}
                </Link>
              ) : (
                'Unknown truck'
              )}
              {truck && ` · ${truck.make} ${truck.model}`}
            </p>
          </div>
        </div>
        {countdown && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 font-heading text-lg font-extrabold uppercase tracking-wide text-white">
            <Clock size={20} aria-hidden /> {countdown}
          </p>
        )}
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Problem in plain words */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-lg font-bold">{t('detail.whatsWrong')}</h2>
          <p className="mt-2">{alert.message}</p>
          <dl className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-xs text-navy-700">Alert reading</dt>
              <dd className="mt-0.5 font-semibold">{formatAlertValue(alert.type, alert.value)}</dd>
            </div>
            {tyre?.latest && (
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs text-navy-700">Tyre now</dt>
                <dd className="mt-0.5 text-sm">
                  <Pressure kpa={tyre.latest.pressure_kpa} />
                  <span className="mt-0.5 flex items-center gap-1 text-navy-700">
                    <Thermometer size={14} aria-hidden /> {formatTemp(tyre.latest.temp_c)}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-3 text-xs text-navy-700">
            Raised {timeAgo(alert.created_at)} ({formatDateTimeIST(alert.created_at)} IST)
            {alert.acknowledged_at && ` · Acknowledged ${formatDateTimeIST(alert.acknowledged_at)} IST`}
          </p>
          {countdown && (
            <p className="mt-2 text-xs text-navy-700">
              Countdown: time until this tyre falls below 80% of its recommended pressure at the current leak rate.
            </p>
          )}
        </section>

        {/* What to do now */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-lg font-bold">{t('detail.whatToDo')}</h2>
          <ol className="mt-3 space-y-3">
            {at.steps(alert.type).map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 font-heading text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={share}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 font-semibold text-white hover:bg-navy-700"
            >
              <Share2 size={18} aria-hidden /> {t('detail.share')}
            </button>
            {isOpen && (
              <button
                type="button"
                onClick={acknowledge}
                disabled={busy}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-navy-900/20 px-4 font-semibold text-navy-900 hover:bg-green-50 disabled:opacity-50"
              >
                <CheckCheck size={18} aria-hidden /> {busy ? t('alerts.saving') : t('alerts.ack')}
              </button>
            )}
          </div>
          {shared && (
            <p className="mt-2 text-sm text-navy-700" role="status">
              {shared}
            </p>
          )}
        </section>
      </div>

      {/* Garages */}
      {isOpen && (
        <section className="mt-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{t('alerts.garages')}</h2>
            <StatusBadge status={alert.severity} />
          </div>
          <p className="mb-3 mt-1 text-xs text-navy-700">Straight-line distance from the truck's last position.</p>
          <GarageList lat={truck?.lat ?? null} lon={truck?.lon ?? null} onBook={book} bookingId={bookingId} />
        </section>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-critical" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
