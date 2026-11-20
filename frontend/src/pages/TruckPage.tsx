import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Thermometer } from 'lucide-react'
import { getReadings, getTruck } from '../services/api'
import { useApi } from '../hooks/useApi'
import StatusBadge from '../components/StatusBadge'
import Pressure from '../components/Pressure'
import TyreLayout from '../components/TyreLayout'
import TyreChart from '../components/TyreChart'
import { ErrorBox, Loading } from '../components/PageState'
import { formatTemp, kpaToPsi } from '../lib/units'
import { formatTimeIST, timeAgo } from '../lib/format'
import { positionName } from '../lib/tyreLayout'
import type { TyreWithStatus } from '../types'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

/**
 * Truck page (spec section 6.3):
 * tyre layout coloured by status, per-tyre pressure / corrected / temperature,
 * and a 2-hour chart for the selected tyre.
 */
export default function TruckPage() {
  const { id = '' } = useParams()
  const truckQ = useApi(() => getTruck(id), [id])
  const readingsQ = useApi(() => getReadings(id, new Date(Date.now() - TWO_HOURS_MS)), [id])
  const truck = truckQ.data

  // Selected tyre: start with the worst one, so problems are visible straight away.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (truck && !selectedId) setSelectedId(worstTyre(truck.tyres)?.id ?? null)
  }, [truck, selectedId])

  const selected = truck?.tyres.find((t) => t.id === selectedId) ?? null
  const selectedReadings = useMemo(
    () => (readingsQ.data ?? []).filter((r) => r.tyre_id === selectedId).sort((a, b) => a.ts.localeCompare(b.ts)),
    [readingsQ.data, selectedId],
  )

  if (truckQ.loading && !truck) return <Loading what="truck" />
  if (truckQ.error) return <ErrorBox message={truckQ.error} onRetry={truckQ.reload} />
  if (!truck) {
    return (
      <p className="py-10 text-center">
        Truck not found. <Link to="/fleet" className="font-semibold text-green-700">Back to fleet</Link>
      </p>
    )
  }

  return (
    <>
      <Link to="/fleet" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
        <ArrowLeft size={16} aria-hidden /> Fleet
      </Link>

      {/* Truck header */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">{truck.reg_no}</h1>
          <p className="text-sm text-navy-700">
            {truck.make} {truck.model} · {truck.tyres.length} tyres
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-navy-700">
            <Clock size={14} aria-hidden /> Last seen {timeAgo(truck.last_seen_at)}
          </p>
        </div>
        <StatusBadge status={truck.status} className="text-sm" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr]">
        {/* Tyre diagram */}
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-700">Tyres</h2>
          <TyreLayout axleConfig={truck.axle_config} tyres={truck.tyres} selectedId={selectedId} onSelect={setSelectedId} />
          <p className="mt-2 text-center text-xs text-navy-700">Tap a tyre to see its details</p>
        </section>

        {/* Selected tyre + chart */}
        <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">
                    {selected.position} <span className="font-sans text-sm font-normal text-navy-700">· {positionName(selected.position)}</span>
                  </h2>
                  <p className="text-xs text-navy-700">Sensor {selected.sensor_id}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>
              <TyreStats tyre={selected} />
              <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-navy-700">Last 2 hours</h3>
              {readingsQ.loading && !readingsQ.data ? (
                <Loading what="readings" />
              ) : readingsQ.error ? (
                <ErrorBox message={readingsQ.error} onRetry={readingsQ.reload} />
              ) : (
                <TyreChart readings={selectedReadings} recommendedKpa={selected.recommended_cold_kpa} />
              )}
            </>
          ) : (
            <p className="text-navy-700">Select a tyre.</p>
          )}
        </section>
      </div>

      {/* All tyres at a glance */}
      <section className="mt-4 rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <h2 className="px-4 pt-4 text-sm font-bold uppercase tracking-wide text-navy-700">All tyres</h2>
        <ul className="mt-2 divide-y divide-gray-100">
          {truck.tyres.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setSelectedId(t.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-green-50 ${
                  t.id === selectedId ? 'bg-green-50' : ''
                }`}
              >
                <span className="w-14 shrink-0 font-heading font-bold">{t.position}</span>
                <span className="min-w-0 flex-1 text-sm">
                  {t.latest ? (
                    <>
                      <Pressure kpa={t.latest.pressure_kpa} />
                      <span className="block text-xs text-navy-700">
                        corrected {kpaToPsi(t.latest.corrected_kpa).toFixed(1)} psi · {formatTemp(t.latest.temp_c)}
                      </span>
                    </>
                  ) : (
                    <span className="text-navy-700">No data</span>
                  )}
                </span>
                <StatusBadge status={t.status} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

/** Numbers for the selected tyre. */
function TyreStats({ tyre }: { tyre: TyreWithStatus }) {
  const r = tyre.latest
  if (!r) return <p className="mt-3 text-navy-700">No readings from this sensor yet.</p>
  return (
    <>
      <dl className="mt-3 grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
        <Stat label="Pressure (now)">
          <Pressure kpa={r.pressure_kpa} />
        </Stat>
        <Stat label="Corrected to 20 °C">
          <Pressure kpa={r.corrected_kpa} />
        </Stat>
        <Stat label="Temperature">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Thermometer size={16} aria-hidden /> {formatTemp(r.temp_c)}
          </span>
        </Stat>
      </dl>
      <p className="mt-2 text-xs text-navy-700">
        Recommended (cold): <Pressure kpa={tyre.recommended_cold_kpa} className="text-xs" /> · max {tyre.max_temp_c} °C ·
        reading at {formatTimeIST(r.ts)} IST
      </p>
    </>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <dt className="text-xs text-navy-700">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

/** Critical first, then warning, then offline, then OK. */
function worstTyre(tyres: TyreWithStatus[]): TyreWithStatus | undefined {
  const rank = { critical: 0, warning: 1, offline: 2, ok: 3 }
  return [...tyres].sort((a, b) => rank[a.status] - rank[b.status])[0]
}
