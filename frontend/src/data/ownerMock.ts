/*
 * OWNER PORTAL SAMPLE DATA (website stage W3). Everything here is FICTIONAL.
 *
 * There is no backend for plans per truck, drivers, shipments, engine / brake / cargo
 * values, predictions or maintenance yet. Pages get this data through src/services/api.ts
 * and show a "Demo data" label. When the backend exists, only api.ts changes.
 *
 * Linked to the tyre mock (src/data/mock.ts) by registration number, so it also works
 * for the two seeded trucks in the real database (TN 99 ZZ 0001 / 0002).
 *
 * Names are common Tamil names, phone numbers are +91 90000 1xxxx (not real),
 * companies are "Sample ..." on the Chennai - Krishnagiri - Salem - Namakkal corridor.
 */
import type {
  ComplianceDoc,
  Driver,
  MaintenanceItem,
  MapLayers,
  ParamStatus,
  ParamValue,
  Place,
  Prediction,
  Shipment,
  TruckProfile,
  TyreExtra,
} from '../types'
import { PARAMS } from './plans'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
const isoIn = (ms: number) => new Date(NOW + ms).toISOString()
const dateIn = (days: number) => new Date(NOW + days * DAY).toISOString().slice(0, 10)

/** Small seeded random numbers, so the demo looks the same on every load. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------

export const DRIVERS: Driver[] = [
  { id: 'drv-1', name: 'Murugan K.', phone: '+91 90000 10001', licence_expiry: dateIn(410), score: 78, availability: 'on_trip', truck_id: 'TN 99 ZZ 0001' },
  { id: 'drv-2', name: 'Senthil Kumar R.', phone: '+91 90000 10002', licence_expiry: dateIn(25), score: 86, availability: 'on_trip', truck_id: 'TN 99 ZZ 0002' },
  { id: 'drv-3', name: 'Arumugam P.', phone: '+91 90000 10003', licence_expiry: dateIn(730), score: 91, availability: 'on_trip', truck_id: 'TN 99 ZZ 0003' },
  { id: 'drv-4', name: 'Karthik S.', phone: '+91 90000 10004', licence_expiry: dateIn(190), score: 64, availability: 'on_trip', truck_id: 'TN 99 ZZ 0004' },
  { id: 'drv-5', name: 'Velu M.', phone: '+91 90000 10005', licence_expiry: dateIn(300), score: 88, availability: 'on_trip', truck_id: 'TN 99 ZZ 0005' },
  { id: 'drv-6', name: 'Rajesh Kannan T.', phone: '+91 90000 10006', licence_expiry: dateIn(95), score: 81, availability: 'available', truck_id: null },
  { id: 'drv-7', name: 'Ganesan V.', phone: '+91 90000 10007', licence_expiry: dateIn(540), score: 73, availability: 'off', truck_id: null },
]
// Note: truck_id above holds the registration number; api.ts swaps in the truck's real id.

// ---------------------------------------------------------------------
// Shipments (a few, for the Overview tab and the dashboard; stage W4 adds the full pages)
// ---------------------------------------------------------------------

const PLACES: Record<string, Place> = {
  chennai: { name: 'Sample Textiles (Chennai)', city: 'Chennai', address: 'Plot 12, Sample Industrial Estate, Ambattur, Chennai', contact: 'Priya S.', phone: '+91 90000 20001', lat: 13.1143, lon: 80.1548 },
  sriperumbudur: { name: 'Sample Auto Parts', city: 'Sriperumbudur', address: 'Unit 4, Sample SEZ, Sriperumbudur', contact: 'Ramesh N.', phone: '+91 90000 20002', lat: 12.9675, lon: 79.9419 },
  vellore: { name: 'Sample Leather Works', city: 'Vellore', address: '7 Sample Road, Sathuvachari, Vellore', contact: 'Fathima B.', phone: '+91 90000 20003', lat: 12.9165, lon: 79.1325 },
  krishnagiri: { name: 'Sample Mango Pulp Co.', city: 'Krishnagiri', address: '21 Sample Nagar, Krishnagiri', contact: 'Anand R.', phone: '+91 90000 20004', lat: 12.5186, lon: 78.2137 },
  salem: { name: 'Sample Steel Traders', city: 'Salem', address: '3 Sample Street, Suramangalam, Salem', contact: 'Lakshmi V.', phone: '+91 90000 20005', lat: 11.6643, lon: 78.146 },
  namakkal: { name: 'Sample Poultry Feeds', city: 'Namakkal', address: '9 Sample Main Road, Namakkal', contact: 'Saravanan K.', phone: '+91 90000 20006', lat: 11.2189, lon: 78.1674 },
}

/** truck_id / driver_id hold registration number / driver id; api.ts maps them. */
export const SHIPMENTS: Shipment[] = [
  { id: 'SHP-1001', sender: PLACES.chennai, receiver: PLACES.krishnagiri, goods: 'Cotton fabric rolls', weight_t: 9.5, truck_id: 'TN 99 ZZ 0001', driver_id: 'drv-1', status: 'in_transit', pickup_at: isoIn(-2.3 * 60 * 60e3), eta: isoIn(3.6 * 60 * 60e3), distance_left_km: 168 },
  { id: 'SHP-1002', sender: PLACES.sriperumbudur, receiver: PLACES.salem, goods: 'Auto parts (boxed)', weight_t: 14, truck_id: 'TN 99 ZZ 0002', driver_id: 'drv-2', status: 'in_transit', pickup_at: isoIn(-2.6 * 60 * 60e3), eta: isoIn(3.1 * 60 * 60e3), distance_left_km: 152 },
  { id: 'SHP-1003', sender: PLACES.salem, receiver: PLACES.namakkal, goods: 'Steel rods', weight_t: 21, truck_id: 'TN 99 ZZ 0003', driver_id: 'drv-3', status: 'in_transit', pickup_at: isoIn(-1.6 * 60 * 60e3), eta: isoIn(0.7 * 60 * 60e3), distance_left_km: 22 },
  { id: 'SHP-1004', sender: PLACES.vellore, receiver: PLACES.salem, goods: 'Finished leather', weight_t: 12, truck_id: 'TN 99 ZZ 0004', driver_id: 'drv-4', status: 'delayed', pickup_at: isoIn(-3.4 * 60 * 60e3), eta: isoIn(4.5 * 60 * 60e3), distance_left_km: 96 },
  { id: 'SHP-1005', sender: PLACES.chennai, receiver: PLACES.namakkal, goods: 'Chilled dairy (2-8 °C)', weight_t: 18, truck_id: 'TN 99 ZZ 0005', driver_id: 'drv-5', status: 'in_transit', pickup_at: isoIn(-0.8 * 60 * 60e3), eta: isoIn(7.2 * 60 * 60e3), distance_left_km: 352 },
  { id: 'SHP-1006', sender: PLACES.krishnagiri, receiver: PLACES.chennai, goods: 'Mango pulp cans', weight_t: 10, truck_id: null, driver_id: null, status: 'scheduled', pickup_at: isoIn(20 * 60 * 60e3), eta: null, distance_left_km: null },
]

