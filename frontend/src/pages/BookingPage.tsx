import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CalendarCheck, Info, Navigation, Phone } from 'lucide-react'
import { getAlert, getBooking, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { ErrorBox, Loading } from '../components/PageState'
import { ALERT_TITLE, formatAlertValue } from '../lib/status'
import { formatDateTimeIST } from '../lib/format'
import { positionName } from '../lib/tyreLayout'
import { useLang } from '../lib/i18n'

/**
 * "Garage booked" confirmation (Stitch brief screen 6): garage, distance, route button,
 * and the job details for the garage.
 *
 * Booking is NOT connected yet (no bookings table or endpoint). We say so on screen,
 * and we don't show an ETA or price we can't back up.
 */
export default function BookingPage() {
  const { id = '' } = useParams()
  const { t: tr } = useLang()
  const bookingQ = useApi(() => getBooking(id), [id])
  const booking = bookingQ.data
  const alertQ = useApi(() => (booking ? getAlert(booking.alert_id) : Promise.resolve(null)), [booking?.alert_id])
  const trucksQ = useApi(getTrucks, [])

  if (bookingQ.loading && !booking) return <Loading what="booking" />
  if (bookingQ.error) return <ErrorBox message={bookingQ.error} onRetry={bookingQ.reload} />
  if (!booking) {
    return (
      <p className="py-10 text-center">
        Booking not found. Bookings are only kept until you reload the page in this prototype.{' '}
        <Link to="/alerts" className="font-semibold text-green-700">
          Back to alerts
        </Link>
      </p>
    )
  }

  const g = booking.garage
  const alert = alertQ.data
  const truck = trucksQ.data?.find((t) => t.id === booking.truck_id)
  const tyre = truck?.tyres.find((t) => t.id === booking.tyre_id)

  return (
    <>
      <Link
        to={`/alerts/${booking.alert_id}`}
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500"
      >
        <ArrowLeft size={16} aria-hidden /> Back to alert
      </Link>

      <div className="mx-auto max-w-2xl">
        <header className="rounded-2xl bg-green-700 p-5 text-white shadow-md md:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
              <CalendarCheck size={30} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-xs font-bold uppercase tracking-widest text-green-50/90">{tr('booking.title')}</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold leading-tight">
                <span className="min-w-0 break-words">{g.name}</span>
                {g.verified && <BadgeCheck size={22} className="shrink-0" aria-label="Verified" />}
              </h1>
              <p className="mt-1 text-sm">
                {g.distance_km.toFixed(1)} km away (straight line) · {g.open_24x7 ? 'Open 24×7' : `Open till ${g.closes}`}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white font-semibold text-green-700 hover:bg-green-50"
            >
              <Navigation size={18} aria-hidden /> {tr('garage.navigate')}
            </a>
            <a
              href={`tel:${g.phone.replace(/\s/g, '')}`}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border-2 border-white font-semibold text-white hover:bg-white/10"
            >
              <Phone size={18} aria-hidden /> Call {g.phone}
            </a>
          </div>
        </header>

        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-warning/40" role="note">
          <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{tr('booking.prototype')}</span>
        </p>

        <section className="mt-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-lg font-bold">{tr('booking.job')}</h2>
          <p className="text-xs text-navy-700">What the garage will get once booking is connected.</p>
          <dl className="mt-3 divide-y divide-gray-100 text-sm">
            <Row label="Truck">{truck ? `${truck.reg_no} · ${truck.make} ${truck.model}` : '—'}</Row>
            <Row label="Tyre">{tyre ? `${tyre.position} (${positionName(tyre.position)})` : '—'}</Row>
            <Row label="Problem">{alert ? ALERT_TITLE[alert.type] : '—'}</Row>
            <Row label="Reading">{alert ? formatAlertValue(alert.type, alert.value) : '—'}</Row>
            <Row label="Price">Ask garage</Row>
            <Row label="Booked at">{formatDateTimeIST(booking.created_at)} IST</Row>
          </dl>
        </section>

        <Link
          to="/fleet"
          className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-navy-900/20 font-semibold text-navy-900 hover:bg-green-50"
        >
          {tr('booking.back')}
        </Link>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="shrink-0 text-navy-700">{label}</dt>
      <dd className="min-w-0 text-right font-semibold">{children}</dd>
    </div>
  )
}
