/*
 * Plans, add-ons and every parameter EcoStream can show, with which plan unlocks it.
 * Source: docs/WEBSITE_SPEC.md ("Parameters to display").
 *
 * The Plans page uses this for the comparison table. The Truck page (stage W3)
 * will use the same list to decide which cards are locked.
 *
 * TODO: docs/PLANS_SPEC.md (with the official 55 parameter keys) is not in the repo yet.
 * The `key` values below are our own provisional names. Replace them with the
 * PLANS_SPEC keys when that file arrives.
 */

export type PlanId = 'lite' | 'pro' | 'fleet'

export type Plan = {
  id: PlanId
  name: string
  /** ₹ per truck per month, paid monthly */
  price: number
  /** Normal price, shown crossed out when a founding-member offer applies */
  listPrice?: number
  offerNote?: string
  summary: string
  highlights: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'lite',
    name: 'Lite',
    price: 299,
    listPrice: 399,
    offerNote: 'Founding-member price',
    summary: 'Tyres, location and truck power, on any truck.',
    highlights: [
      'Pressure and temperature of every tyre',
      'Slow-leak warning with "unsafe in ~X h"',
      'Live location, speed and harsh-brake count',
      'Truck battery and ignition',
      'Nearest open verified garages on every alert',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 499,
    summary: 'Everything in Lite, plus engine and brakes from the truck’s CAN bus.',
    highlights: [
      'Everything in Lite',
      'Engine fault codes in plain Tamil / English',
      'Coolant, oil, fuel, AdBlue and DPF',
      'Air-brake pressure and brake air leaks',
      'Driver behaviour score (0-100)',
    ],
  },
  {
    id: 'fleet',
    name: 'Fleet',
    price: 899,
    summary: 'Everything in Pro, plus payload estimate, for larger fleets.',
    highlights: ['Everything in Pro', 'Payload estimate (no load cells needed)'],
  },
]

/** Annual prepaid discount */
export const ANNUAL_DISCOUNT = 0.1

export function monthlyPrice(plan: Plan, annual: boolean): number {
  return annual ? Math.round(plan.price * (1 - ANNUAL_DISCOUNT)) : plan.price
}

export type AddOnId =
  | 'fuel_monitoring'
  | 'cold_chain'
  | 'cargo_security'
  | 'wheel_end_temp'
  | 'driver_safety'
  | 'breakdown_assist'
  | 'panic_button_kit'

export type AddOn = { id: AddOnId; name: string; text: string; public: boolean }

// Prices for add-ons are not decided yet, so the site says "price on request".
export const ADD_ONS: AddOn[] = [
  { id: 'fuel_monitoring', name: 'Fuel monitoring', text: 'Accurate fuel-level probe in litres, to spot theft and refuel issues.', public: true },
  { id: 'cold_chain', name: 'Cold chain', text: 'Cargo temperature and humidity for reefer loads.', public: true },
  { id: 'cargo_security', name: 'Cargo security', text: 'Door open/close and cargo seal status.', public: true },
  { id: 'wheel_end_temp', name: 'Wheel-hub temperature', text: 'Hub temperature on each wheel, to catch hot bearings and dragging brakes.', public: true },
  { id: 'driver_safety', name: 'Driver safety', text: 'Driver ID and a fatigue camera that flags drowsiness.', public: true },
  { id: 'breakdown_assist', name: 'Breakdown assistance', text: 'Help arranging a verified garage or mechanic when a truck stops.', public: true },
  // In the parameter list (panic button) but not in the public add-on list.
  { id: 'panic_button_kit', name: 'Panic button kit', text: 'Emergency button in the cab.', public: false },
]

/** Who unlocks a parameter: a plan tier (that plan and above) or an add-on. */
export type Unlock = { tier: PlanId } | { addOn: AddOnId }

export type ParamGroup =
  | 'Tyres'
  | 'Location & Context'
  | 'Power'
  | 'Device'
  | 'Engine'
  | 'Brakes & Chassis'
  | 'Driver'
  | 'Fuel'
  | 'Cargo'

export type Param = { key: string; group: ParamGroup; name: string; unit: string; unlock: Unlock }