// ---------------------------------------------------------------------
// Plan, driver and service per truck (keyed by registration number)
// ---------------------------------------------------------------------

type ProfileSeed = Omit<TruckProfile, 'truck_id'>
export const PROFILES: Record<string, ProfileSeed> = {
  'TN 99 ZZ 0001': { plan: 'lite', add_ons: [], driver_id: 'drv-1', shipment_id: 'SHP-1001', odometer_km: 184_300, next_service: { date: dateIn(12), km: 190_000, what: 'Oil + filters' } },
  'TN 99 ZZ 0002': { plan: 'pro', add_ons: [], driver_id: 'drv-2', shipment_id: 'SHP-1002', odometer_km: 96_450, next_service: { date: dateIn(4), km: 100_000, what: 'Brake check + oil' } },
  'TN 99 ZZ 0003': { plan: 'pro', add_ons: ['fuel_monitoring'], driver_id: 'drv-3', shipment_id: 'SHP-1003', odometer_km: 142_900, next_service: { date: dateIn(9), km: 145_000, what: 'Oil + filters' } },
  'TN 99 ZZ 0004': { plan: 'lite', add_ons: [], driver_id: 'drv-4', shipment_id: 'SHP-1004', odometer_km: 233_100, next_service: { date: dateIn(2), km: 235_000, what: 'Tyre rotation + alignment' } },
  'TN 99 ZZ 0005': { plan: 'fleet', add_ons: ['cold_chain', 'cargo_security', 'wheel_end_temp', 'driver_safety'], driver_id: 'drv-5', shipment_id: 'SHP-1005', odometer_km: 58_200, next_service: { date: dateIn(21), km: 60_000, what: 'First major service' } },
  'TN 99 ZZ 0006': { plan: 'lite', add_ons: [], driver_id: null, shipment_id: null, odometer_km: 301_700, next_service: { date: dateIn(6), km: 302_500, what: 'Battery + oil' } },
}

