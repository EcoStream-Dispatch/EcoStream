import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, Navigation, Thermometer, type LucideIcon } from 'lucide-react'
import { getAlerts, getReadings, getTruck } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useLiveEvents, useThrottled } from '../services/live'
import StatusBadge from '../components/StatusBadge'
import Pressure from '../components/Pressure'
import TyreLayout from '../components/TyreLayout'
import TyreChart from '../components/TyreChart'
import FleetMap from '../components/FleetMap'
import PlanBadge from '../components/PlanBadge'
import ParameterBoard from '../components/ParameterBoard'
import { ErrorBox, Loading } from '../components/PageState'
import { formatTemp, kpaToPsi } from '../lib/units'
import { formatTimeIST, timeAgo } from '../lib/format'
import { positionName } from '../lib/tyreLayout'
import { planOf } from '../lib/plans'
import { nearestTown } from '../lib/geo'
import { useLang } from '../lib/i18n'
import type { TruckSummary, TyreWithStatus } from '../types'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

/**
 * Truck page (spec section 6.3):
 * tyre layout coloured by status, per-tyre pressure / corrected / temperature,
 * and a 2-hour chart for the selected tyre.
 */
export default function TruckPage() {
  const { id = '' } = useParams()
  const { t: tr } = useLang()
  const truckQ = useApi(() => getTruck(id), [id])
  const readingsQ = useApi(() => getReadings(id, new Date(Date.now() - TWO_HOURS_MS)), [id])
  const alertsQ = useApi(() => getAlerts(true), [id])
  const truck = truckQ.data

  // Live: add new readings for this truck to the chart, refresh the tyre values.
  const refreshTruck = useThrottled(truckQ.reload)
  useLiveEvents({
    onReading: (r) => {
      if (!truck?.tyres.some((t) => t.id === r.tyre_id)) return
      const cutoff = Date.now() - TWO_HOURS_MS
      readingsQ.setData((prev) =>
        prev && !prev.some((x) => x.id === r.id)
          ? [...prev.filter((x) => new Date(x.ts).getTime() >= cutoff), r]
          : prev,
      )
      refreshTruck()
    },
    onAlert: (a) => {
      if (a.truck_id === id) {
        refreshTruck()
        alertsQ.reload()
      }
    },
  })

  // Selected tyre: start with the worst one, so problems are visible straight away.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (truck && !selectedId) setSelectedId(worstTyre(truck.tyres)?.id ?? null)
  }, [truck, selectedId])

  const selected = truck?.tyres.find((t) => t.id === selectedId) ?? null
  const selectedReadings = useMemo(
    () => (readingsQ.data ?? [])
        .filter((r) => r.tyre_id === selectedId)
        // Compare as dates: the API and Realtime may format times differently.
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()),
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-wide">{truck.reg_no}</h1>
            <PlanBadge plan={planOf(truck)} />
          </div>
          <p className="text-sm text-navy-700">
            {truck.make} {truck.model} · {truck.axle_config === '10W' ? '10-wheel (2 rear axles)' : '6-wheel (1 rear axle)'}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-navy-700">
            <Clock size={14} aria-hidden /> {tr('truck.lastSeen')} {timeAgo(truck.last_seen_at)}
          </p>
        </div>
        <StatusBadge status={truck.status} className="text-sm" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr]">
        {/* Tyre diagram */}
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-700">{tr('truck.tyres')}</h2>
          <TyreLayout axleConfig={truck.axle_config} tyres={truck.tyres} selectedId={selectedId} onSelect={setSelectedId} />
          <p className="mt-2 text-center text-xs text-navy-700">{tr('truck.tapTyre')}</p>
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
              <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-navy-700">{tr('truck.last2h')}</h3>
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

      {/* Every data point the truck's plan includes (owner view) */}
      <ParameterBoard truck={truck} role="owner" alerts={alertsQ.data ?? []} className="mt-6" />

      {/* Location + all tyres at a glance */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
      <LocationCard truck={truck} />
      <section className="min-w-0 rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <h2 className="px-4 pt-4 text-sm font-bold uppercase tracking-wide text-navy-700">{tr('truck.allTyres')}</h2>
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
      </div>
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

function Panel({ title, icon: Icon, children, className = '' }: { title: string; icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 ${className}`}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy-700">
        <Icon size={18} className="text-green-700" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  )
}

/** Last known position on the corridor map, with the nearest town and a Maps link. */
function LocationCard({ truck }: { truck: TruckSummary }) {
  const { t: tr } = useLang()
  const has = truck.lat != null && truck.lon != null
  const town = has ? nearestTown(truck.lat!, truck.lon!) : null
  return (
    <Panel title={tr('truck.location')} icon={MapPin}>
      {has ? (
        <>
          <p className="font-semibold">
            {town!.km < 5 ? `In ${town!.name}` : `About ${Math.round(town!.km)} km from ${town!.name}`}
          </p>
          <p className="text-xs text-navy-700">
            {truck.lat!.toFixed(4)}, {truck.lon!.toFixed(4)} · {timeAgo(truck.last_seen_at)}
          </p>
          <div className="mt-3">
            <FleetMap trucks={[truck]} />
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${truck.lat},${truck.lon}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border-2 border-green-700 text-sm font-semibold text-green-700 hover:bg-green-50"
          >
            <Navigation size={16} aria-hidden /> {tr('truck.openMaps')}
          </a>
        </>
      ) : (
        <p className="text-sm text-navy-700">No GPS position yet.</p>
      )}
    </Panel>
  )
}
