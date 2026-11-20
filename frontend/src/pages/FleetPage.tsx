import { Link } from 'react-router-dom'
import { BellRing, ChevronRight, Clock } from 'lucide-react'
import { getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import StatusBadge from '../components/StatusBadge'
import { ErrorBox, Loading } from '../components/PageState'
import { STATUS_STYLE } from '../lib/status'
import { timeAgo } from '../lib/format'
import type { TruckSummary, TyreStatus } from '../types'

/** Fleet page (spec section 6.2): one card per truck - reg no, status, last seen. */
export default function FleetPage() {
  const { data: trucks, loading, error, reload } = useApi(getTrucks, [])

  return (
    <>
      <h1 className="text-2xl font-bold">My fleet</h1>
      {trucks && (
        <p className="mt-1 text-sm text-navy-700">
          {trucks.length} trucks · {trucks.filter((t) => t.status !== 'ok').length} need attention
        </p>
      )}

      <div className="mt-4">
        {loading && !trucks && <Loading what="trucks" />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {trucks && trucks.length === 0 && <p className="text-navy-700">No trucks yet.</p>}
        {trucks && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {trucks.map((t) => (
              <li key={t.id}>
                <TruckCard truck={t} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function TruckCard({ truck }: { truck: TruckSummary }) {
  // Count tyres per status for the small coloured dots row.
  const counts = truck.tyres.reduce<Partial<Record<TyreStatus, number>>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <Link
      to={`/trucks/${truck.id}`}
      className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 transition hover:ring-green-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold tracking-wide">{truck.reg_no}</p>
          <p className="text-sm text-navy-700">
            {truck.make} {truck.model} · {truck.tyres.length} tyres
          </p>
        </div>
        <StatusBadge status={truck.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy-700">
        <span className="inline-flex items-center gap-1">
          <Clock size={14} aria-hidden /> Last seen {timeAgo(truck.last_seen_at)}
        </span>
        {truck.open_alerts > 0 && (
          <span className="inline-flex items-center gap-1 font-semibold text-navy-900">
            <BellRing size={14} aria-hidden /> {truck.open_alerts} open alert{truck.open_alerts > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <ul className="flex flex-wrap gap-3 text-xs text-navy-700">
          {(Object.keys(STATUS_STYLE) as TyreStatus[])
            .filter((s) => counts[s])
            .map((s) => (
              <li key={s} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_STYLE[s].hex }} aria-hidden />
                {counts[s]} {STATUS_STYLE[s].label}
              </li>
            ))}
        </ul>
        <ChevronRight size={18} className="text-navy-700" aria-hidden />
      </div>
    </Link>
  )
}
