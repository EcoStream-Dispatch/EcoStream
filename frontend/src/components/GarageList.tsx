import { BadgeCheck, CalendarCheck, Phone } from 'lucide-react'
import { getNearestGarages } from '../services/api'
import { useApi } from '../hooks/useApi'
import type { NearbyGarage } from '../types'

interface Props {
  lat: number | null
  lon: number | null
  /** When set, each garage also gets a "Book slot" button. */
  onBook?: (garage: NearbyGarage) => void
  /** Id of the garage being booked right now (shows "Booking…"). */
  bookingId?: string | null
}

/**
 * The 3 nearest garages that are open now (spec sections 5 and 6.4).
 * Distance is a straight line from the truck's last position, not road distance.
 * We have no garage prices yet, so we never show a number: "Price: ask garage".
 */
export default function GarageList({ lat, lon, onBook, bookingId = null }: Props) {
  const { data, loading, error } = useApi(
    () => (lat == null || lon == null ? Promise.resolve([]) : getNearestGarages(lat, lon, 'tyre')),
    [lat, lon],
  )

  if (lat == null || lon == null) return <p className="text-sm text-navy-700">Truck location unknown.</p>
  if (loading && !data) return <p className="text-sm text-navy-700">Finding garages…</p>
  if (error) return <p className="text-sm text-critical">Could not load garages: {error}</p>
  if (!data || data.length === 0) return <p className="text-sm text-navy-700">No open tyre garages found nearby.</p>

  return (
    <ul className="divide-y divide-gray-100 rounded-lg ring-1 ring-gray-200">
      {data.map((g) => (
        <li key={g.id} className="flex flex-col gap-3 p-3 min-[420px]:flex-row min-[420px]:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <span className="truncate">{g.name}</span>
              {g.verified && <BadgeCheck size={16} className="shrink-0 text-green-700" aria-label="Verified" />}
            </p>
            <p className="text-xs text-navy-700">
              {g.distance_km.toFixed(1)} km away ·{' '}
              <span className="font-semibold text-green-700">
                {g.open_24x7 ? 'Open 24×7' : `Open now, till ${g.closes}`}
              </span>
            </p>
            {onBook && (
              <p className="text-xs text-navy-700">
                {g.phone} · Price: ask garage
              </p>
            )}
          </div>
          <div className={`grid shrink-0 gap-2 ${onBook ? 'grid-cols-2' : ''}`}>
            {/* Big tap target: owners will call from the roadside */}
            <a
              href={`tel:${g.phone.replace(/\s/g, '')}`}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg bg-green-700 px-3 text-sm font-semibold text-white hover:bg-green-500"
              aria-label={`Call ${g.name}, ${g.phone}`}
            >
              <Phone size={16} aria-hidden /> Call
            </a>
            {onBook && (
              <button
                type="button"
                onClick={() => onBook(g)}
                disabled={bookingId !== null}
                className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border-2 border-green-700 px-3 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                <CalendarCheck size={16} aria-hidden /> {bookingId === g.id ? 'Booking…' : 'Book slot'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
