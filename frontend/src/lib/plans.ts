import type { Plan, Truck } from '../types'

/*
 * Subscription plans (Excel "Subscription Tiers" sheet).
 * Prices are PROPOSED, per truck per month, to be confirmed in our pilot.
 * There is no payment flow in the prototype.
 */

export interface PlanInfo {
  id: Plan
  name: string
  /** ₹ per truck per month */
  priceInr: number
  tagline: string
  /** What this plan adds on top of the one before it */
  features: string[]
}

export const PLANS: PlanInfo[] = [
  {
    id: 'lite',
    name: 'Lite',
    priceInr: 249,
    tagline: 'Tyre safety for every truck',
    features: [
      'Tyre pressure and temperature alerts',
      'Slow-leak detection',
      'Compliance reminders',
      'Nearest verified 24×7 garage',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceInr: 499,
    tagline: 'Engine health and planned stops',
    features: [
      'Engine and fault-code (DTC) monitoring',
      'Failure prediction',
      'Pre-ghat and dead-zone check',
      'Reroute and book a garage slot',
      'Driver ratings',
      'Basic dashboard with monthly reports',
    ],
  },
  {
    id: 'fleet',
    name: 'Fleet',
    priceInr: 899,
    tagline: 'For owners running a full fleet',
    features: ['Full dashboard', 'API and data export, with benchmarking', 'Priority support'],
  },
]

export const ADD_ONS: { name: string; price: string }[] = [
  { name: 'Fuel monitoring', price: '₹200 / truck / month' },
  { name: 'Cold-chain monitoring', price: '₹350 / truck / month' },
  { name: 'Breakdown assistance', price: '₹2,000 / truck / year' },
]

/** Discount for paying a year in advance. */
export const ANNUAL_DISCOUNT = 0.1

/** The API has no plan yet: treat a truck without one as Lite. */
export const planOf = (t: Pick<Truck, 'plan'>): Plan => t.plan ?? 'lite'

export const PLAN_NAME: Record<Plan, string> = { lite: 'Lite', pro: 'Pro', fleet: 'Fleet' }

/** Does this plan include Pro features? */
export const hasPro = (p: Plan) => p === 'pro' || p === 'fleet'

/** "₹2,689" */
export const formatInr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
