import { Suspense, lazy, useMemo, useState } from 'react'
import { BadgeCheck, CalendarCheck, Clock, Phone, Star } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useOwnerData } from '../../hooks/useOwnerData'
import { garageInfo, getAllGarages, getBookings } from '../../services/api'
import { haversineKm, isOpenNow } from '../../lib/geo'
import { formatDateTimeIST } from '../../lib/format'
import { Card, CardTitle, DemoTag, PageHeader } from '../../components/owner/ui'
import { MapLegend } from '../../components/owner/mapStyle'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'

const FleetMap = lazy(() => import('../../components/owner/FleetMap'))

/*
 * Garages (docs/WEBSITE_SPEC.md section 2.10): verified garage network on a map and in a list
 * (24x7 badge, services, rating, distance from a chosen truck), and my bookings.
 * The garages are the fictional "Sample Tyre Works"; ratings and bookings are sample data.
 */

const SERVICE_LABEL: Record<string, string> = { tyre: 'Tyre', air_brake: 'Air brake', engine: 'Engine' }

export default function GaragesPage() {
  const { t } = useLanguage()
  const { trucks, loading, error, reload } = useOwnerData()
  const garagesQ = useApi(getAllGarages, [])
  const bookingsQ = useApi(() => (trucks ? getBookings(trucks) : Promise.resolve([])), [trucks])
  const [fromTruck, setFromTruck] = useState<string>('')
  const [service, setService] = useState<string>('all')

  const origin = trucks?.find((tr) => tr.id === fromTruck) ?? trucks?.[0]
  const list = useMemo(() => {
    const now = new Date()
    return (garagesQ.data ?? [])
      .filter((g) => service === 'all' || g.services.includes(service))
      .map((g) => ({
        g,
        open: isOpenNow(g, now),
        km: origin?.lat != null && origin.lon != null ? haversineKm(origin.lat, origin.lon, g.lat, g.lon) : null,
      }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
  }, [garagesQ.data, service, origin])

  if ((loading && !trucks) || (garagesQ.loading && !garagesQ.data)) return <Loading what="garages" />
  if (error || garagesQ.error) return <ErrorBox message={(error ?? garagesQ.error)!} onRetry={reload} />
  const truckReg = new Map((trucks ?? []).map((tr) => [tr.id, tr.reg_no]))

  return (
    <>
      <PageHeader title={t('owner.garages')} subtitle={`${list.length} garages on the corridor`} right={<DemoTag />} />

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="p-2 sm:p-3">
          <Suspense fallback={<div className="flex h-[50vh] items-center justify-center rounded-lg bg-gray-100 text-sm">Loading map…</div>}>
            <FleetMap trucks={origin ? [origin] : []} garages={list.map((x) => x.g)} show={{ garages: true }} selectedId={origin?.id} className="h-[50vh] min-h-[300px]" />
          </Suspense>
          <MapLegend show={{ garages: true }} />
        </Card>

        <Card>
          <CardTitle right={<span className="text-xs text-navy-700">Bookings this session</span>}>My bookings</CardTitle>
          {(bookingsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-navy-700">No bookings yet. Book from an alert.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(bookingsQ.data ?? []).map((b) => (
                <li key={b.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <CalendarCheck size={18} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{b.garage_name}</span> · {truckReg.get(b.truck_id) ?? b.truck_id}
                    <span className="block text-xs text-navy-700">
                      {formatDateTimeIST(b.slot)} IST · {b.what}
                    </span>
                  </span>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                      b.status === 'done' ? 'bg-gray-100 text-gray-600 ring-gray-300' : 'bg-green-50 text-green-700 ring-green-500/30'
                    }`}
                  >
                    {b.status === 'done' ? 'Done' : 'Confirmed'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-gray-200">
          <span className="font-semibold text-navy-700">Distance from</span>
          <select value={origin?.id ?? ''} onChange={(e) => setFromTruck(e.target.value)} className="bg-transparent font-semibold">
            {(trucks ?? []).map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.reg_no}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-gray-200">
          <span className="font-semibold text-navy-700">Service</span>
          <select value={service} onChange={(e) => setService(e.target.value)} className="bg-transparent font-semibold">
            <option value="all">All</option>
            <option value="tyre">Tyre</option>
            <option value="air_brake">Air brake</option>
            <option value="engine">Engine</option>
          </select>
        </label>
      </div>

      <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map(({ g, open, km }) => {
          const info = garageInfo(g.id)
          return (
            <li key={g.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1 font-bold">
                  {g.name}
                  {g.verified ? (
                    <BadgeCheck size={16} className="text-green-700" aria-label="Verified" />
                  ) : (
                    <span className="rounded bg-gray-100 px-1.5 text-[10px] font-semibold uppercase text-gray-600">Not verified</span>
                  )}
                </p>
                {g.open_24x7 && <span className="whitespace-nowrap rounded-full bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-white">24×7</span>}
              </div>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-navy-700">
                <span className={`inline-flex items-center gap-1 font-semibold ${open ? 'text-green-700' : 'text-gray-600'}`}>
                  <Clock size={12} aria-hidden /> {g.open_24x7 ? 'Open 24×7' : open ? `Open now, till ${g.closes}` : `Closed now (${g.opens}-${g.closes})`}
                </span>
                {km != null && <span>{km.toFixed(0)} km away</span>}
                <span className="inline-flex items-center gap-0.5">
                  <Star size={12} className="text-warning" aria-hidden /> {info.rating} (sample)
                </span>
              </p>
              <p className="mt-2 flex flex-wrap gap-1">
                {g.services.map((s) => (
                  <span key={s} className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                    {SERVICE_LABEL[s] ?? s}
                  </span>
                ))}
              </p>
              <a href={`tel:${g.phone.replace(/\s/g, '')}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-green-700">
                <Phone size={14} aria-hidden /> {g.phone}
              </a>
            </li>
          )
        })}
      </ul>
    </>
  )
}
