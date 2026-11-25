import type { Plan, TruckSummary } from '../types'
import { kpaToPsi } from './units'
import { nearestTown } from './geo'

/*
 * Every data point EcoStream reads from a truck, and who sees it.
 *
 * Source: the market-study workbook, sheet "Plans & Parameters" (section B: every data point →
 * which plan monitors it), cross-checked with "Final List of Parameters" and
 * "Ref - ECR Prop & User Split". The parameter keys are the sheet's "Parameter key (app)".
 *
 * Which login sees what (our reading of the "App Screens" sheet):
 *   owner   - everything their truck's plan and add-ons include
 *   driver  - what matters while driving: tyres, warnings, brakes, fuel, driver safety
 *   shipper - where the truck is, its condition, and the cargo (Phase 3 preview)
 */

export type Role = 'owner' | 'driver' | 'shipper'

export type ParamGroup = 'tyres' | 'location' | 'power' | 'engine' | 'brakes' | 'cargo' | 'driver' | 'device'

export const GROUP_NAME: Record<ParamGroup, string> = {
  tyres: 'Tyres',
  location: 'Location & road',
  power: 'Power',
  engine: 'Engine (CAN)',
  brakes: 'Brakes & chassis',
  cargo: 'Cargo',
  driver: 'Driver',
  device: 'EcoStream device',
}

/** In a plan: included, sold as an add-on, or not offered. */
type Avail = 'yes' | 'addon' | '-'

/** Add-on packs (sheet "Plans & Parameters", section C). */
export type AddOn = 'fuel' | 'cold_chain' | 'cargo_security' | 'wheel_end' | 'driver_safety' | 'ais140'

export const ADD_ON_NAME: Record<AddOn, string> = {
  fuel: 'Fuel monitoring',
  cold_chain: 'Cold chain',
  cargo_security: 'Cargo security',
  wheel_end: 'Wheel-end temperature',
  driver_safety: 'Driver safety',
  ais140: 'AIS-140 kit',
}

export type Source = 'Our sensor' | 'Truck CAN' | 'Derived' | 'Add-on sensor' | 'Garage tool'

export interface ParamDef {
  /** Row number in the sheet */
  n: number
  key: string
  group: ParamGroup
  label: string
  /** availability in Lite / Pro / Fleet */
  plans: Record<Plan, Avail>
  addOn?: AddOn
  source: Source
  /** The alert or feature it powers */
  powers: string
  roles: Role[]
}

const O: Role[] = ['owner']
const OD: Role[] = ['owner', 'driver']
const ODS: Role[] = ['owner', 'driver', 'shipper']
const OS: Role[] = ['owner', 'shipper']

const ALL: Record<Plan, Avail> = { lite: 'yes', pro: 'yes', fleet: 'yes' }
const PRO: Record<Plan, Avail> = { lite: '-', pro: 'yes', fleet: 'yes' }
const FLEET: Record<Plan, Avail> = { lite: '-', pro: '-', fleet: 'yes' }
const ADD: Record<Plan, Avail> = { lite: 'addon', pro: 'addon', fleet: 'addon' }
const ADD_PRO: Record<Plan, Avail> = { lite: '-', pro: 'addon', fleet: 'addon' }

const p = (n: number, key: string, group: ParamGroup, label: string, plans: Record<Plan, Avail>, source: Source, powers: string, roles: Role[], addOn?: AddOn): ParamDef => ({
  n,
  key,
  group,
  label,
  plans,
  source,
  powers,
  roles,
  addOn,
})