const lite = { tier: 'lite' } as const
const pro = { tier: 'pro' } as const
const fleet = { tier: 'fleet' } as const
const addOn = (id: AddOnId) => ({ addOn: id })

export const PARAMS: Param[] = [
  // Tyres
  { key: 'tyre_pressure', group: 'Tyres', name: 'Tyre pressure (each wheel)', unit: 'psi + bar', unlock: lite },
  { key: 'tyre_temp', group: 'Tyres', name: 'Tyre air temperature (each wheel)', unit: '°C', unlock: lite },
  { key: 'tyre_pressure_corrected', group: 'Tyres', name: 'Temperature-corrected pressure', unit: 'psi at 20 °C', unlock: lite },
  { key: 'tyre_leak_rate', group: 'Tyres', name: 'Leak rate (trend)', unit: 'psi/hour + "unsafe in ~X h"', unlock: lite },
  { key: 'tyre_sensor_health', group: 'Tyres', name: 'Sensor battery / signal health', unit: 'battery % + signal', unlock: lite },
  { key: 'tyre_tread_depth', group: 'Tyres', name: 'Tyre tread depth', unit: 'mm per tyre', unlock: lite },
  // Location & context
  { key: 'gps', group: 'Location & Context', name: 'GPS position, speed, heading', unit: 'map pin, km/h, heading', unlock: lite },
  { key: 'gradient', group: 'Location & Context', name: 'Altitude / road gradient', unit: '% + altitude m', unlock: pro },
  { key: 'cell_signal', group: 'Location & Context', name: 'Cellular signal strength + network', unit: 'bars / dBm', unlock: lite },
  { key: 'ambient_temp', group: 'Location & Context', name: 'Ambient temperature', unit: '°C', unlock: lite },
  { key: 'accel_events', group: 'Location & Context', name: 'Harsh brake, pothole and crash detection', unit: 'count of events', unlock: lite },
  { key: 'road_roughness', group: 'Location & Context', name: 'Road roughness / pothole map', unit: 'bad-road stretches on map', unlock: pro },
  // Power
  { key: 'battery_voltage', group: 'Power', name: 'Truck battery voltage (24 V)', unit: 'V', unlock: lite },
  { key: 'ignition', group: 'Power', name: 'Ignition on/off', unit: 'on/off', unlock: lite },
  { key: 'battery_health', group: 'Power', name: 'Battery health (cranking voltage dip)', unit: 'lowest start voltage', unlock: lite },
  // Device
  { key: 'device_tamper', group: 'Device', name: 'Device tamper / power-cut / GPS jamming', unit: 'events', unlock: lite },
  // Engine (from the truck's CAN bus)
  { key: 'dtc', group: 'Engine', name: 'Active & stored fault codes', unit: 'code + plain meaning + action', unlock: pro },
  { key: 'coolant_temp', group: 'Engine', name: 'Coolant temperature', unit: '°C', unlock: pro },
  { key: 'coolant_level', group: 'Engine', name: 'Coolant level', unit: 'OK / low', unlock: pro },
  { key: 'oil_pressure', group: 'Engine', name: 'Engine oil pressure', unit: 'kPa', unlock: pro },
  { key: 'oil_temp', group: 'Engine', name: 'Engine oil temperature', unit: '°C', unlock: pro },
  { key: 'engine_rpm', group: 'Engine', name: 'Engine speed', unit: 'rpm', unlock: pro },
  { key: 'engine_load', group: 'Engine', name: 'Engine load and accelerator position', unit: '%', unlock: pro },
  { key: 'intake_boost', group: 'Engine', name: 'Intake air temperature + boost pressure', unit: '°C, kPa', unlock: pro },
  { key: 'exhaust_temp', group: 'Engine', name: 'Exhaust gas temperature', unit: '°C', unlock: pro },
  { key: 'fuel_rate', group: 'Engine', name: 'Fuel rate', unit: 'L/h, km/L', unlock: pro },
  { key: 'fuel_level_can', group: 'Engine', name: 'Fuel level', unit: '%', unlock: pro },
  { key: 'def_level', group: 'Engine', name: 'DEF / AdBlue level', unit: '%', unlock: pro },
  { key: 'dpf_soot', group: 'Engine', name: 'DPF differential pressure / soot load', unit: '%', unlock: pro },
  { key: 'engine_hours_odometer', group: 'Engine', name: 'Engine hours + odometer', unit: 'h, km', unlock: pro },
  { key: 'wheel_speed', group: 'Engine', name: 'Wheel-based vehicle speed', unit: 'km/h', unlock: pro },
  { key: 'idle_time', group: 'Engine', name: 'Idle time', unit: 'min/day', unlock: pro },
  { key: 'transmission_oil_temp', group: 'Engine', name: 'Transmission oil temperature', unit: '°C', unlock: pro },
  { key: 'clutch_slip', group: 'Engine', name: 'Clutch slip', unit: '%', unlock: pro },
  { key: 'water_in_fuel', group: 'Engine', name: 'Water-in-fuel indicator', unit: 'yes/no', unlock: pro },
  { key: 'air_filter', group: 'Engine', name: 'Air filter restriction', unit: 'kPa / OK-change', unlock: pro },
  { key: 'oil_life', group: 'Engine', name: 'Engine oil life estimate', unit: '% remaining', unlock: pro },
  // Brakes & chassis
  { key: 'air_brake_pressure', group: 'Brakes & Chassis', name: 'Air-brake tank pressure', unit: 'bar', unlock: pro },
  { key: 'hub_temp', group: 'Brakes & Chassis', name: 'Wheel-end / hub temperature', unit: '°C per wheel', unlock: addOn('wheel_end_temp') },
  { key: 'vibration', group: 'Brakes & Chassis', name: 'Vibration signature (driveline / bearings)', unit: 'normal / rising', unlock: pro },
  { key: 'brake_air_leak', group: 'Brakes & Chassis', name: 'Brake air leak rate', unit: 'bar/min', unlock: pro },
  // Driver
  { key: 'driver_id', group: 'Driver', name: 'Driver ID', unit: 'driver name', unlock: addOn('driver_safety') },
  { key: 'driver_fatigue', group: 'Driver', name: 'Driver fatigue camera', unit: 'drowsiness events', unlock: addOn('driver_safety') },
  { key: 'driver_score', group: 'Driver', name: 'Driver behaviour score', unit: '0-100', unlock: pro },
  { key: 'panic_button', group: 'Driver', name: 'Emergency (panic) button', unit: 'SOS events', unlock: addOn('panic_button_kit') },
  // Fuel add-on
  { key: 'fuel_level_probe', group: 'Fuel', name: 'Fuel level (accurate probe)', unit: 'litres', unlock: addOn('fuel_monitoring') },
  // Cargo
  { key: 'cargo_temp_humidity', group: 'Cargo', name: 'Cargo temperature & humidity (reefers)', unit: '°C, %RH', unlock: addOn('cold_chain') },
  { key: 'cargo_door', group: 'Cargo', name: 'Door open/close', unit: 'open/closed', unlock: addOn('cargo_security') },
  { key: 'cargo_seal', group: 'Cargo', name: 'Cargo lock / seal status', unit: 'intact/broken', unlock: addOn('cargo_security') },
  { key: 'payload_estimate', group: 'Cargo', name: 'Payload estimate (no load cells)', unit: 't (estimate)', unlock: fleet },
]

const TIER_ORDER: PlanId[] = ['lite', 'pro', 'fleet']

/** How a parameter relates to a plan: included, add-on, or not available. */
export function availability(param: Param, plan: PlanId): 'included' | 'addon' | 'no' {
  if ('addOn' in param.unlock) return 'addon'
  return TIER_ORDER.indexOf(plan) >= TIER_ORDER.indexOf(param.unlock.tier) ? 'included' : 'no'
}

export function addOnName(id: AddOnId): string {
  return ADD_ONS.find((a) => a.id === id)?.name ?? id
}

/** Parameters grouped in display order, for tables and cards. */
export function paramsByGroup(): { group: ParamGroup; params: Param[] }[] {
  const groups: { group: ParamGroup; params: Param[] }[] = []
  for (const p of PARAMS) {
    let g = groups.find((x) => x.group === p.group)
    if (!g) groups.push((g = { group: p.group, params: [] }))
    g.params.push(p)
  }
  return groups
}
