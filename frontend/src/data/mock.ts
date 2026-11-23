/*
 * MOCK DATA - lets the frontend run without the backend.
 *
 * Nothing here is real: fake registration numbers, fake garages ("Sample Tyre Works 1"),
 * fake phone numbers. Shape matches the database (spec section 3) and seed data (section 8).
 *
 * Pages must NOT import this file directly. They call src/services/api.ts,
 * which calls the functions at the bottom of this file. When the real API is ready,
 * only api.ts changes.
 *
 * Scenarios built in (so every screen has something to show):
 *   Truck 1 (6 wheels):  RL-O has a slow leak of 3 psi/hour  -> slow_leak warning
 *                        FL sensor stopped sending 25 min ago -> sensor_offline warning
 *   Truck 2 (10 wheels): FR is hot (95 °C) but NOT leaking    -> high_temp warning only,
 *                        its corrected pressure stays flat (spec acceptance criterion 3)
 *                        Plus one old, acknowledged critical alert so "Closed" isn't empty.
 */
import type { Alert, Booking, Driver, FleetOwner, Garage, NearbyGarage, Reading, Truck, TruckStatus, Tyre, TyreWithStatus, TruckSummary } from '../types'
import { haversineKm, isOpenNow } from '../lib/geo'
import { gaugeKpaFromCorrected, psiToKpa } from '../lib/units'
import { positionsFor } from '../lib/tyreLayout'

// ---------- Helpers ----------

/** Tiny seeded random number generator, so mock data looks the same on every load. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = seededRandom(42)
/** Random number between -size and +size */
const noise = (size: number) => (rand() * 2 - 1) * size

const round1 = (n: number) => Math.round(n * 10) / 10
const MIN = 60_000 // one minute in ms

/** Mock "now". All mock times are relative to when the page loaded. */
const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()

// ---------- Owner, trucks, tyres (spec section 8) ----------

export const OWNER_ID = '00000000-0000-4000-8000-000000000001'

const trucks: Truck[] = [
  {
    id: 'truck-1',
    owner_id: OWNER_ID,
    reg_no: 'TN 99 ZZ 0001',
    make: 'Tata',
    model: 'Signa 4825.T',
    axle_config: '6W',
    created_at: '2026-11-01T00:00:00Z',
    plan: 'lite',
    goods_type: 'Textile bales',
  },
  {
    id: 'truck-2',
    owner_id: OWNER_ID,
    reg_no: 'TN 99 ZZ 0002',
    make: 'Ashok Leyland',
    model: '3520',
    axle_config: '10W',
    created_at: '2026-11-01T00:00:00Z',
    plan: 'pro',
    goods_type: 'Cement bags',
  },
]

const RECOMMENDED_KPA = 830 // spec section 8

const tyres: Tyre[] = trucks.flatMap((truck, ti) =>
  positionsFor(truck.axle_config).map((position, pi) => ({
    id: `${truck.id}-${position}`,
    truck_id: truck.id,
    position,
    sensor_id: `MOCK${ti + 1}${String(pi + 1).padStart(2, '0')}`,
    recommended_cold_kpa: RECOMMENDED_KPA,
    max_temp_c: 85,
  })),
)

// ---------- Route: Chennai -> Salem (for lat/lon) ----------

// Rough waypoints along the highway. Trucks move between them.
const ROUTE: [number, number][] = [
  [13.0827, 80.2707], // Chennai
  [12.9675, 79.9419], // Sriperumbudur
  [12.9165, 79.1325], // Vellore
  [12.6820, 78.6206], // Vaniyambadi
  [12.5186, 78.2137], // Krishnagiri
  [12.1277, 78.1579], // Dharmapuri
  [11.6643, 78.146], // Salem
]

/** Point along the route, f from 0 (Chennai) to 1 (Salem). */
function pointOnRoute(f: number): [number, number] {
  const x = Math.min(Math.max(f, 0), 1) * (ROUTE.length - 1)
  const i = Math.min(Math.floor(x), ROUTE.length - 2)
  const t = x - i
  const [aLat, aLon] = ROUTE[i]
  const [bLat, bLon] = ROUTE[i + 1]
  return [aLat + (bLat - aLat) * t, aLon + (bLon - aLon) * t]
}

// ---------- Readings: last 2 hours, one per minute ----------
// (The real simulator sends one every 10 s; one per minute is plenty for mock charts.)

