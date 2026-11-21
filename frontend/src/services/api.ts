/*
 * THE ONLY PLACE THE APP GETS DATA FROM.
 *
 * Every page calls these functions. Each one matches an API endpoint (spec section 5),
 * written above it.
 *
 *   Supabase keys set  -> real FastAPI backend, with the owner's login token
 *   no Supabase keys   -> demo mode: made-up data from src/data/mock.ts
 */
import type {
  Alert,
  AlertThresholds,
  Booking,
  Driver,
  MonthReport,
  NewShipment,
  NotificationSettings,
  ShipmentEvent,
  TeamUser,
  Garage,
  MapLayers,
  NearbyGarage,
  Prediction,
  Reading,
  Shipment,
  TruckDetails,
  TruckSummary,
} from '../types'
import {
  mockAckAlert,
  mockResolveAlert,
  mockGetAlerts,
  mockGetGarages,
  mockGetNearestGarages,
  mockGetReadings,
  mockGetTrucks,
} from '../data/mock'
import {
  BOOKINGS,
  DEFAULT_PROFILE,
  DRIVERS,
  NOTIFICATIONS,
  PRICE_ESTIMATE,
  TEAM,
  THRESHOLDS,
  TYRE_COST_BY_BRAND,
  garageExtra,
  sampleReports,
  sampleScoreTrend,
  sampleTrips,
  MAP_LAYERS,
  PREDICTIONS,
  PROFILES,
  SHIPMENTS,
  sampleMaintenance,
  sampleParams,
  sampleTyreExtras,
} from '../data/ownerMock'
import { kpaToPsi } from '../lib/units'
import { kmAlong, plannedRoute, routeLengthKm, townsOnRoute, type LatLon } from '../lib/route'
import type { Candidate } from '../lib/dispatch'
import { truckHealth } from '../lib/status'
import type { AddOnId, PlanId } from '../data/plans'
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase'

/** True in demo mode. The UI shows a "Demo data" label when true. */
export const USING_MOCK_DATA = !SUPABASE_CONFIGURED

/**
 * Where the API lives. Empty = same website (Vercel), or the Vite dev proxy
 * to http://localhost:8000 when running `npm run dev` (see vite.config.ts).
 */
const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/$/, '')

/** Error with a message that's fine to show to the owner. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** Call the API with the logged-in owner's token. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError('Please log in again.', 401)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError('No connection to EcoStream. Check your internet.', 0)
  }

  if (res.status === 401) {
    await supabase!.auth.signOut() // sends the owner back to the login page
    throw new ApiError('Your login has expired. Please log in again.', 401)
  }
  if (!res.ok) {
    // FastAPI errors look like {"detail": "..."}
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : `Request failed (${res.status})`
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

/** Pretend network delay in demo mode, so loading states get exercised. */
const delay = <T>(value: T, ms = 150): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

// ---------------------------------------------------------------------------

/** GET /api/trucks - the owner's trucks with latest tyre status */
export async function getTrucks(): Promise<TruckSummary[]> {
  if (USING_MOCK_DATA) return delay(mockGetTrucks())
  return request('/api/trucks')
}

/** One truck. Uses GET /api/trucks (the spec has no single-truck endpoint). */
export async function getTruck(id: string): Promise<TruckSummary | null> {
  const trucks = await getTrucks()
  return trucks.find((t) => t.id === id) ?? null
}

/** GET /api/trucks/{id}/readings?from=&to= - history for charts */
export async function getReadings(truckId: string, from: Date, to: Date = new Date()): Promise<Reading[]> {
  if (USING_MOCK_DATA) return delay(mockGetReadings(truckId, from.toISOString(), to.toISOString()))
  const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  return request(`/api/trucks/${encodeURIComponent(truckId)}/readings?${q}`)
}

/** GET /api/alerts?open=true|false - leave `open` out for all alerts */
export async function getAlerts(open?: boolean): Promise<Alert[]> {
  if (USING_MOCK_DATA) return delay(mockGetAlerts(open))
  return request(open === undefined ? '/api/alerts' : `/api/alerts?open=${open}`)
}

