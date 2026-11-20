import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/*
 * The one Supabase client for the browser.
 * Uses the ANON (publishable) key only - safe to ship, because row-level security
 * decides what each logged-in owner can read. Never put the service-role key here.
 *
 * If VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set (e.g. Rishi working without
 * the backend), `supabase` is null and the app runs in DEMO MODE on mock data.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const SUPABASE_CONFIGURED = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = SUPABASE_CONFIGURED ? createClient(url!, anonKey!) : null