export const DEFAULT_PROFILE: ProfileSeed = {
  plan: 'lite',
  add_ons: [],
  driver_id: null,
  shipment_id: null,
  odometer_km: 0,
  next_service: { date: dateIn(30), km: 0, what: 'Not planned yet' },
}

// ---------------------------------------------------------------------
// Live values for the parameter cards (Engine, Brakes, Power, Driver, Cargo ...)
// ---------------------------------------------------------------------

/** How to make a sample value for one parameter key. */
type NumSpec = {
  base: number
  spread: number
  unit: string
  dec?: number
  normal?: string
  /** warning when below / above */
  lo?: number
  hi?: number
  detail?: string
}
type TextSpec = { text: string; detail?: string; status?: ParamStatus }

const NUM: Record<string, NumSpec> = {
  gradient: { base: 2.1, spread: 0.8, unit: '%', dec: 1, normal: 'up to 6 %', detail: 'altitude 210 m' },
  cell_signal: { base: -78, spread: 5, unit: 'dBm', normal: 'better than -100 dBm', lo: -100, detail: '4G · 3 of 4 bars' },
  ambient_temp: { base: 30, spread: 1.5, unit: '°C', dec: 0 },
  battery_voltage: { base: 27.4, spread: 0.2, unit: 'V', dec: 1, normal: '26-28.8 V', lo: 25.5 },
  battery_health: { base: 19.6, spread: 0.2, unit: 'V', dec: 1, normal: 'above 18 V', lo: 18, detail: 'lowest voltage at last start' },
  coolant_temp: { base: 88, spread: 2, unit: '°C', normal: '80-95 °C', hi: 98 },
  oil_pressure: { base: 380, spread: 20, unit: 'kPa', normal: '250-550 kPa', lo: 200 },
  oil_temp: { base: 98, spread: 3, unit: '°C', normal: '85-110 °C', hi: 115 },
  engine_rpm: { base: 1450, spread: 120, unit: 'rpm', normal: 'economy band 1200-1800' },
  engine_load: { base: 62, spread: 8, unit: '%', normal: 'under 85 %', hi: 90, detail: 'accelerator 48 %' },
  intake_boost: { base: 45, spread: 3, unit: '°C', normal: 'under 60 °C', hi: 65, detail: 'boost 182 kPa' },
  exhaust_temp: { base: 420, spread: 30, unit: '°C', normal: 'under 600 °C', hi: 650 },
  fuel_rate: { base: 18.5, spread: 1.5, unit: 'L/h', dec: 1, detail: '3.6 km/L today' },
  fuel_level_can: { base: 64, spread: 1, unit: '%', normal: 'refill below 15 %', lo: 15 },
  def_level: { base: 48, spread: 1, unit: '%', normal: 'refill below 15 %', lo: 15 },
  dpf_soot: { base: 34, spread: 2, unit: '%', normal: 'regenerate above 80 %', hi: 80 },
  wheel_speed: { base: 54, spread: 6, unit: 'km/h', normal: 'limit 80 km/h', hi: 80 },
  idle_time: { base: 42, spread: 6, unit: 'min/day', normal: 'under 60 min/day', hi: 60 },
  transmission_oil_temp: { base: 82, spread: 3, unit: '°C', normal: 'under 110 °C', hi: 110 },
  clutch_slip: { base: 1.2, spread: 0.3, unit: '%', dec: 1, normal: 'under 5 %', hi: 5 },
  air_filter: { base: 3.2, spread: 0.2, unit: 'kPa', dec: 1, normal: 'change above 6.2 kPa', hi: 6.2, detail: 'OK' },
  oil_life: { base: 58, spread: 1, unit: '% left', normal: 'change below 10 %', lo: 10 },
  air_brake_pressure: { base: 8.1, spread: 0.15, unit: 'bar', dec: 1, normal: '6.5-8.5 bar', lo: 6.5 },
  hub_temp: { base: 62, spread: 4, unit: '°C', normal: 'under 90 °C', hi: 90, detail: 'hottest wheel' },
  brake_air_leak: { base: 0.08, spread: 0.02, unit: 'bar/min', dec: 2, normal: 'under 0.2 bar/min', hi: 0.2 },
  driver_score: { base: 82, spread: 3, unit: '/ 100', normal: '70 or more is good', lo: 60 },
  fuel_level_probe: { base: 214, spread: 3, unit: 'L', detail: 'of 350 L tank', lo: 50 },
  cargo_temp_humidity: { base: 4.2, spread: 0.4, unit: '°C', dec: 1, normal: '2-8 °C', lo: 2, hi: 8, detail: 'humidity 78 %RH' },
  payload_estimate: { base: 18, spread: 0.2, unit: 't', dec: 1, detail: 'estimate, no load cells' },
}