/** POST /api/alerts/{id}/ack - acknowledge an alert */
export async function ackAlert(id: string): Promise<Alert> {
  if (USING_MOCK_DATA) return delay(mockAckAlert(id))
  return request(`/api/alerts/${encodeURIComponent(id)}/ack`, { method: 'POST' })
}

/** POST /api/alerts/{id}/resolve - the problem is fixed (also acknowledges) */
export async function resolveAlert(id: string): Promise<Alert> {
  if (USING_MOCK_DATA) return delay(mockResolveAlert(id))
  return request(`/api/alerts/${encodeURIComponent(id)}/resolve`, { method: 'POST' })
}

/** GET /api/garages/nearest?lat=&lon=&service=tyre - 3 nearest garages open now */
export async function getNearestGarages(lat: number, lon: number, service = 'tyre'): Promise<NearbyGarage[]> {
  if (USING_MOCK_DATA) return delay(mockGetNearestGarages(lat, lon, service))
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon), service })
  return request(`/api/garages/nearest?${q}`)
}

/* ------------------------------------------------------------------
 * Public website forms (stage W1).
 * There is no backend endpoint for these yet, so they are ALWAYS mocked
 * (even when Supabase is set up): nothing is sent or stored anywhere.
 * The pages show a "Demo" note. Later: replace the bodies with real
 * POST calls, e.g. POST /api/garage-signups and POST /api/contact.
 * ------------------------------------------------------------------ */

/** True while the public forms are not connected to a backend. */
export const PUBLIC_FORMS_MOCKED = true

export type GarageSignup = {
  garage_name: string
  contact_name: string
  phone: string
  city: string
  services: ('tyre' | 'air_brake' | 'engine')[]
  open_24x7: boolean
  notes?: string
}

export type ContactMessage = {
  name: string
  phone: string
  email?: string
  topic: 'demo' | 'question' | 'garage' | 'other'
  fleet_size?: string
  message: string
}

/** Pretend to send, then return a reference number the page can show. */
async function mockSubmit(prefix: string): Promise<{ reference: string }> {
  await new Promise((r) => setTimeout(r, 400))
  return { reference: `${prefix}-DEMO-${Math.floor(1000 + Math.random() * 9000)}` }
}

// Future: POST /api/garage-signups
export async function submitGarageSignup(_form: GarageSignup): Promise<{ reference: string }> {
  return mockSubmit('GAR')
}

// Future: POST /api/contact
export async function submitContact(_form: ContactMessage): Promise<{ reference: string }> {
  return mockSubmit('MSG')
}

/* ------------------------------------------------------------------
 * Owner portal (stage W3).
 * No backend yet for drivers, shipments, plans per truck, engine/brake/cargo
 * values, predictions or maintenance: these ALWAYS come from src/data/ownerMock.ts
 * (even with Supabase set up) and pages label them "Demo data".
 * Sample data is matched to trucks by registration number.
 * Future endpoints are written above each function.
 * ------------------------------------------------------------------ */

/** True while the owner-portal extras are sample data. */
export const OWNER_EXTRAS_MOCKED = true

/** Same threshold as api/alert_config.py critical_pressure_fraction. */
const CRITICAL_FRACTION = 0.8

const regToId = (trucks: TruckSummary[]) => new Map(trucks.map((t) => [t.reg_no, t.id]))

// Future: GET /api/drivers
export async function getDrivers(trucks: TruckSummary[]): Promise<Driver[]> {
  const ids = regToId(trucks)
  return delay(DRIVERS.map((d) => ({ ...d, truck_id: d.truck_id ? (ids.get(d.truck_id) ?? null) : null })))
}

// Future: GET /api/shipments
export async function getShipments(trucks: TruckSummary[]): Promise<Shipment[]> {
  const ids = regToId(trucks)
  return delay(SHIPMENTS.map((s) => ({ ...s, truck_id: s.truck_id ? (ids.get(s.truck_id) ?? null) : null })))
}