/** The 50 data points in use (rows 1-50). */
export const PARAMETERS: ParamDef[] = [
  // Tyres
  p(1, 'tyre_pressure', 'tyres', 'Tyre pressure (each wheel)', ALL, 'Our sensor', 'Low / critical pressure alert', ODS),
  p(2, 'tyre_temperature', 'tyres', 'Tyre air temperature (each wheel)', ALL, 'Our sensor', 'High tyre temperature alert', OD),
  p(3, 'tyre_pressure_corrected', 'tyres', 'Temperature-corrected pressure', ALL, 'Derived', 'No false alarms from heat', OD),
  p(4, 'tyre_leak_rate', 'tyres', 'Leak rate (trend)', ALL, 'Derived', 'Slow-leak alert + time-to-unsafe countdown', OD),
  p(5, 'tpms_sensor_health', 'tyres', 'Sensor battery / signal health', ALL, 'Our sensor', 'Dead / stolen sensor alert', O),
  p(49, 'tyre_tread_depth', 'tyres', 'Tyre tread depth', ALL, 'Garage tool', 'Replacement plan (logged at partner garages)', O),
  // Location & road
  p(6, 'gps_position', 'location', 'GPS position, speed, heading', ALL, 'Our sensor', 'Live location; nearest open garage', ODS),
  p(7, 'road_gradient', 'location', 'Altitude / road gradient', PRO, 'Derived', 'Pre-ghat risk check', OD),
  p(8, 'cellular_signal', 'location', 'Cellular signal (RSSI) + network', ALL, 'Our sensor', 'Store-and-forward in dead zones', OD),
  p(9, 'ambient_temperature', 'location', 'Ambient temperature', ALL, 'Our sensor', 'Feeds the temperature correction', OD),
  p(10, 'acceleration_events', 'location', 'Harsh brake / pothole / crash (3-axis)', ALL, 'Our sensor', "Hard impact → 'check tyre' alert", ODS),
  p(40, 'road_roughness', 'location', 'Road roughness / pothole map', PRO, 'Derived', 'Bad-road warning; pothole map', OD),
  // Power
  p(11, 'battery_voltage', 'power', 'Truck battery voltage (24 V)', ALL, 'Our sensor', 'Low battery / charging fault alert', OD),
  p(12, 'ignition', 'power', 'Ignition on / off', ALL, 'Our sensor', 'Trips, idle detection', OD),
  p(38, 'battery_cranking_health', 'power', 'Battery health (cranking dip)', ALL, 'Derived', 'No-start prediction', OD),
  // Engine (CAN)
  p(13, 'fault_codes', 'engine', 'Fault codes (DTC), in plain words', PRO, 'Truck CAN', 'Fault explained in Tamil/Hindi + action', OD),
  p(14, 'coolant_temperature', 'engine', 'Coolant temperature', PRO, 'Truck CAN', 'Engine overheating alert', OD),
  p(15, 'coolant_level', 'engine', 'Coolant level', PRO, 'Truck CAN', 'Coolant leak alert', OD),
  p(16, 'oil_pressure', 'engine', 'Engine oil pressure', PRO, 'Truck CAN', 'Low oil pressure alert', OD),
  p(17, 'oil_temperature', 'engine', 'Engine oil temperature', PRO, 'Truck CAN', 'Oil overheating alert', OD),
  p(18, 'engine_rpm', 'engine', 'Engine speed (RPM)', PRO, 'Truck CAN', 'Context for engine alerts', OD),
  p(19, 'engine_load', 'engine', 'Engine load % + accelerator', PRO, 'Truck CAN', 'Context for engine alerts', O),
  p(20, 'intake_temp_boost', 'engine', 'Intake air temp + boost pressure', PRO, 'Truck CAN', 'Turbo / air-filter problem alert', O),
  p(21, 'exhaust_gas_temperature', 'engine', 'Exhaust gas temperature', PRO, 'Truck CAN', 'Injector / after-treatment alert', O),
  p(22, 'fuel_rate', 'engine', 'Fuel rate', PRO, 'Truck CAN', 'Fuel efficiency drop alert', O),
  p(23, 'fuel_level_can', 'engine', 'Fuel level', PRO, 'Truck CAN', 'Refuel and theft hints (coarse)', OD),
  p(24, 'def_level', 'engine', 'DEF / AdBlue level', PRO, 'Truck CAN', 'Low DEF → avoid power derate', OD),
  p(25, 'dpf_soot_load', 'engine', 'DPF soot load', PRO, 'Truck CAN', 'DPF clogging → regen reminder', OD),
  p(26, 'engine_hours_odometer', 'engine', 'Engine hours + odometer', PRO, 'Truck CAN', 'Service due reminders', O),
  p(27, 'vehicle_speed', 'engine', 'Wheel-based vehicle speed', PRO, 'Truck CAN', 'Over-speeding alert', ODS),
  p(28, 'idle_time', 'engine', 'Idle time', PRO, 'Derived', 'Idle-time report', O),
  p(42, 'transmission_oil_temperature', 'engine', 'Gearbox oil temperature', PRO, 'Truck CAN', 'Gearbox overheating alert', OD),
  p(43, 'clutch_slip', 'engine', 'Clutch slip', PRO, 'Derived', 'Clutch wear alert', OD),
  p(44, 'water_in_fuel', 'engine', 'Water in fuel', PRO, 'Truck CAN', 'Water in diesel alert', OD),
  p(45, 'air_filter_restriction', 'engine', 'Air filter restriction', PRO, 'Truck CAN', 'Air filter clogged alert', O),
  p(48, 'oil_life_estimate', 'engine', 'Engine oil life', PRO, 'Derived', 'Condition-based oil change', O),
  p(34, 'fuel_level_probe', 'engine', 'Fuel level (accurate probe)', ADD, 'Add-on sensor', 'Fuel theft alert', OD, 'fuel'),
  // Brakes & chassis
  p(29, 'air_tank_pressure', 'brakes', 'Air-brake tank pressure', PRO, 'Truck CAN', 'Low brake air pressure alert', OD),
  p(46, 'brake_air_leak_rate', 'brakes', 'Brake air leak rate', PRO, 'Derived', 'Brake air-leak alert', OD),
  p(41, 'vibration_signature', 'brakes', 'Vibration (driveline / bearings)', PRO, 'Derived', 'Bearing early warning', O),
  p(30, 'hub_temperature', 'brakes', 'Wheel-end / hub temperature', ADD_PRO, 'Add-on sensor', 'Wheel-fire / bearing warning', OD, 'wheel_end'),
  // Cargo
  p(31, 'cargo_temp_humidity', 'cargo', 'Cargo temperature & humidity', ADD, 'Add-on sensor', 'Reefer temperature / humidity alerts', ODS, 'cold_chain'),
  p(32, 'cargo_door', 'cargo', 'Cargo door open / closed', ADD, 'Add-on sensor', 'Door opened outside geofence', ODS, 'cargo_security'),
  p(33, 'cargo_seal', 'cargo', 'Cargo lock / seal', ADD, 'Add-on sensor', 'Seal broken outside geofence', ODS, 'cargo_security'),
  p(47, 'payload_estimate', 'cargo', 'Payload estimate (no load cells)', FLEET, 'Derived', 'Overload estimate per trip', OS),
  // Driver
  p(37, 'driver_score', 'driver', 'Driver behaviour score', PRO, 'Derived', 'Driver ratings', OD),
  p(35, 'driver_id', 'driver', 'Driver ID', ADD_PRO, 'Add-on sensor', 'Driver linked to every trip', OD, 'driver_safety'),
  p(36, 'driver_camera', 'driver', 'Dashcam / fatigue camera', ADD_PRO, 'Add-on sensor', 'Drowsiness / incident video', OD, 'driver_safety'),
  p(50, 'panic_button', 'driver', 'Emergency (panic) button', ADD, 'Our sensor', 'Panic alert to owner + contacts', OD, 'ais140'),
  // Device
  p(39, 'device_tamper', 'device', 'Tamper / power-cut / GNSS jamming', ALL, 'Our sensor', 'Tamper / power-cut alarm', O),
]

