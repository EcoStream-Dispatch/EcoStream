/*
 * THE ONLY PLACE THE APP GETS DATA FROM.
 *
 * Every page calls these functions. Right now they return mock data from
 * src/data/mock.ts. In Stage 6 we replace the body of each function with a
 * real fetch() to the FastAPI backend (spec section 5) - nothing else changes.
 *
 * Each function matches one API endpoint; the endpoint is written above it.
 */
import type { Alert, NearbyGarage, Reading, TruckSummary } from '../types'
import {
  mockAckAlert,
  mockGetAlerts,
  mockGetNearestGarages,
  mockGetReadings,
  mockGetTrucks,
} from '../data/mock'

/** True while we are on mock data. The UI shows a "Demo data" label when true. */
export const USING_MOCK_DATA = true

/** Pretend network delay so loading states get exercised during development. */
const delay = <T>(value: T, ms = 150): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

/** GET /api/trucks - the owner's trucks with latest tyre status */
export async function getTrucks(): Promise<TruckSummary[]> {
  return delay(mockGetTrucks())
}

/** One truck. Uses GET /api/trucks (the spec has no single-truck endpoint). */
export async function getTruck(id: string): Promise<TruckSummary | null> {
  const trucks = await getTrucks()
  return trucks.find((t) => t.id === id) ?? null
}

/** GET /api/trucks/{id}/readings?from=&to= - history for charts */
export async function getReadings(truckId: string, from: Date, to: Date = new Date()): Promise<Reading[]> {
  return delay(mockGetReadings(truckId, from.toISOString(), to.toISOString()))
}

/** GET /api/alerts?open=true|false - leave `open` out for all alerts */
export async function getAlerts(open?: boolean): Promise<Alert[]> {
  return delay(mockGetAlerts(open))
}

/** POST /api/alerts/{id}/ack - acknowledge an alert */
export async function ackAlert(id: string): Promise<Alert> {
  return delay(mockAckAlert(id))
}

/** GET /api/garages/nearest?lat=&lon=&service=tyre - 3 nearest garages open now */
export async function getNearestGarages(lat: number, lon: number, service = 'tyre'): Promise<NearbyGarage[]> {
  return delay(mockGetNearestGarages(lat, lon, service))
}
