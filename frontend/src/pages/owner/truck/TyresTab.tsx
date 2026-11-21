import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BatteryMedium, Gauge, Ruler, Thermometer, TrendingDown } from 'lucide-react'
import { getReadings } from '../../../services/api'
import { useApi } from '../../../hooks/useApi'
import { useLiveEvents } from '../../../services/live'
import StatusBadge from '../../../components/StatusBadge'
import Pressure from '../../../components/Pressure'
import TyreLayout from '../../../components/TyreLayout'
import TyreChart from '../../../components/TyreChart'
import { ErrorBox, Loading } from '../../../components/PageState'
import { Card, CardTitle, DemoTag, formatDate, rupees } from '../../../components/owner/ui'
import { formatTemp, kpaToPsi } from '../../../lib/units'
import { formatTimeIST } from '../../../lib/format'
import { positionName } from '../../../lib/tyreLayout'
import type { Reading, TruckSummary, TyreExtra, TyreWithStatus } from '../../../types'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const LEAK_WINDOW_MS = 30 * 60 * 1000
/** Same as api/alert_config.py critical_pressure_fraction */
const CRITICAL_FRACTION = 0.8

/*
 * Tyres tab (docs/WEBSITE_SPEC.md section 2.4).
 * Top-view diagram (6 / 10 / 12 / 14 / 18 wheels), per tyre: pressure, corrected pressure,
 * temperature, leak rate, tread depth, sensor battery; 2-hour chart; tyre history.
 *
 * Pressure, temperature, chart and leak rate use real sensor data (live).
 * Tread depth, sensor battery and tyre history are sample data until the backend has them.
 */
