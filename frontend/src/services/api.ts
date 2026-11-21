/*
 * THE ONLY PLACE THE APP GETS DATA FROM.
 *
 * Every page calls these functions. Each one matches an API endpoint (spec section 5),
 * written above it.
 *
 *   Supabase keys set  -> real FastAPI backend, with the owner's login token
 *   no Supabase keys   -> demo mode: made-up data from src/data/mock.ts
 */
import type { Alert, NearbyGarage, Reading, TruckSummary } from '../types'
import {
  mockAckAlert,
  mockGetAlerts,
  mockGetNearestGarages,
  mockGetReadings,
  mockGetTrucks,
} from '../data/mock'
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