// Future: GET /api/garages (the API only has /nearest today)
export async function getAllGarages(): Promise<Garage[]> {
  return delay(mockGetGarages())
}

// Future: GET /api/map-layers
export async function getMapLayers(): Promise<MapLayers> {
  return delay(MAP_LAYERS)
}

/**
 * Tyre predictions worked out from the truck's open alerts and latest readings
 * (real data when Supabase is on). Costs are sample estimates.
 */
export function tyrePredictions(truck: TruckSummary, openAlerts: Alert[]): Prediction[] {
  const out: Prediction[] = []
  for (const a of openAlerts.filter((x) => x.truck_id === truck.id)) {
    const tyre = truck.tyres.find((t) => t.id === a.tyre_id)
    const pos = tyre?.position ?? 'tyre'
    const base = { id: `tp-${a.id}`, truck_id: truck.id, component: 'Tyres' as const, needs_garage: true }
    if (a.type === 'slow_leak' && tyre?.latest) {
      const limit = tyre.recommended_cold_kpa * CRITICAL_FRACTION
      const hours = a.value < 0 ? (tyre.latest.corrected_kpa - limit) / -a.value : Infinity
      const h = Math.max(0, Math.round(hours))
      out.push({
        ...base,
        issue: `${pos} tyre leaking ${kpaToPsi(-a.value).toFixed(1)} psi/hour`,
        risk: hours <= 6 ? 'high' : 'medium',
        window: Number.isFinite(hours) ? (h <= 0 ? 'Unsafe now' : `Unsafe in ~${h} h`) : 'Watch',
        confidence_pct: 85,
        action: 'Get the puncture or valve fixed at the nearest open garage.',
        cost_if_ignored: 45_000,
        cost_now: 500,
      })
    } else if (a.type === 'critical_pressure' || a.type === 'low_pressure') {
      const critical = a.type === 'critical_pressure'
      out.push({
        ...base,
        issue: `${pos} tyre pressure ${critical ? 'dangerously ' : ''}low`,
        risk: critical ? 'high' : 'medium',
        window: critical ? 'Unsafe now' : 'Top up today',
        confidence_pct: 95,
        action: critical ? 'Stop safely and inspect the tyre. Do not drive far.' : 'Inflate to the recommended pressure and check for a leak.',
        cost_if_ignored: critical ? 60_000 : 20_000,
        cost_now: critical ? 1_500 : 200,
      })
    } else if (a.type === 'high_temp') {
      out.push({
        ...base,
        issue: `${pos} tyre running hot, pressure normal`,
        risk: 'medium',
        window: 'Check today',
        confidence_pct: 70,
        action: 'Check the brake and wheel bearing on that wheel.',
        cost_if_ignored: 40_000,
        cost_now: 3_000,
      })
    } else if (a.type === 'sensor_offline') {
      out.push({
        ...base,
        issue: `${pos} sensor not reporting`,
        risk: 'low',
        window: 'Check at next stop',
        confidence_pct: 90,
        action: 'Check the sensor battery or signal. The tyre itself may be fine.',
        cost_if_ignored: 0,
        cost_now: 0,
        needs_garage: false,
      })
    }
  }
  return out
}

/** Engine and brake data come from the truck's CAN bus, which the Lite plan doesn't read. */
const NEEDS_PRO: Prediction['component'][] = ['Engine', 'Brakes']

/**
 * Tyre predictions (from alerts) + other sample predictions, worst first.
 * Only predictions the truck's plan has data for: no engine predictions on Lite.
 */
export function predictionsFor(truck: TruckSummary, openAlerts: Alert[]): Prediction[] {
  const rank = { high: 0, medium: 1, low: 2 }
  const plan = (PROFILES[truck.reg_no] ?? DEFAULT_PROFILE).plan
  const other = (PREDICTIONS[truck.reg_no] ?? [])
    .filter((p) => plan !== 'lite' || !NEEDS_PRO.includes(p.component))
    .map((p, i) => ({ ...p, id: `p-${truck.id}-${i}`, truck_id: truck.id }))
  return [...tyrePredictions(truck, openAlerts), ...other].sort((a, b) => rank[a.risk] - rank[b.risk])
}

