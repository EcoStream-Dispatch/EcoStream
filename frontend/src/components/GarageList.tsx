import { BadgeCheck, Phone } from 'lucide-react'
import { getNearestGarages } from '../services/api'
import { useApi } from '../hooks/useApi'

/**
 * The 3 nearest garages that are open now (spec sections 5 and 6.4).
 * Distance is a straight line from the truck's last position, not road distance.
 */
export default function GarageList({ lat, lon }: { lat: number | null; lon: number | null }) {
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
        <li key={g.id} className="flex items-center gap-3 p-3">
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
          </div>
          {/* Big tap target: owners will call from the roadside */}
          <a
            href={`tel:${g.phone.replace(/\s/g, '')}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500"
            aria-label={`Call ${g.name}, ${g.phone}`}
          >
            <Phone size={16} aria-hidden /> Call
          </a>
        </li>
      ))}
    </ul>
  )
}