interface TruckTrip {
  /** Minutes since the truck started driving */
  startedMinAgo: number
  /** Where on the route it started / is now (0 = Chennai, 1 = Salem) */
  fromF: number
  toF: number
}
const TRIPS: Record<string, TruckTrip> = {
  'truck-1': { startedMinAgo: 130, fromF: 0.0, toF: 0.36 },
  'truck-2': { startedMinAgo: 150, fromF: 0.35, toF: 0.72 },
}

/** Scenario settings per tyre id */
const LEAK = { tyreId: 'truck-1-RL-O', startedMinAgo: 100, psiPerHour: 3 }
const HOT = { tyreId: 'truck-2-FR', startedMinAgo: 70, peakC: 95 }
const OFFLINE = { tyreId: 'truck-1-FL', lastSeenMinAgo: 25 }

const AMBIENT_C = 30
const HISTORY_MIN = 120

const readings: Reading[] = []
let readingId = 1

for (const tyre of tyres) {
  const trip = TRIPS[tyre.truck_id]
  const isFront = tyre.position.startsWith('F')
  // Each tyre was filled slightly differently (±1.5 %).
  const fillKpa = tyre.recommended_cold_kpa * (1 + noise(0.015))

  for (let m = HISTORY_MIN; m >= 0; m--) {
    if (tyre.id === OFFLINE.tyreId && m < OFFLINE.lastSeenMinAgo) continue

    const drivingMin = trip.startedMinAgo - m
    // Normal: tyre warms from ambient (30 °C) to about 55 °C in the first hour of driving.
    const rise = isFront ? 20 : 25
    let temp = AMBIENT_C + rise * (1 - Math.exp(-Math.max(drivingMin, 0) / 20))

    // Hot tyre scenario: extra heat (e.g. a dragging brake), no air lost.
    if (tyre.id === HOT.tyreId && m < HOT.startedMinAgo) {
      const hotMin = HOT.startedMinAgo - m
      temp += (HOT.peakC - temp) * (1 - Math.exp(-hotMin / 12))
    }
    temp += noise(0.3)

    // Corrected pressure stays flat... unless the tyre is leaking.
    let corrected = fillKpa + noise(1)
    if (tyre.id === LEAK.tyreId && m < LEAK.startedMinAgo) {
      const leakHours = (LEAK.startedMinAgo - m) / 60
      corrected -= psiToKpa(LEAK.psiPerHour) * leakHours
    }

    // The gauge pressure rises with temperature.
    const pressure = gaugeKpaFromCorrected(corrected, temp)

    const [lat, lon] = pointOnRoute(
      trip.fromF + (trip.toF - trip.fromF) * (drivingMin / trip.startedMinAgo),
    )

    readings.push({
      id: readingId++,
      tyre_id: tyre.id,
      ts: iso(m * MIN),
      pressure_kpa: round1(pressure),
      temp_c: round1(temp),
      ambient_c: AMBIENT_C,
      lat: Math.round(lat * 1e4) / 1e4,
      lon: Math.round(lon * 1e4) / 1e4,
      rssi: Math.round(-70 + noise(8)),
      corrected_kpa: round1(corrected),
    })
  }
}

// ---------- Alerts ----------

const alerts: Alert[] = [
  {
    id: 'alert-1',
    tyre_id: LEAK.tyreId,
    truck_id: 'truck-1',
    type: 'slow_leak',
    severity: 'warning',
    value: round1(-psiToKpa(LEAK.psiPerHour)),
    message: 'Pressure is falling about 3 psi per hour (temperature-corrected). Check for a puncture or valve leak.',
    created_at: iso((LEAK.startedMinAgo - 18) * MIN),
    acknowledged_at: null,
  },
  {
    id: 'alert-2',
    tyre_id: OFFLINE.tyreId,
    truck_id: 'truck-1',
    type: 'sensor_offline',
    severity: 'warning',
    value: 10,
    message: 'No reading from this tyre sensor for 10 minutes. Sensor battery or signal may be the problem.',
    created_at: iso((OFFLINE.lastSeenMinAgo - 10) * MIN),
    acknowledged_at: null,
  },
  {
    id: 'alert-3',
    tyre_id: HOT.tyreId,
    truck_id: 'truck-2',
    type: 'high_temp',
    severity: 'warning',
    value: 92,
    message: 'Tyre temperature is above 85 °C. Pressure is normal once corrected, so this is heat, not a leak. Check brakes and bearings.',
    created_at: iso(30 * MIN),
    acknowledged_at: null,
  },
  {
    id: 'alert-4',
    tyre_id: 'truck-2-R2R-O',
    truck_id: 'truck-2',
    type: 'critical_pressure',
    severity: 'critical',
    value: 640,
    message: 'Corrected pressure below 80% of recommended. Stop and inspect the tyre.',
    created_at: iso(26 * 60 * MIN),
    acknowledged_at: iso(25 * 60 * MIN),
  },
]

