import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Alert, Reading } from '../types'

/*
 * Live updates through Supabase Realtime (spec section 6.5).
 *
 * The database sends every new row in `readings` and every new/changed row in `alerts`.
 * Row-level security still applies, so an owner only receives their own trucks' rows.
 * In demo mode (no Supabase) these hooks do nothing.
 */

export type LiveStatus = 'off' | 'connecting' | 'live' | 'error'

interface Handlers {
  onReading?: (r: Reading) => void
  onAlert?: (a: Alert) => void
}

/** Realtime can send numbers as strings; make sure charts get numbers. */
function toReading(row: Record<string, unknown>): Reading {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    id: Number(row.id),
    tyre_id: String(row.tyre_id),
    ts: String(row.ts),
    pressure_kpa: Number(row.pressure_kpa),
    temp_c: Number(row.temp_c),
    ambient_c: num(row.ambient_c),
    lat: num(row.lat),
    lon: num(row.lon),
    rssi: num(row.rssi),
    corrected_kpa: Number(row.corrected_kpa),
  }
}

let channelCount = 0

/** One Realtime connection for the whole app; LiveProvider owns it. */
function useLiveUpdates(handlers: Handlers): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(supabase ? 'connecting' : 'off')
  // Keep the latest handlers without re-subscribing every render.
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client
      .channel(`live-${++channelCount}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, (p) =>
        ref.current.onReading?.(toReading(p.new as Record<string, unknown>)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, (p) => {
        if (p.new && Object.keys(p.new).length) ref.current.onAlert?.(p.new as Alert)
      })
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setStatus('live')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error')
        else if (s === 'CLOSED') setStatus('off')
      })
    return () => {
      client.removeChannel(channel)
    }
  }, [])

  return status
}

/**
 * Call `fn` at most once every `ms` milliseconds, however often it's triggered.
 * Readings arrive every few seconds; we don't want to re-fetch on each one.
 */
export function useThrottled(fn: () => void, ms = 3000): () => void {
  const last = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  return () => {
    const wait = last.current + ms - Date.now()
    if (wait <= 0) {
      last.current = Date.now()
      fnRef.current()
    } else if (!timer.current) {
      timer.current = setTimeout(() => {
        timer.current = null
        last.current = Date.now()
        fnRef.current()
      }, wait)
    }
  }
}

// ---------------------------------------------------------------------------
// One shared connection, many listeners
// ---------------------------------------------------------------------------

const listeners = new Set<Handlers>()
const LiveContext = createContext<LiveStatus>('off')

/** Put around the owner pages (AppLayout does this). Opens one Realtime connection. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const status = useLiveUpdates({
    onReading: (r) => listeners.forEach((h) => h.onReading?.(r)),
    onAlert: (a) => listeners.forEach((h) => h.onAlert?.(a)),
  })
  return <LiveContext.Provider value={status}>{children}</LiveContext.Provider>
}

/** 'live' when connected. */
export function useLiveStatus(): LiveStatus {
  return useContext(LiveContext)
}

/**
 * Run handlers when a new reading or alert change arrives.
 *   useLiveEvents({ onReading: (r) => ..., onAlert: (a) => ... })
 */
export function useLiveEvents(handlers: Handlers): void {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    const h: Handlers = {
      onReading: (r) => ref.current.onReading?.(r),
      onAlert: (a) => ref.current.onAlert?.(a),
    }
    listeners.add(h)
    return () => {
      listeners.delete(h)
    }
  }, [])
}
