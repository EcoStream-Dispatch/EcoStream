/*
 * Shared data types.
 *
 * The first block mirrors the database tables in docs/PROTOTYPE_SPEC.md section 3
 * (snake_case, same as the JSON the API will send).
 * The second block is what the API endpoints return (section 5).
 *
 * Units: pressures in kPa (gauge), temperatures in °C, times as ISO strings in UTC.
 */

import type { AddOnId, PlanId } from './data/plans'

// ---------- Simple enums ----------

/**
 * Wheel layout of a truck (see lib/tyreLayout.ts):
 *   6W  = 2 front + 4 rear (one dual axle)
 *   10W = 2 front + 8 rear (two dual axles)
 *   12W = 2 + 2 front (twin steer) + 8 rear (two dual axles)
 *   14W = 2 front + 12 rear (three dual axles)
 *   18W = tractor (2 front + 8 rear) + trailer (8 on two dual axles)
 */
export type AxleConfig = '6W' | '10W' | '12W' | '14W' | '18W'

export type AlertType =
  | 'low_pressure'
  | 'critical_pressure'
  | 'slow_leak'
  | 'high_temp'
  | 'sensor_offline'

export type Severity = 'warning' | 'critical'

/** Status shown for one tyre. */
export type TyreStatus = 'ok' | 'warning' | 'critical' | 'offline'

/** Status shown for a whole truck (worst open alert). */
export type TruckStatus = 'ok' | 'warning' | 'critical'

// ---------- Database rows (spec section 3) ----------

export interface Truck {
  id: string
  owner_id: string
  reg_no: string
  make: string
  model: string
  axle_config: AxleConfig
  created_at: string
}

export interface Tyre {
  id: string
  truck_id: string
  /** e.g. 'FL', 'FR', 'RL-O', 'RL-I', 'RR-I', 'RR-O' (see lib/tyreLayout.ts) */
  position: string
  /** TPMS sensor ID */
  sensor_id: string
  recommended_cold_kpa: number
  max_temp_c: number
}

export interface Reading {
  id: number
  tyre_id: string
  ts: string
  pressure_kpa: number
  temp_c: number
  ambient_c: number | null
  lat: number | null
  lon: number | null
  rssi: number | null
  /** Pressure corrected to 20 °C (computed by the API on ingest) */
  corrected_kpa: number
}

export interface Alert {
  id: string
  tyre_id: string
  truck_id: string
  type: AlertType
  severity: Severity
  /** Meaning depends on type: kPa, kPa/hour, °C or minutes. See lib/alerts.ts */
  value: number
  message: string
  created_at: string
  acknowledged_at: string | null
  /** Set when the problem is fixed (stage W4). Resolving also acknowledges. */
  resolved_at?: string | null
}

export interface Garage {
  id: string
  name: string
  lat: number
  lon: number
  phone: string
  open_24x7: boolean
  /** "HH:MM" in IST, null when open_24x7 */
  opens: string | null
  closes: string | null
  services: string[]
  verified: boolean
}

// ---------- API responses (spec section 5) ----------

/** The latest reading for a tyre, as shown on the Fleet and Truck pages. */
export type LatestReading = Pick<Reading, 'ts' | 'pressure_kpa' | 'corrected_kpa' | 'temp_c'>

export interface TyreWithStatus extends Tyre {
  status: TyreStatus
  latest: LatestReading | null
}

/** One item of GET /api/trucks: a truck with its latest tyre status. */
export interface TruckSummary extends Truck {
  status: TruckStatus
  last_seen_at: string | null
  /** Last known position (from the latest reading) */
  lat: number | null
  lon: number | null
  open_alerts: number
  tyres: TyreWithStatus[]
}

/** One item of GET /api/garages/nearest */
export interface NearbyGarage extends Garage {
  /** Straight-line (haversine) distance from the truck, in km */
  distance_km: number
  open_now: boolean
}

// ---------- Owner portal (website stage W3) ----------
// No backend for these yet: they come from src/data/ownerMock.ts through src/services/api.ts.
// Pages show a "Demo data" label wherever they use them.


export type Availability = 'on_trip' | 'available' | 'off'

export interface Driver {
  id: string
  name: string
  phone: string
  /** YYYY-MM-DD */
  licence_expiry: string
  /** 0-100, from driving data (harsh braking, speeding, idling) */
  score: number
  availability: Availability
  truck_id: string | null
}

