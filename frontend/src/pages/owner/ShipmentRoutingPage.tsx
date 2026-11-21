import { Suspense, lazy, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  CircleDot,
  Copy,
  Flag,
  Mountain,
  PenLine,
  Phone,
  Route as RouteIcon,
  WifiOff,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useOwnerData } from '../../hooks/useOwnerData'
import { getAllGarages, getDrivers, getMapLayers, getShipment, shipmentEvents, shipmentRoute } from '../../services/api'
import { kmAlong, kmFromRoute, type LatLon } from '../../lib/route'
import { Card, CardTitle, DemoTag, ShipmentBadge, shortTime } from '../../components/owner/ui'
import { MapLegend } from '../../components/owner/mapStyle'
import { ErrorBox, Loading } from '../../components/PageState'
import StatusBadge from '../../components/StatusBadge'
import { truckHealth } from '../../lib/status'
import type { Garage, MapLayers, ShipmentEvent } from '../../types'

const FleetMap = lazy(() => import('../../components/owner/FleetMap'))

/*
 * Shipment live routing (docs/WEBSITE_SPEC.md section 2.8): route map from sender to receiver
 * with the truck's live position, ETA, distance left, stops; warnings ahead (ghat, no signal,
 * bad road, last verified garage before the ghat); timeline; proof of delivery; share link.
 *
 * Truck position and its alerts are real data. The shipment, route (corridor waypoints,
 * no routing service yet) and route warnings are sample data.
 */

const NEAR_ROUTE_KM = 6

type Warning = { km: number; kind: 'ghat' | 'dead_zone' | 'bad_road'; name: string }

function warningsAhead(route: LatLon[], doneKm: number, layers: MapLayers): Warning[] {
  const out: Warning[] = []
  const check = (kind: Warning['kind'], paths: MapLayers['ghats']) => {
    for (const p of paths) {
      const near = p.points.filter((pt) => kmFromRoute(route, pt) <= NEAR_ROUTE_KM)
      if (!near.length) continue
      const km = Math.min(...near.map((pt) => kmAlong(route, pt)))
      if (km > doneKm) out.push({ km, kind, name: p.name })
    }
  }
  check('ghat', layers.ghats)
  check('dead_zone', layers.dead_zones)
  check('bad_road', layers.bad_roads)
  return out.sort((a, b) => a.km - b.km)
}

/** The last verified garage near the route before a given km (e.g. before a ghat). */
function lastGarageBefore(route: LatLon[], fromKm: number, beforeKm: number, garages: Garage[]) {
  let best: { g: Garage; km: number } | null = null
  for (const g of garages.filter((x) => x.verified)) {
    const p: LatLon = [g.lat, g.lon]
    if (kmFromRoute(route, p) > NEAR_ROUTE_KM) continue
    const km = kmAlong(route, p)
    if (km >= fromKm && km < beforeKm && (!best || km > best.km)) best = { g, km }
  }
  return best
}