// ---------- Garages: Chennai - Krishnagiri - Salem - Namakkal (spec section 8) ----------

type G = Omit<Garage, 'id' | 'name' | 'phone' | 'services' | 'verified'> &
  Partial<Pick<Garage, 'services' | 'verified'>>
const garageSeed: G[] = [
  { lat: 13.0475, lon: 80.0960, open_24x7: true, opens: null, closes: null }, // Poonamallee
  { lat: 12.9610, lon: 79.9550, open_24x7: false, opens: '08:00', closes: '20:00' }, // Sriperumbudur
  { lat: 12.9300, lon: 79.6400, open_24x7: true, opens: null, closes: null }, // near Kanchipuram
  { lat: 12.9230, lon: 79.3330, open_24x7: false, opens: '07:00', closes: '22:00' }, // Walajapet
  { lat: 12.9200, lon: 79.1400, open_24x7: true, opens: null, closes: null }, // Vellore
  { lat: 12.7900, lon: 78.7160, open_24x7: false, opens: '06:00', closes: '23:00' }, // Ambur
  { lat: 12.6400, lon: 78.4900, open_24x7: true, opens: null, closes: null }, // Natrampalli
  { lat: 12.5200, lon: 78.2200, open_24x7: true, opens: null, closes: null }, // Krishnagiri
  { lat: 12.1300, lon: 78.1600, open_24x7: false, opens: '08:00', closes: '21:00' }, // Dharmapuri
  { lat: 11.9500, lon: 78.1300, open_24x7: true, opens: null, closes: null }, // Thoppur
  { lat: 11.6700, lon: 78.1400, open_24x7: true, opens: null, closes: null }, // Salem
  { lat: 11.4500, lon: 78.1800, open_24x7: false, opens: '09:00', closes: '19:00', verified: false }, // Rasipuram
  { lat: 11.2200, lon: 78.1700, open_24x7: true, opens: null, closes: null, services: ['tyre', 'air_brake', 'engine'] }, // Namakkal
]
const garages: Garage[] = garageSeed.map((g, i) => ({
  id: `garage-${i + 1}`,
  name: `Sample Tyre Works ${i + 1}`,
  phone: `+91 90000 000${String(i + 1).padStart(2, '0')}`,
  services: ['tyre'],
  verified: true,
  ...g,
}))

// =====================================================================
// Mock versions of the API endpoints (spec section 5).
// Only src/services/api.ts should call these.
// =====================================================================

const OFFLINE_AFTER_MS = 10 * MIN // spec: sensor_offline after 10 min

function latestReading(tyreId: string): Reading | undefined {
  let latest: Reading | undefined
  for (const r of readings) {
    if (r.tyre_id === tyreId && (!latest || r.ts > latest.ts)) latest = r
  }
  return latest
}

const openAlerts = () => alerts.filter((a) => !a.acknowledged_at)

/** GET /api/trucks */
export function mockGetTrucks(): TruckSummary[] {
  const open = openAlerts()
  return trucks.map((truck) => {
    const truckAlerts = open.filter((a) => a.truck_id === truck.id)

    const tyreList: TyreWithStatus[] = tyres
      .filter((t) => t.truck_id === truck.id)
      .map((t) => {
        const r = latestReading(t.id)
        const tyreAlerts = truckAlerts.filter((a) => a.tyre_id === t.id)
        // Offline wins (we don't know the real state). Otherwise worst open alert.
        let status: TyreWithStatus['status'] = 'ok'
        if (!r || Date.now() - new Date(r.ts).getTime() > OFFLINE_AFTER_MS) status = 'offline'
        else if (tyreAlerts.some((a) => a.severity === 'critical')) status = 'critical'
        else if (tyreAlerts.length > 0) status = 'warning'
        return {
          ...t,
          status,
          latest: r
            ? { ts: r.ts, pressure_kpa: r.pressure_kpa, corrected_kpa: r.corrected_kpa, temp_c: r.temp_c }
            : null,
        }
      })

    const status: TruckStatus = truckAlerts.some((a) => a.severity === 'critical')
      ? 'critical'
      : truckAlerts.length > 0
        ? 'warning'
        : 'ok'

    // Last seen = newest reading from any tyre on this truck.
    let newest: Reading | undefined
    for (const t of tyreList) {
      const r = latestReading(t.id)
      if (r && (!newest || r.ts > newest.ts)) newest = r
    }

    return {
      ...truck,
      status,
      last_seen_at: newest?.ts ?? null,
      lat: newest?.lat ?? null,
      lon: newest?.lon ?? null,
      open_alerts: truckAlerts.length,
      tyres: tyreList,
    }
  })
}