export interface Place {
  name: string
  city: string
  address: string
  contact: string
  phone: string
  lat: number
  lon: number
}

export type ShipmentStatus = 'scheduled' | 'loading' | 'in_transit' | 'delivered' | 'delayed'

export interface Shipment {
  id: string
  sender: Place
  receiver: Place
  goods: string
  weight_t: number
  truck_id: string | null
  driver_id: string | null
  status: ShipmentStatus
  pickup_at: string
  eta: string | null
  distance_left_km: number | null
}

export interface TruckProfile {
  truck_id: string
  plan: PlanId
  add_ons: AddOnId[]
  driver_id: string | null
  shipment_id: string | null
  odometer_km: number
  next_service: { date: string; km: number; what: string }
}

export type ParamStatus = 'ok' | 'warning' | 'critical'

/** One live value on a Truck page card (keys from src/data/plans.ts). */
export interface ParamValue {
  key: string
  value: string
  detail?: string
  status: ParamStatus
  /** e.g. "80-95 °C" */
  normal?: string
  /** last 24 h, for the sparkline */
  series?: number[]
}

export interface TyreExtra {
  position: string
  brand: string
  tread_mm: number
  sensor_battery_pct: number
  signal: 'good' | 'weak'
  fitted_on: string
  km_run: number
  retreads: number
  cost_per_km: number
}

export type Risk = 'low' | 'medium' | 'high'

export interface Prediction {
  id: string
  truck_id: string
  component: 'Tyres' | 'Engine' | 'Brakes' | 'Power' | 'Cargo'
  issue: string
  risk: Risk
  /** "Unsafe in ~6 h", "Service due in 9 days / 1,800 km" */
  window: string
  confidence_pct: number
  action: string
  cost_if_ignored: number
  cost_now: number
  /** Show "Book garage" */
  needs_garage: boolean
}

export interface MaintenanceItem {
  date: string
  title: string
  where: string
  cost: number | null
}

export interface ComplianceDoc {
  name: 'Permit' | 'Fitness certificate' | 'PUC' | 'Insurance' | 'Road tax'
  due: string
}

/** Everything the Truck page needs on top of TruckSummary. */
export interface TruckDetails {
  profile: TruckProfile
  driver: Driver | null
  shipment: Shipment | null
  params: ParamValue[]
  tyres: TyreExtra[]
  predictions: Prediction[]
  service_history: MaintenanceItem[]
  upcoming: MaintenanceItem[]
  documents: ComplianceDoc[]
}

export interface MapPath {
  name: string
  points: [number, number][]
}

/** Extra map layers on the Live Map (sample data). */
export interface MapLayers {
  dead_zones: MapPath[]
  ghats: MapPath[]
  bad_roads: MapPath[]
}

// ---------- Owner portal part 2 (website stage W4) ----------

export interface Booking {
  id: string
  truck_id: string
  alert_id: string | null
  garage_id: string
  garage_name: string
  garage_phone: string
  /** ISO time of the slot */
  slot: string
  what: string
  status: 'confirmed' | 'done' | 'cancelled'
  created_at: string
}

export interface ShipmentEvent {
  ts: string
  kind: 'created' | 'picked_up' | 'checkpoint' | 'alert' | 'delivered'
  text: string
}

export interface NewShipment {
  sender: Place
  receiver: Place
  goods: string
  weight_t: number
  cold_chain: boolean
  pickup_at: string
  truck_id: string
  driver_id: string | null
  notify_shipper: boolean
}

export interface TeamUser {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'viewer'
}

export interface AlertThresholds {
  low_pressure_pct: number
  critical_pressure_pct: number
  max_temp_c: number
  leak_warning_psi_per_hour: number
}

export interface NotificationSettings {
  whatsapp: boolean
  sms: boolean
  email: boolean
  phone: string
  email_address: string
}

export interface MonthReport {
  month: string
  saved_rupees: number
  breakdowns_avoided: number
  alerts_acted_on: number
  fuel_km_per_l: number
  idle_min_per_day: number
}

// ---------- Shipper portal (website stage W6) ----------

export interface ShipmentRequest {
  id: string
  pickup_city: string
  pickup_address: string
  drop_city: string
  drop_address: string
  goods: string
  weight_t: number
  date: string
  status: 'waiting' | 'accepted'
  created_at: string
}

/** What a shipper is shown about the truck: plain words, no technical alert details. */
export type TruckCondition = 'good' | 'minor' | 'problem' | 'no_signal'
