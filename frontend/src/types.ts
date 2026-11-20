/*
 * Shared data types.
 *
 * The first block mirrors the database tables in docs/PROTOTYPE_SPEC.md section 3
 * (snake_case, same as the JSON the API will send).
 * The second block is what the API endpoints return (section 5).
 *
 * Units: pressures in kPa (gauge), temperatures in °C, times as ISO strings in UTC.
 */

// ---------- Simple enums ----------

/** Wheel layout of a truck. 6W = 2 front + 4 rear (one dual axle). 10W = 2 front + 8 rear (two dual axles). */
export type AxleConfig = '6W' | '10W'

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