// Future: GET /api/trucks/{id}/details
export async function getTruckDetails(truck: TruckSummary, openAlerts: Alert[]): Promise<TruckDetails> {
  const seed = PROFILES[truck.reg_no] ?? DEFAULT_PROFILE
  const driverRow = DRIVERS.find((d) => d.id === seed.driver_id) ?? null
  const shipmentRow = SHIPMENTS.find((s) => s.id === seed.shipment_id) ?? null
  const m = sampleMaintenance(truck.reg_no)
  return delay({
    profile: { ...seed, truck_id: truck.id },
    driver: driverRow ? { ...driverRow, truck_id: truck.id } : null,
    shipment: shipmentRow ? { ...shipmentRow, truck_id: truck.id } : null,
    params: sampleParams(truck.reg_no, { driverName: driverRow?.name ?? null, odometerKm: seed.odometer_km }),
    tyres: sampleTyreExtras(truck.reg_no, truck.tyres.map((t) => t.position)),
    predictions: predictionsFor(truck, openAlerts),
    service_history: m.history,
    upcoming: m.upcoming,
    documents: m.documents,
  })
}

/** Plan of each truck (for the Trucks list badge). Future: part of GET /api/trucks */
export function planOf(truck: TruckSummary) {
  return (PROFILES[truck.reg_no] ?? DEFAULT_PROFILE).plan
}

/** Plan, driver and shipment per truck, for lists. */
export function truckExtrasFor(truck: TruckSummary) {
  const seed = PROFILES[truck.reg_no] ?? DEFAULT_PROFILE
  return {
    plan: seed.plan,
    driver: DRIVERS.find((d) => d.id === seed.driver_id) ?? null,
    shipmentId: seed.shipment_id,
    nextService: seed.next_service,
  }
}

/** One line in "upcoming maintenance" on the dashboard. */
export interface UpcomingItem {
  truck: TruckSummary
  date: string
  title: string
}