export default function ShipmentRoutingPage() {
  const { id = '' } = useParams()
  const created = (useLocation().state as { created?: boolean; notified?: boolean } | null) ?? {}
  const { trucks, openAlerts, loading, error, reload } = useOwnerData()
  const shipQ = useApi(() => (trucks ? getShipment(trucks, id) : Promise.resolve(null)), [trucks, id])
  const driversQ = useApi(() => (trucks ? getDrivers(trucks) : Promise.resolve([])), [trucks])
  const layersQ = useApi(getMapLayers, [])
  const garagesQ = useApi(getAllGarages, [])
  const [copied, setCopied] = useState(false)

  const s = shipQ.data
  const truck = trucks?.find((tr) => tr.id === s?.truck_id)
  const info = useMemo(() => (s ? shipmentRoute(s, truck) : null), [s, truck])
  const warnings = useMemo(() => (info && layersQ.data ? warningsAhead(info.route, info.doneKm, layersQ.data) : []), [info, layersQ.data])
  const firstGhat = warnings.find((w) => w.kind === 'ghat')
  const garageBeforeGhat = info && firstGhat && garagesQ.data ? lastGarageBefore(info.route, info.doneKm, firstGhat.km, garagesQ.data) : null

  if ((loading && !trucks) || (shipQ.loading && !s)) return <Loading what="shipment" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!s || !info)
    return (
      <p className="py-10 text-center">
        Shipment not found.{' '}
        <Link to="/owner/shipments" className="font-semibold text-green-700">
          Back to shipments
        </Link>
      </p>
    )

  const driver = driversQ.data?.find((d) => d.id === s.driver_id)
  const events = shipmentEvents(s, truck, openAlerts ?? [])
  const speedKmh = 45 // sample average for the ETA
  const eta = s.status === 'in_transit' || s.status === 'delayed' ? new Date(Date.now() + (info.leftKm / speedKmh) * 3_600_000).toISOString() : s.eta
  const trackUrl = `${window.location.origin}${import.meta.env.BASE_URL}shipper/track/${s.id}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(trackUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <Link to="/owner/shipments" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
        <ArrowLeft size={16} aria-hidden /> Shipments
      </Link>

      {created.created && (
        <p role="status" className="mt-2 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-500/30">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          Shipment {s.id} created{created.notified ? ' and the shipper notified (demo: no message really sent)' : ''}.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {s.id}: {s.sender.city} → {s.receiver.city}
          </h1>
          <p className="text-sm text-navy-700">
            {s.goods} · {s.weight_t} t · pickup {shortTime(s.pickup_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShipmentBadge status={s.status} />
          <DemoTag />
        </div>
      </div>

      {/* Numbers */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ETA" value={shortTime(eta)} />
        <Stat label="Distance left" value={`${Math.round(info.leftKm)} km`} />
        <Stat label="Route length" value={`${Math.round(info.totalKm)} km`} />
        <Stat label="Truck" value={truck?.reg_no ?? 'Not assigned'} extra={truck ? <StatusBadge status={truckHealth(truck)} /> : null} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-2 sm:p-3">
          <Suspense fallback={<div className="flex h-[50vh] items-center justify-center rounded-lg bg-gray-100 text-sm">Loading map…</div>}>
            <FleetMap
              trucks={truck && info.truckAt ? [truck] : []}
              route={info.route}
              garages={garagesQ.data ?? []}
              layers={layersQ.data ?? undefined}
              show={{ garages: true, ghats: true, dead_zones: true, bad_roads: true }}
              selectedId={truck?.id}
              className="h-[50vh] min-h-[300px]"
            />
          </Suspense>
          <MapLegend show={{ garages: true, ghats: true, dead_zones: true, bad_roads: true }} />
          <p className="mt-1 text-xs text-navy-700">
            Dashed line: planned route through the corridor towns (no road-routing service yet). ETA assumes {speedKmh} km/h on average.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Warnings on the route ahead</CardTitle>
            {s.status === 'delivered' ? (
              <p className="text-sm text-navy-700">Trip finished.</p>
            ) : warnings.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 size={16} aria-hidden /> No known risks on the rest of the route.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {warnings.map((w) => (
                  <li key={w.name} className="flex items-start gap-2">
                    {w.kind === 'ghat' ? (
                      <Mountain size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                    ) : w.kind === 'dead_zone' ? (
                      <WifiOff size={18} className="mt-0.5 shrink-0 text-gray-500" aria-hidden />
                    ) : (
                      <TriangleAlert size={18} className="mt-0.5 shrink-0 text-critical" aria-hidden />
                    )}
                    <span>
                      <span className="font-semibold">
                        {w.kind === 'ghat' ? 'Ghat ahead' : w.kind === 'dead_zone' ? 'No signal ahead' : 'Bad road ahead'}
                      </span>{' '}
                      in ~{Math.max(1, Math.round(w.km - info.doneKm))} km
                      <span className="block text-xs text-navy-700">{w.name}</span>
                    </span>
                  </li>
                ))}
                {firstGhat && (
                  <li className="flex items-start gap-2 rounded-lg bg-green-50 p-2">
                    <BadgeCheck size={18} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
                    <span>
                      <span className="font-semibold">Last verified garage before the ghat: </span>
                      {garageBeforeGhat ? (
                        <>
                          {garageBeforeGhat.g.name}, in ~{Math.max(1, Math.round(garageBeforeGhat.km - info.doneKm))} km
                          {garageBeforeGhat.g.open_24x7 ? ' (open 24×7)' : ''}
                        </>
                      ) : (
                        'none between here and the ghat'
                      )}
                    </span>
                  </li>
                )}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Stops</CardTitle>
            <ol className="space-y-2 text-sm">
              <Stop icon={CircleDot} title={s.sender.name} sub={`${s.sender.address} · ${s.sender.contact}`} phone={s.sender.phone} />
              {info.towns.slice(1, -1).map((town) => (
                <li key={town} className="ml-7 text-xs text-navy-700">
                  via {town}
                </li>
              ))}
              <Stop icon={Flag} title={s.receiver.name} sub={`${s.receiver.address} · ${s.receiver.contact}`} phone={s.receiver.phone} />
            </ol>
            {driver && (
              <p className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-sm">
                <span>
                  <Truck size={14} className="mr-1 inline" aria-hidden />
                  Driver <span className="font-semibold">{driver.name}</span>
                </span>
                <a href={`tel:${driver.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-semibold text-green-700">
                  <Phone size={14} aria-hidden /> Call
                </a>
              </p>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Timeline</CardTitle>
          <Timeline events={events} />
        </Card>
        <div className="space-y-4">
          <Card>
            <CardTitle>Proof of delivery</CardTitle>
            {s.status === 'delivered' ? (
              <div className="grid grid-cols-2 gap-2">
                <Placeholder icon={Camera} text="Photo of goods (placeholder)" />
                <Placeholder icon={PenLine} text="Receiver’s signature (placeholder)" />
              </div>
            ) : (
              <p className="text-sm text-navy-700">The driver adds a photo and the receiver’s signature at delivery.</p>
            )}
          </Card>
          <Card>
            <CardTitle>Share tracking with the shipper</CardTitle>
            <p className="break-all rounded bg-gray-50 p-2 font-mono text-xs">{trackUrl}</p>
            <button onClick={copyLink} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-navy-900/20 px-3 py-2 text-sm font-semibold hover:bg-green-50">
              <Copy size={16} aria-hidden /> {copied ? 'Copied' : 'Copy link'}
            </button>
            <p className="mt-1 text-xs text-navy-700">The shipper opens it after logging in as a shipper.</p>
          </Card>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
      <p className="text-xs font-semibold text-navy-700">{label}</p>
      <p className="font-heading text-lg font-extrabold">{value}</p>
      {extra}
    </div>
  )
}