const TEXT: Record<string, TextSpec> = {
  gps: { text: '54 km/h · heading SW' },
  accel_events: { text: '2 harsh brakes, 1 pothole', detail: 'today' },
  road_roughness: { text: '2 bad-road stretches', detail: 'on today’s route' },
  ignition: { text: 'On' },
  device_tamper: { text: 'No events', detail: 'last 7 days' },
  dtc: { text: 'No active fault codes', detail: '1 stored code (cleared)' },
  coolant_level: { text: 'OK' },
  engine_hours_odometer: { text: '' }, // filled from the profile
  water_in_fuel: { text: 'No' },
  vibration: { text: 'Normal' },
  driver_id: { text: '' }, // filled from the driver
  driver_fatigue: { text: 'No drowsiness events', detail: 'today' },
  panic_button: { text: 'No SOS', detail: 'this month' },
  cargo_door: { text: 'Closed' },
  cargo_seal: { text: 'Intact' },
}

/** Per-truck changes so every truck tells a different story. */
const OVERRIDES: Record<string, Record<string, Partial<NumSpec> | TextSpec>> = {
  'TN 99 ZZ 0003': { def_level: { base: 12 } },
  'TN 99 ZZ 0002': {
    coolant_temp: { base: 101 },
    dtc: { text: '1 active code: coolant temperature high', detail: 'Check coolant level and radiator fan. Drive gently.', status: 'warning' },
  },
  'TN 99 ZZ 0004': { battery_health: { base: 17.6 }, driver_score: { base: 64 } },
  'TN 99 ZZ 0005': {
    brake_air_leak: { base: 0.27 },
    vibration: { text: 'Rising', detail: 'rear axle 2, check wheel bearings', status: 'warning' },
    payload_estimate: { base: 18.2 },
  },
  'TN 99 ZZ 0006': {
    gps: { text: 'Parked · 0 km/h' },
    ignition: { text: 'Off' },
    wheel_speed: { base: 0, spread: 0 },
    engine_rpm: { base: 0, spread: 0 },
    battery_health: { base: 18.3 },
  },
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

/** Sample values for every non-tyre parameter of one truck. */
export function sampleParams(regNo: string, extra: { driverName: string | null; odometerKm: number }): ParamValue[] {
  const rand = seeded(regNo.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  const over = OVERRIDES[regNo] ?? {}
  const out: ParamValue[] = []
  for (const p of PARAMS) {
    if (p.group === 'Tyres') continue // the Tyres tab uses real sensor data
    const o = over[p.key]
    if (p.key in NUM) {
      const spec = { ...NUM[p.key], ...(o as Partial<NumSpec> | undefined) }
      const series = Array.from({ length: 24 }, () => spec.base + (rand() * 2 - 1) * spec.spread)
      const now = series[series.length - 1]
      const bad = (spec.lo !== undefined && now < spec.lo) || (spec.hi !== undefined && now > spec.hi)
      out.push({
        key: p.key,
        value: `${fmt(now, spec.dec)} ${spec.unit}`,
        detail: spec.detail,
        normal: spec.normal,
        status: bad ? 'warning' : 'ok',
        series,
      })
    } else {
      const spec = { ...TEXT[p.key], ...(o as TextSpec | undefined) }
      let text = spec.text
      if (p.key === 'driver_id') text = extra.driverName ?? 'No driver assigned'
      if (p.key === 'engine_hours_odometer') text = `${fmt(Math.round(extra.odometerKm / 29))} h · ${fmt(extra.odometerKm)} km`
      out.push({ key: p.key, value: text, detail: spec.detail, status: spec.status ?? 'ok' })
    }
  }
  return out
}

// ---------------------------------------------------------------------
// Tyre history (per position)
// ---------------------------------------------------------------------

const BRANDS = ['Brand A (sample)', 'Brand B (sample)', 'Brand C (sample)']

export function sampleTyreExtras(regNo: string, positions: string[]): TyreExtra[] {
  const rand = seeded(regNo.length * 97 + regNo.charCodeAt(regNo.length - 1))
  return positions.map((position, i) => {
    const retreads = rand() < 0.3 ? 1 : 0
    const kmRun = Math.round(18_000 + rand() * 60_000)
    return {
      position,
      brand: BRANDS[i % BRANDS.length],
      tread_mm: Math.round((6 + rand() * 9) * 10) / 10,
      sensor_battery_pct: Math.round(55 + rand() * 45),
      signal: rand() < 0.1 ? 'weak' : 'good',
      fitted_on: dateIn(-Math.round(60 + rand() * 400)),
      km_run: kmRun,
      retreads,
      cost_per_km: Math.round((0.9 + rand() * 0.6 - retreads * 0.25) * 100) / 100,
    }
  })
}

// ---------------------------------------------------------------------
// Predictions (besides the tyre ones, which api.ts works out from live alerts)
// ---------------------------------------------------------------------

type PredictionSeed = Omit<Prediction, 'id' | 'truck_id'>
export const PREDICTIONS: Record<string, PredictionSeed[]> = {
  'TN 99 ZZ 0001': [],
  'TN 99 ZZ 0002': [
    { component: 'Engine', issue: 'Engine running hot', risk: 'medium', window: 'Check within 2 days', confidence_pct: 72, action: 'Check coolant level, radiator and fan belt.', cost_if_ignored: 85_000, cost_now: 2_500, needs_garage: true },
  ],
  'TN 99 ZZ 0003': [
    { component: 'Engine', issue: 'AdBlue (DEF) running low', risk: 'medium', window: 'Refill within 1 day', confidence_pct: 95, action: 'Refill AdBlue at the next fuel stop, or the engine will lose power.', cost_if_ignored: 8_000, cost_now: 1_200, needs_garage: false },
    { component: 'Engine', issue: 'Routine service due', risk: 'low', window: 'Service due in 9 days / 2,100 km', confidence_pct: 99, action: 'Book oil and filter change.', cost_if_ignored: 6_000, cost_now: 4_500, needs_garage: true },
  ],
  'TN 99 ZZ 0004': [
    { component: 'Power', issue: 'Battery weak at engine start', risk: 'medium', window: 'May fail to start in ~2 weeks', confidence_pct: 70, action: 'Test and replace the battery.', cost_if_ignored: 15_000, cost_now: 9_000, needs_garage: true },
  ],
  'TN 99 ZZ 0005': [
    { component: 'Brakes', issue: 'Air brake leak rising', risk: 'medium', window: 'Fix within 5 days', confidence_pct: 77, action: 'Find and fix the air leak (valves, hoses).', cost_if_ignored: 60_000, cost_now: 2_000, needs_garage: true },
  ],
  'TN 99 ZZ 0006': [
    { component: 'Power', issue: 'Battery health dropping', risk: 'low', window: 'Check within 2 weeks', confidence_pct: 61, action: 'Test the battery at the next service.', cost_if_ignored: 12_000, cost_now: 500, needs_garage: false },
  ],
}

// ---------------------------------------------------------------------
// Maintenance and documents
// ---------------------------------------------------------------------

export function sampleMaintenance(regNo: string): { history: MaintenanceItem[]; upcoming: MaintenanceItem[]; documents: ComplianceDoc[] } {
  const k = Number(regNo.slice(-1)) || 1
  return {
    history: [
      { date: dateIn(-12 - k), title: 'Puncture repair, rear left', where: 'Sample Tyre Works 2', cost: 450 },
      { date: dateIn(-48 - k), title: 'Oil + filters service', where: 'Sample Tyre Works 13', cost: 6_800 },
      { date: dateIn(-95 - k), title: 'Wheel alignment + balancing', where: 'Sample Tyre Works 8', cost: 2_400 },
    ],
    upcoming: [
      { date: dateIn(2 + k), title: 'Tyre rotation', where: 'Not booked yet', cost: null },
      { date: dateIn(10 + k), title: 'Oil + filters service', where: 'Not booked yet', cost: null },
    ],
    documents: [
      { name: 'Permit', due: dateIn(180 + k * 20) },
      { name: 'Fitness certificate', due: dateIn(k === 2 ? 6 : 140 + k * 15) },
      { name: 'PUC', due: dateIn(k === 4 ? -3 : 40 + k * 7) },
      { name: 'Insurance', due: dateIn(k === 1 ? 18 : 220 + k * 10) },
      { name: 'Road tax', due: dateIn(70 + k * 11) },
    ],
  }
}

// ---------------------------------------------------------------------
// Map layers (sample stretches, not surveyed data)
// ---------------------------------------------------------------------

export const MAP_LAYERS: MapLayers = {
  ghats: [
    { name: 'Thoppur ghat (sample marking)', points: [[11.985, 78.122], [11.955, 78.128], [11.93, 78.135]] },
    { name: 'Vaniyambadi climb (sample)', points: [[12.7, 78.64], [12.67, 78.59]] },
  ],
  dead_zones: [
    { name: 'No signal (sample): near Ambur', points: [[12.78, 78.7], [12.74, 78.65]] },
    { name: 'No signal (sample): Dharmapuri bypass', points: [[12.16, 78.17], [12.1, 78.15]] },
  ],
  bad_roads: [
    { name: 'Bad road (sample): Krishnagiri service road', points: [[12.55, 78.24], [12.5, 78.21]] },
    { name: 'Bad road (sample): Rasipuram stretch', points: [[11.48, 78.18], [11.42, 78.18]] },
  ],
}