// Future: GET /api/maintenance/upcoming?days=7
export function upcomingMaintenance(trucks: TruckSummary[], days = 7): UpcomingItem[] {
  const limit = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
  const items: UpcomingItem[] = []
  for (const truck of trucks) {
    const seed = PROFILES[truck.reg_no]
    if (seed && seed.next_service.date <= limit) items.push({ truck, date: seed.next_service.date, title: `Service: ${seed.next_service.what}` })
    for (const d of sampleMaintenance(truck.reg_no).documents) {
      if (d.due <= limit) items.push({ truck, date: d.due, title: `${d.name} renewal` })
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Dashboard money numbers (sample assumption, shown as an estimate):
 * each problem the owner acted on before it became a breakdown counts as one
 * breakdown avoided, worth AVOIDED_BREAKDOWN_RUPEES.
 */
export const AVOIDED_BREAKDOWN_RUPEES = 25_000

export function breakdownsAvoidedThisMonth(allAlerts: Alert[], now = new Date()): number {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return allAlerts.filter(
    (a) =>
      a.acknowledged_at &&
      new Date(a.created_at).getTime() >= monthStart &&
      (a.severity === 'critical' || a.type === 'slow_leak'),
  ).length
}

/* ------------------------------------------------------------------
 * Owner portal part 2 (stage W4). All sample data, kept in memory for this
 * browser tab (nothing is saved to a server). Pages label it "Demo data".
 * ------------------------------------------------------------------ */

const regOf = (trucks: TruckSummary[], id: string | null) => trucks.find((t) => t.id === id)?.reg_no ?? null

// Future: GET /api/bookings
export async function getBookings(trucks: TruckSummary[]): Promise<Booking[]> {
  const ids = regToId(trucks)
  return delay(BOOKINGS.map((b) => ({ ...b, truck_id: ids.get(b.truck_id) ?? b.truck_id })).sort((a, b) => b.slot.localeCompare(a.slot)))
}

// Future: POST /api/bookings
export async function bookGarage(
  trucks: TruckSummary[],
  input: { truck_id: string; alert_id: string | null; garage: Garage; slot: string; what: string },
): Promise<Booking> {
  const booking: Booking = {
    id: `BK-${2001 + BOOKINGS.length}`,
    truck_id: regOf(trucks, input.truck_id) ?? input.truck_id,
    alert_id: input.alert_id,
    garage_id: input.garage.id,
    garage_name: input.garage.name,
    garage_phone: input.garage.phone,
    slot: input.slot,
    what: input.what,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  }
  BOOKINGS.push(booking)
  return delay({ ...booking, truck_id: input.truck_id })
}

// Future: GET /api/shipments/{id}
export async function getShipment(trucks: TruckSummary[], id: string): Promise<Shipment | null> {
  return (await getShipments(trucks)).find((s) => s.id === id) ?? null
}

// Future: POST /api/shipments
export async function createShipment(trucks: TruckSummary[], input: NewShipment): Promise<Shipment> {
  const n = 1000 + SHIPMENTS.filter((s) => s.id.startsWith('SHP-1')).length + 1
  const route = plannedRoute([input.sender.lat, input.sender.lon], [input.receiver.lat, input.receiver.lon])
  const row: Shipment = {
    id: `SHP-${n}`,
    sender: input.sender,
    receiver: input.receiver,
    goods: input.cold_chain ? `${input.goods} (chilled)` : input.goods,
    weight_t: input.weight_t,
    truck_id: regOf(trucks, input.truck_id),
    driver_id: input.driver_id,
    status: 'scheduled',
    pickup_at: input.pickup_at,
    // Rough ETA: 45 km/h average on this corridor (sample assumption)
    eta: new Date(new Date(input.pickup_at).getTime() + (routeLengthKm(route) / 45) * 3_600_000).toISOString(),
    distance_left_km: Math.round(routeLengthKm(route)),
  }
  SHIPMENTS.push(row)
  return delay({ ...row, truck_id: input.truck_id })
}

/** Planned route, where the truck is on it, and km left. */
export function shipmentRoute(s: Shipment, truck: TruckSummary | undefined) {
  const route = plannedRoute([s.sender.lat, s.sender.lon], [s.receiver.lat, s.receiver.lon])
  const total = routeLengthKm(route)
  const moving = s.status === 'in_transit' || s.status === 'delayed'
  const at: LatLon | null = moving && truck?.lat != null && truck.lon != null ? [truck.lat, truck.lon] : null
  const done = s.status === 'delivered' ? total : at ? kmAlong(route, at) : 0
  return { route, totalKm: total, doneKm: done, leftKm: Math.max(0, total - done), truckAt: at, towns: townsOnRoute(route) }
}

/** Timeline: created, picked up, towns passed, alerts on the way, delivered. Sample + real alerts. */
export function shipmentEvents(s: Shipment, truck: TruckSummary | undefined, alerts: Alert[]): ShipmentEvent[] {
  const ev: ShipmentEvent[] = []
  const pickup = new Date(s.pickup_at).getTime()
  ev.push({ ts: new Date(pickup - 20 * 3_600_000).toISOString(), kind: 'created', text: `Shipment ${s.id} created` })
  if (s.status === 'scheduled') return ev
  ev.push({ ts: s.pickup_at, kind: 'picked_up', text: `Picked up at ${s.sender.name}, ${s.sender.city}` })
  const { route, towns, doneKm, totalKm } = shipmentRoute(s, truck)
  const now = Date.now()
  const end = s.status === 'delivered' && s.eta ? new Date(s.eta).getTime() : now
  towns.slice(1, -1).forEach((town) => {
    const km = kmAlong(route, route.find((p) => townsOnRoute([p])[0] === town)!)
    if (km <= doneKm) ev.push({ ts: new Date(pickup + (end - pickup) * (km / Math.max(doneKm, 1))).toISOString(), kind: 'checkpoint', text: `Crossed ${town}` })
  })
  for (const a of alerts.filter((x) => x.truck_id === truck?.id && new Date(x.created_at).getTime() >= pickup)) {
    ev.push({ ts: a.created_at, kind: 'alert', text: a.message })
  }
  if (s.status === 'delivered' && s.eta) ev.push({ ts: s.eta, kind: 'delivered', text: `Delivered to ${s.receiver.name} (${Math.round(totalKm)} km)` })
  return ev.sort((a, b) => a.ts.localeCompare(b.ts))
}

/** Every truck as a dispatch candidate (see src/lib/dispatch.ts). */
export function dispatchCandidates(trucks: TruckSummary[], shipments: Shipment[], drivers: Driver[]): Candidate[] {
  return trucks.map((truck) => {
    const seed = PROFILES[truck.reg_no] ?? DEFAULT_PROFILE
    const current = shipments.find((s) => s.truck_id === truck.id && s.status !== 'delivered' && s.status !== 'scheduled')
    return {
      truck,
      health: truckHealth(truck),
      addOns: seed.add_ons,
      driver: drivers.find((d) => d.id === seed.driver_id) ?? null,
      busyUntil: current?.eta ?? null,
      startsAt: current ? [current.receiver.lat, current.receiver.lon] : truck.lat != null && truck.lon != null ? [truck.lat, truck.lon] : null,
    }
  })
}

// Future: PATCH /api/trucks/{id}/plan
export async function setTruckPlan(truck: TruckSummary, plan: PlanId, addOns: AddOnId[]): Promise<void> {
  const seed = PROFILES[truck.reg_no] ?? (PROFILES[truck.reg_no] = { ...DEFAULT_PROFILE })
  seed.plan = plan
  seed.add_ons = addOns
  return delay(undefined)
}

export function planDetails(truck: TruckSummary): { plan: PlanId; addOns: AddOnId[] } {
  const seed = PROFILES[truck.reg_no] ?? DEFAULT_PROFILE
  return { plan: seed.plan, addOns: [...seed.add_ons] }
}

// Future: GET/POST /api/team
export async function getTeam(): Promise<TeamUser[]> {
  return delay(TEAM.map((u) => ({ ...u })))
}
export async function addTeamUser(u: Omit<TeamUser, 'id'>): Promise<TeamUser> {
  const row = { ...u, id: `u-${TEAM.length + 1}` }
  TEAM.push(row)
  return delay(row)
}

// Future: GET/PUT /api/settings (thresholds would also need api/alert_config.py to read them)
export async function getSettings(): Promise<{ thresholds: AlertThresholds; notifications: NotificationSettings }> {
  return delay({ thresholds: { ...THRESHOLDS }, notifications: { ...NOTIFICATIONS } })
}
export async function saveSettings(thresholds: AlertThresholds, notifications: NotificationSettings): Promise<void> {
  Object.assign(THRESHOLDS, thresholds)
  Object.assign(NOTIFICATIONS, notifications)
  return delay(undefined)
}

// Future: GET /api/reports?months=6
export async function getReports(): Promise<MonthReport[]> {
  return delay(sampleReports())
}

/** Sample rating / jobs done for a (fictional) garage. Future: part of GET /api/garages */
export const garageInfo = garageExtra

/** Sample price range for the job an alert needs. */
export const priceFor = (type: Alert['type']) => PRICE_ESTIMATE[type]

/** Driver trip history and score trend (sample). Future: GET /api/drivers/{id}/trips */
export const driverTrips = sampleTrips
export const driverScoreTrend = sampleScoreTrend
/** Tyre cost per km by brand (sample). Future: part of GET /api/reports */
export const tyreCostByBrand = () => TYRE_COST_BY_BRAND

/** Where "Book garage" goes: the alert's own page (with the 3 nearest garages), else the Garages page. */
export function bookGarageHref(p: Prediction): string {
  return p.id.startsWith('tp-') ? `/owner/alerts/${p.id.slice(3)}` : '/owner/garages'
}