/** Rows 51-55: parked, not in any plan yet. Shown to the owner as "planned later". */
export const PARKED: string[] = [
  'Axle load / GVW',
  'Fifth-wheel / kingpin angle',
  'Cabin CO₂, cabin temperature, reverse proximity, interior light, seatbelt',
  'ABS wheel speed ×4, suspension air pressure',
  'Brake lining wear',
]

export type ParamStatus = 'ok' | 'warning' | 'critical' | 'info'

/** One parameter's current value, as shown on screen. */
export interface ParamValue {
  /** Display text, e.g. "88 °C" */
  text: string
  /** Optional second line, e.g. "Normal 80-95 °C" */
  note?: string
  status?: ParamStatus
}

/** What a truck gets for a parameter: live, locked by plan, an add-on not fitted. */
export type Access = { kind: 'on' } | { kind: 'plan'; needs: Plan } | { kind: 'addon'; addOn: AddOn; needs?: Plan }

export function accessFor(def: ParamDef, plan: Plan, addOns: AddOn[] = []): Access {
  const a = def.plans[plan]
  if (a === 'yes') return { kind: 'on' }
  if (a === 'addon') return def.addOn && addOns.includes(def.addOn) ? { kind: 'on' } : { kind: 'addon', addOn: def.addOn! }
  // Not in this plan: which plan is the first to have it?
  const needs: Plan = def.plans.pro !== '-' ? 'pro' : 'fleet'
  if (def.plans[needs] === 'addon') return { kind: 'addon', addOn: def.addOn!, needs }
  return { kind: 'plan', needs }
}