function Stop({ icon: Icon, title, sub, phone }: { icon: typeof Flag; title: string; sub: string; phone: string }) {
  return (
    <li className="flex items-start gap-2">
      <Icon size={18} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-navy-700">{sub}</span>
      </span>
      <a href={`tel:${phone.replace(/\s/g, '')}`} className="rounded-lg p-1.5 text-green-700 hover:bg-green-50" aria-label={`Call ${title}`}>
        <Phone size={16} aria-hidden />
      </a>
    </li>
  )
}

const EVENT_ICON: Record<ShipmentEvent['kind'], typeof Flag> = {
  created: CircleDot,
  picked_up: Truck,
  checkpoint: RouteIcon,
  alert: AlertTriangle,
  delivered: CheckCircle2,
}

function Timeline({ events }: { events: ShipmentEvent[] }) {
  return (
    <ol className="relative ml-2 border-l-2 border-gray-200">
      {events.map((e, i) => {
        const Icon = EVENT_ICON[e.kind]
        return (
          <li key={i} className="mb-4 ml-5 last:mb-0">
            <span
              className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
                e.kind === 'alert' ? 'bg-amber-50 text-amber-800' : e.kind === 'delivered' ? 'bg-green-700 text-white' : 'bg-green-50 text-green-700'
              }`}
            >
              <Icon size={14} aria-hidden />
            </span>
            <p className="text-sm font-semibold">{e.text}</p>
            <p className="text-xs text-navy-700">{shortTime(e.ts)}</p>
          </li>
        )
      })}
    </ol>
  )
}

function Placeholder({ icon: Icon, text }: { icon: typeof Camera; text: string }) {
  return (
    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-2 text-center text-xs text-navy-700">
      <Icon size={22} aria-hidden /> {text}
    </div>
  )
}