/** GET /api/trucks/{id}/readings?from=&to= */
export function mockGetReadings(truckId: string, fromIso: string, toIso: string): Reading[] {
  const ids = new Set(tyres.filter((t) => t.truck_id === truckId).map((t) => t.id))
  return readings.filter((r) => ids.has(r.tyre_id) && r.ts >= fromIso && r.ts <= toIso)
}

/** GET /api/alerts?open=true|false */
export function mockGetAlerts(open?: boolean): Alert[] {
  return alerts
    .filter((a) => (open === undefined ? true : open ? !a.acknowledged_at : !!a.acknowledged_at))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((a) => ({ ...a }))
}

/** POST /api/alerts/{id}/ack */
export function mockAckAlert(id: string): Alert {
  const alert = alerts.find((a) => a.id === id)
  if (!alert) throw new Error('Alert not found')
  alert.acknowledged_at ??= new Date().toISOString()
  return { ...alert }
}

/** GET /api/garages/nearest?lat=&lon=&service=tyre -> 3 nearest garages open now */
export function mockGetNearestGarages(lat: number, lon: number, service = 'tyre'): NearbyGarage[] {
  const now = new Date()
  return garages
    .filter((g) => g.services.includes(service))
    .map((g) => ({ ...g, distance_km: haversineKm(lat, lon, g.lat, g.lon), open_now: isOpenNow(g, now) }))
    .filter((g) => g.open_now)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 3)
}

// ---------- Bookings (demo only: no table or endpoint yet) ----------

const bookings: Booking[] = []

/** Pretend to book a slot. Nothing is sent anywhere. */
export function mockBookGarage(alert: Alert, garage: NearbyGarage): Booking {
  const booking: Booking = {
    id: `booking-${bookings.length + 1}`,
    alert_id: alert.id,
    truck_id: alert.truck_id,
    tyre_id: alert.tyre_id,
    garage: { ...garage },
    created_at: new Date().toISOString(),
  }
  bookings.push(booking)
  return { ...booking }
}

export function mockGetBooking(id: string): Booking | null {
  const b = bookings.find((x) => x.id === id)
  return b ? { ...b } : null
}

// ---------- Owner profile and drivers (demo only: no drivers table, no GST column) ----------

const owner: FleetOwner = {
  id: OWNER_ID,
  name: 'Demo Owner',
  phone: '+91 90000 11111',
  company: 'Sample Transports (demo)',
  created_at: '2026-11-01T00:00:00Z',
  gst_no: '33ABCDE1234F1Z5',
}

const drivers: Driver[] = [
  { id: 'driver-1', owner_id: OWNER_ID, name: 'Sample Driver 1', phone: '+91 90000 22201', availability: 'on_duty', truck_id: 'truck-1', rating: null },
  { id: 'driver-2', owner_id: OWNER_ID, name: 'Sample Driver 2', phone: '+91 90000 22202', availability: 'on_duty', truck_id: 'truck-2', rating: null },
  { id: 'driver-3', owner_id: OWNER_ID, name: 'Sample Driver 3', phone: '+91 90000 22203', availability: 'available', truck_id: null, rating: null },
  { id: 'driver-4', owner_id: OWNER_ID, name: 'Sample Driver 4', phone: '+91 90000 22204', availability: 'off_duty', truck_id: null, rating: null },
]

export function mockGetOwner(): FleetOwner {
  return { ...owner }
}

export function mockGetDrivers(): Driver[] {
  return drivers.map((d) => ({ ...d }))
}

/**
 * Put a driver on a truck (or take them off with truckId = null).
 * One driver per truck: whoever was on that truck is taken off.
 * Assigning makes an available driver on duty; un-assigning makes them available.
 */
export function mockAssignDriver(driverId: string, truckId: string | null): Driver[] {
  const d = drivers.find((x) => x.id === driverId)
  if (!d) throw new Error('Driver not found')
  if (truckId) {
    for (const other of drivers) {
      if (other.id !== driverId && other.truck_id === truckId) {
        other.truck_id = null
        if (other.availability === 'on_duty') other.availability = 'available'
      }
    }
    d.truck_id = truckId
    if (d.availability === 'available') d.availability = 'on_duty'
  } else {
    d.truck_id = null
    if (d.availability === 'on_duty') d.availability = 'available'
  }
  return mockGetDrivers()
}