export default function TyresTab({ truck, extras }: { truck: TruckSummary; extras: TyreExtra[] }) {
  const readingsQ = useApi(() => getReadings(truck.id, new Date(Date.now() - TWO_HOURS_MS)), [truck.id])

  // Live: add new readings for this truck to the chart.
  useLiveEvents({
    onReading: (r) => {
      if (!truck.tyres.some((t) => t.id === r.tyre_id)) return
      const cutoff = Date.now() - TWO_HOURS_MS
      readingsQ.setData((prev) =>
        prev && !prev.some((x) => x.id === r.id) ? [...prev.filter((x) => new Date(x.ts).getTime() >= cutoff), r] : prev,
      )
    },
  })

  // Selected tyre: start with the worst one, so problems are visible straight away.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedId || !truck.tyres.some((t) => t.id === selectedId)) setSelectedId(worstTyre(truck.tyres)?.id ?? null)
  }, [truck, selectedId])

  const byTyre = useMemo(() => {
    const m = new Map<string, Reading[]>()
    for (const r of readingsQ.data ?? []) m.set(r.tyre_id, [...(m.get(r.tyre_id) ?? []), r])
    // Compare as dates: the API and Realtime may format times differently.
    for (const list of m.values()) list.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    return m
  }, [readingsQ.data])

  const selected = truck.tyres.find((t) => t.id === selectedId) ?? null
  const extraOf = new Map(extras.map((e) => [e.position, e]))

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <Card>
          <CardTitle>Tyres</CardTitle>
          <TyreLayout axleConfig={truck.axle_config} tyres={truck.tyres} selectedId={selectedId} onSelect={setSelectedId} />
          <p className="mt-2 text-center text-xs text-navy-700">Tap a tyre to see its details</p>
        </Card>

        <Card>
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
              <TyreStats tyre={selected} readings={byTyre.get(selected.id) ?? []} extra={extraOf.get(selected.position)} />
              <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-navy-700">Last 2 hours</h3>
              {readingsQ.loading && !readingsQ.data ? (
                <Loading what="readings" />
              ) : readingsQ.error ? (
                <ErrorBox message={readingsQ.error} onRetry={readingsQ.reload} />
              ) : (
                <TyreChart readings={byTyre.get(selected.id) ?? []} recommendedKpa={selected.recommended_cold_kpa} />
              )}
            </>
          ) : (
            <p className="text-navy-700">Select a tyre.</p>
          )}
        </Card>
      </div>

      {/* All tyres at a glance */}
      <Card className="mt-4 p-0">
        <h2 className="px-4 pt-4 text-sm font-bold uppercase tracking-wide text-navy-700">All tyres</h2>
        <ul className="mt-2 divide-y divide-gray-100">
          {truck.tyres.map((t) => {
            const leak = leakRate(byTyre.get(t.id) ?? [])
            return (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-green-50 ${t.id === selectedId ? 'bg-green-50' : ''}`}
                >
                  <span className="w-14 shrink-0 font-heading font-bold">{t.position}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    {t.latest ? (
                      <>
                        <Pressure kpa={t.latest.pressure_kpa} />
                        <span className="block text-xs text-navy-700">
                          corrected {kpaToPsi(t.latest.corrected_kpa).toFixed(1)} psi · {formatTemp(t.latest.temp_c)}
                          {leak !== null && leak <= -0.5 && ` · falling ${(-leak).toFixed(1)} psi/h`}
                        </span>
                      </>
                    ) : (
                      <span className="text-navy-700">No data</span>
                    )}
                  </span>
                  <StatusBadge status={t.status} />
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      {/* Tyre history */}
      <Card className="mt-4">
        <CardTitle right={<DemoTag />}>Tyre history</CardTitle>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-navy-700">
              <tr>
                {['Position', 'Brand', 'Fitted', 'Km run', 'Retreads', 'Cost per km'].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {extras.map((e) => (
                <tr key={e.position}>
                  <td className="py-2 pr-3 font-heading font-bold">{e.position}</td>
                  <td className="py-2 pr-3">{e.brand}</td>
                  <td className="py-2 pr-3">{formatDate(e.fitted_on)}</td>
                  <td className="py-2 pr-3">{e.km_run.toLocaleString('en-IN')} km</td>
                  <td className="py-2 pr-3">{e.retreads}</td>
                  <td className="py-2 pr-3">{rupees(e.cost_per_km * 100)} per 100 km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/**
 * Leak rate in psi per hour from the last 30 minutes of corrected pressure
 * (least-squares slope, like the API's slow-leak check). Negative = losing air.
 * null when there isn't enough data.
 */
export function leakRate(readings: Reading[], now = Date.now()): number | null {
  const pts = readings.filter((r) => now - new Date(r.ts).getTime() <= LEAK_WINDOW_MS)
  if (pts.length < 5) return null
  const xs = pts.map((r) => new Date(r.ts).getTime() / 3_600_000)
  const ys = pts.map((r) => kpaToPsi(r.corrected_kpa))
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my)
    den += (x - mx) ** 2
  })
  return den === 0 ? null : num / den
}

/** Numbers for the selected tyre. */
function TyreStats({ tyre, readings, extra }: { tyre: TyreWithStatus; readings: Reading[]; extra?: TyreExtra }) {
  const r = tyre.latest
  if (!r) return <p className="mt-3 text-navy-700">No readings from this sensor yet.</p>
  const leak = leakRate(readings)
  const limitPsi = kpaToPsi(tyre.recommended_cold_kpa * CRITICAL_FRACTION)
  const hoursToUnsafe = leak !== null && leak < -0.5 ? (kpaToPsi(r.corrected_kpa) - limitPsi) / -leak : null

  return (
    <>
      <dl className="mt-3 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-3">
        <Stat icon={Gauge} label="Pressure (now)">
          <Pressure kpa={r.pressure_kpa} />
        </Stat>
        <Stat icon={Gauge} label="Corrected to 20 °C">
          <Pressure kpa={r.corrected_kpa} />
        </Stat>
        <Stat icon={Thermometer} label="Temperature">
          <span className="font-semibold">{formatTemp(r.temp_c)}</span>
        </Stat>
        <Stat icon={TrendingDown} label="Leak rate (last 30 min)">
          {leak === null ? (
            <span className="text-navy-700">Not enough data</span>
          ) : leak < -0.5 ? (
            <span className="font-semibold text-critical">
              -{(-leak).toFixed(1)} psi/h
              {hoursToUnsafe !== null && (
                <span className="block text-xs">{hoursToUnsafe <= 0 ? 'Unsafe now' : `Unsafe in ~${Math.round(hoursToUnsafe)} h`}</span>
              )}
            </span>
          ) : (
            <span className="font-semibold text-green-700">No leak</span>
          )}
        </Stat>
        <Stat icon={Ruler} label="Tread depth (sample)">
          <span className="font-semibold">{extra ? `${extra.tread_mm} mm` : '-'}</span>
        </Stat>
        <Stat icon={BatteryMedium} label="Sensor battery (sample)">
          <span className="font-semibold">{extra ? `${extra.sensor_battery_pct}% · signal ${extra.signal}` : '-'}</span>
        </Stat>
      </dl>
      <p className="mt-2 text-xs text-navy-700">
        Recommended (cold): <Pressure kpa={tyre.recommended_cold_kpa} className="text-xs" /> · max {tyre.max_temp_c} °C · reading at{' '}
        {formatTimeIST(r.ts)} IST
      </p>
    </>
  )
}

function Stat({ icon: Icon, label, children }: { icon: typeof Gauge; label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <dt className="flex items-center gap-1 text-xs text-navy-700">
        <Icon size={12} aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

/** Critical first, then warning, then offline, then OK. */
function worstTyre(tyres: TyreWithStatus[]): TyreWithStatus | undefined {
  const rank = { critical: 0, warning: 1, offline: 2, ok: 3 }
  return [...tyres].sort((a, b) => rank[a.status] - rank[b.status])[0]
}