/**
 * Values worked out in the browser from data the API already sends
 * (tyres, open alerts, position, battery), so they are real even without the engine plug-in.
 */
export function derivedValues(truck: TruckSummary, leakKpaPerHour?: { position: string; rate: number } | null): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  const withData = truck.tyres.filter((t) => t.latest)
  if (withData.length) {
    const low = withData.reduce((a, b) => (b.latest!.pressure_kpa < a.latest!.pressure_kpa ? b : a))
    const lowC = withData.reduce((a, b) => (b.latest!.corrected_kpa < a.latest!.corrected_kpa ? b : a))
    const hot = withData.reduce((a, b) => (b.latest!.temp_c > a.latest!.temp_c ? b : a))
    const bad = truck.tyres.filter((t) => t.status === 'warning' || t.status === 'critical').length
    out.tyre_pressure = {
      text: `Lowest ${kpaToPsi(low.latest!.pressure_kpa).toFixed(1)} psi · ${low.position}`,
      note: bad ? `${bad} of ${truck.tyres.length} tyres need a look` : `All ${truck.tyres.length} tyres OK`,
      status: truck.tyres.some((t) => t.status === 'critical') ? 'critical' : bad ? 'warning' : 'ok',
    }
    out.tyre_temperature = {
      text: `Hottest ${Math.round(hot.latest!.temp_c)} °C · ${hot.position}`,
      note: `Limit ${hot.max_temp_c} °C`,
      status: hot.latest!.temp_c > hot.max_temp_c ? 'warning' : 'ok',
    }
    const lowPct = lowC.latest!.corrected_kpa / lowC.recommended_cold_kpa
    out.tyre_pressure_corrected = {
      text: `Lowest ${kpaToPsi(lowC.latest!.corrected_kpa).toFixed(1)} psi · ${lowC.position}`,
      note: `${Math.round(lowPct * 100)}% of recommended ${kpaToPsi(lowC.recommended_cold_kpa).toFixed(0)} psi (at 20 °C)`,
      status: lowPct < 0.8 ? 'critical' : lowPct < 0.9 ? 'warning' : 'ok',
    }
  }
  out.tyre_leak_rate = leakKpaPerHour
    ? { text: `${kpaToPsi(leakKpaPerHour.rate).toFixed(1)} psi / hour · ${leakKpaPerHour.position}`, note: 'Slow leak: see the alert for the countdown', status: 'warning' }
    : { text: 'No leak', note: 'Corrected pressure is steady on every tyre', status: 'ok' }
  const offline = truck.tyres.filter((t) => t.status === 'offline')
  out.tpms_sensor_health = {
    text: `${truck.tyres.length - offline.length} of ${truck.tyres.length} sensors reporting`,
    note: offline.length ? `Not heard from: ${offline.map((t) => t.position).join(', ')}` : undefined,
    status: offline.length ? 'warning' : 'ok',
  }
  if (truck.lat != null && truck.lon != null) {
    const town = nearestTown(truck.lat, truck.lon)
    out.gps_position = {
      text: town.km < 5 ? `In ${town.name}` : `About ${Math.round(town.km)} km from ${town.name}`,
      note: `${truck.lat.toFixed(4)}, ${truck.lon.toFixed(4)}`,
      status: 'ok',
    }
  }
  if (truck.battery_v != null) {
    out.battery_voltage = {
      text: `${truck.battery_v.toFixed(1)} V`,
      note: '24 V system',
      status: truck.battery_v < 24 ? 'warning' : 'ok',
    }
  }
  return out
}
