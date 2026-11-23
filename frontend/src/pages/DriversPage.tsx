import { useState } from 'react'
import { Phone, Star } from 'lucide-react'
import { assignDriver, getDrivers, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { ErrorBox, Loading } from '../components/PageState'
import { AVAILABILITY } from '../lib/drivers'
import type { Driver, DriverAvailability } from '../types'

/**
 * Drivers: list, availability, rating, and assign a driver to a truck.
 * NOT CONNECTED YET: there is no drivers table, so this works on demo data only
 * and assignments are kept until the page is reloaded.
 */
export default function DriversPage() {
  const driversQ = useApi(getDrivers, [])
  const trucksQ = useApi(getTrucks, [])
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const drivers = driversQ.data
  const trucks = trucksQ.data ?? []
  const count = (a: DriverAvailability) => (drivers ?? []).filter((d) => d.availability === a).length

  async function assign(d: Driver, truckId: string | null) {
    setSaving(d.id)
    setError(null)
    try {
      driversQ.setData(await assignDriver(d.id, truckId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold md:text-3xl">Drivers</h1>
      <p className="mt-1 text-navy-700">Who is driving which truck.</p>

      {driversQ.loading && !drivers && <Loading what="drivers" />}
      {driversQ.error && <ErrorBox message={driversQ.error} onRetry={driversQ.reload} />}
      {!driversQ.loading && drivers === null && !driversQ.error && (
        <p className="mt-4 rounded-xl bg-white p-5 text-navy-700 ring-1 ring-gray-200">
          Drivers aren't connected to the server yet. This page works in the demo for now.
        </p>
      )}

      {drivers && (
        <>
          <ul className="mt-4 grid grid-cols-3 gap-3">
            {(Object.keys(AVAILABILITY) as DriverAvailability[]).map((a) => (
              <li key={a} className="rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-gray-200">
                <p className="font-heading text-3xl font-extrabold">{count(a)}</p>
                <p className="text-xs font-semibold text-navy-700">{AVAILABILITY[a].label}</p>
              </li>
            ))}
          </ul>

          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {drivers.map((d) => (
              <li key={d.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{d.name}</p>
                    <p className="flex items-center gap-1 text-sm text-navy-700">
                      <Star size={14} aria-hidden />
                      {d.rating == null ? 'Rating: coming with Pro' : `Rating ${d.rating.toFixed(1)} / 5`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${AVAILABILITY[d.availability].cls}`}>
                    {AVAILABILITY[d.availability].label}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-[1fr_auto]">
                  <label className="block">
                    <span className="text-xs font-semibold text-navy-700">Truck</span>
                    <select
                      value={d.truck_id ?? ''}
                      disabled={saving !== null}
                      onChange={(e) => assign(d, e.target.value || null)}
                      className="mt-1 h-11 w-full rounded-lg bg-white px-3 text-base ring-1 ring-gray-300 focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-60"
                    >
                      <option value="">Not assigned</option>
                      {trucks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.reg_no}
                        </option>
                      ))}
                    </select>
                  </label>
                  <a
                    href={`tel:${d.phone.replace(/\s/g, '')}`}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1 self-end rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-500"
                    aria-label={`Call ${d.name}, ${d.phone}`}
                  >
                    <Phone size={16} aria-hidden /> Call
                  </a>
                </div>
                {saving === d.id && <p className="mt-1 text-xs text-navy-700">Saving…</p>}
              </li>
            ))}
          </ul>
          {error && (
            <p className="mt-3 text-sm font-semibold text-critical" role="alert">
              {error}
            </p>
          )}
          <p className="mt-4 text-xs text-navy-700">
            Demo: assignments are kept until you reload the page. One driver per truck.
          </p>
        </>
      )}
    </>
  )
}
