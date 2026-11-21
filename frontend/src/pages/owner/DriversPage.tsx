import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Lightbulb, Phone } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useOwnerData } from '../../hooks/useOwnerData'
import { driverScoreTrend, driverTrips, getDrivers } from '../../services/api'
import { Card, CardTitle, DemoTag, PageHeader, Sparkline, daysFromNow, dueText, formatDate } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { Availability, Driver, TruckSummary } from '../../types'

/*
 * Drivers (docs/WEBSITE_SPEC.md section 2.9): photo placeholder, phone, licence expiry,
 * rating (0-100 from driving data), availability, assigned truck; profile with trip history
 * and score trend. Sample data.
 */

const AVAIL: Record<Availability, { label: string; cls: string }> = {
  on_trip: { label: 'On trip', cls: 'bg-green-50 text-green-700 ring-green-500/30' },
  available: { label: 'Available', cls: 'bg-navy-900 text-white ring-navy-900' },
  off: { label: 'Off', cls: 'bg-gray-100 text-gray-600 ring-gray-300' },
}

export function AvailabilityBadge({ a }: { a: Availability }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${AVAIL[a].cls}`}>{AVAIL[a].label}</span>
}

function Avatar({ name, big = false }: { name: string; big?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-green-50 font-heading font-bold text-green-700 ring-1 ring-green-500/30 ${big ? 'h-16 w-16 text-xl' : 'h-11 w-11'}`}
      aria-hidden
    >
      {initials}
    </span>
  )
}

function scoreTone(score: number) {
  return score >= 80 ? 'text-green-700' : score >= 65 ? 'text-amber-800' : 'text-critical'
}

function useDrivers() {
  const { trucks, loading, error, reload } = useOwnerData()
  const q = useApi(() => (trucks ? getDrivers(trucks) : Promise.resolve(null)), [trucks])
  return { trucks, drivers: q.data, loading: loading || q.loading, error: error ?? q.error, reload }
}

export default function DriversPage() {
  const { t } = useLanguage()
  const { trucks, drivers, loading, error, reload } = useDrivers()
  if (loading && !drivers) return <Loading what="drivers" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const truckOf = new Map((trucks ?? []).map((tr) => [tr.id, tr]))

  return (
    <>
      <PageHeader title={t('owner.drivers')} subtitle={`${drivers?.length ?? 0} drivers`} right={<DemoTag />} />
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(drivers ?? []).map((d) => (
          <li key={d.id}>
            <DriverCard d={d} truck={d.truck_id ? truckOf.get(d.truck_id) : undefined} />
          </li>
        ))}
      </ul>
    </>
  )
}

function DriverCard({ d, truck }: { d: Driver; truck?: TruckSummary }) {
  const expiresSoon = daysFromNow(d.licence_expiry) <= 30
  return (
    <Link to={`/owner/drivers/${d.id}`} className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 hover:ring-green-300">
      <div className="flex items-start gap-3">
        <Avatar name={d.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">{d.name}</p>
            <AvailabilityBadge a={d.availability} />
          </div>
          <p className="text-sm text-navy-700">{d.phone}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-navy-700">Score</dt>
          <dd className={`font-heading text-lg font-extrabold ${scoreTone(d.score)}`}>{d.score}</dd>
        </div>
        <div>
          <dt className="text-navy-700">Truck</dt>
          <dd className="font-semibold">{truck?.reg_no.slice(-7) ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-navy-700">Licence</dt>
          <dd className={`font-semibold ${expiresSoon ? 'text-critical' : ''}`}>
            {expiresSoon && <AlertTriangle size={12} className="mr-0.5 inline" aria-label="Expires soon" />}
            {formatDate(d.licence_expiry)}
          </dd>
        </div>
      </dl>
    </Link>
  )
}

export function DriverProfilePage() {
  const { id = '' } = useParams()
  const { trucks, drivers, loading, error, reload } = useDrivers()
  if (loading && !drivers) return <Loading what="driver" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const d = drivers?.find((x) => x.id === id)
  if (!d)
    return (
      <p className="py-10 text-center">
        Driver not found.{' '}
        <Link to="/owner/drivers" className="font-semibold text-green-700">
          Back to drivers
        </Link>
      </p>
    )
  const truck = trucks?.find((tr) => tr.id === d.truck_id)
  const trips = driverTrips(d.id)
  const trend = driverScoreTrend(d.score)

  return (
    <>
      <Link to="/owner/drivers" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
        <ArrowLeft size={16} aria-hidden /> Drivers
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <Avatar name={d.name} big />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{d.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-navy-700">
            <AvailabilityBadge a={d.availability} />
            {truck ? (
              <Link to={`/owner/trucks/${truck.id}`} className="font-semibold text-green-700">
                {truck.reg_no}
              </Link>
            ) : (
              'No truck assigned'
            )}
          </p>
        </div>
        <a href={`tel:${d.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white hover:bg-green-500">
          <Phone size={16} aria-hidden /> Call
        </a>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle right={<DemoTag />}>Driving score</CardTitle>
          <p className={`font-heading text-4xl font-extrabold ${scoreTone(d.score)}`}>
            {d.score}
            <span className="text-base text-navy-700"> / 100</span>
          </p>
          <Sparkline values={trend} className="mt-2 h-12" />
          <p className="text-xs text-navy-700">Last 8 weeks. From harsh braking, speeding and idling.</p>
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 p-2 text-sm">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
            {d.score < 70 ? 'Fewer harsh brakes on the ghat roads would lift the score fastest.' : 'Smooth braking saves tyres. Keep it up.'}
          </p>
          <p className="mt-3 text-sm">
            Licence expires <span className="font-semibold">{formatDate(d.licence_expiry)}</span> ({dueText(d.licence_expiry)})
          </p>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle right={<DemoTag />}>Trip history</CardTitle>
          <ul className="divide-y divide-gray-100">
            {trips.map((tr, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">
                    {tr.from} → {tr.to}
                  </span>
                  <span className="block text-xs text-navy-700">
                    {formatDate(tr.date)} · {tr.km} km
                  </span>
                </span>
                <span className={`font-heading font-bold ${scoreTone(tr.score)}`}>{tr.score}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
