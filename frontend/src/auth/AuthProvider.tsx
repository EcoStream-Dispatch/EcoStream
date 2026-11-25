import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase'

/*
 * Who is logged in. Wrap the app in <AuthProvider>, then in any component:
 *   const { session, signIn, signOut } = useAuth()
 *
 * Supabase keeps the session in the browser and refreshes the token by itself.
 */
interface AuthState {
  /** false while we're still checking for a saved session on page load */
  ready: boolean
  session: Session | null
  /** true when there is no Supabase config: the app shows mock data, no login needed */
  demoMode: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  /** Phone login, step 1: send an SMS code. Needs an SMS provider set up in Supabase. */
  sendOtp: (phone: string) => Promise<string | null>
  /** Phone login, step 2: check the code. */
  verifyOtp: (phone: string, code: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!SUPABASE_CONFIGURED)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    // Fires on login, logout and token refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  /** Returns an error message, or null when login worked. */
  async function signIn(email: string, password: string): Promise<string | null> {
    if (!supabase) return 'Login is not set up (no Supabase keys).'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return null
    if (error.message.toLowerCase().includes('invalid login')) return 'Wrong email or password.'
    return error.message
  }

  async function sendOtp(phone: string): Promise<string | null> {
    if (!supabase) return 'Login is not set up (no Supabase keys).'
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (!error) return null
    if (error.message.toLowerCase().includes('provider')) return 'Phone login is not switched on yet. Use email for now.'
    return error.message
  }

  async function verifyOtp(phone: string, code: string): Promise<string | null> {
    if (!supabase) return 'Login is not set up (no Supabase keys).'
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
    if (!error) return null
    if (error.message.toLowerCase().includes('expired') || error.message.toLowerCase().includes('invalid'))
      return 'Wrong or expired code. Tap "Resend OTP".'
    return error.message
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      // No network (common on highways): Supabase keeps the session when the logout
      // request fails. Log out on this phone anyway by removing the saved session.
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach((k) => localStorage.removeItem(k))
      setSession(null)
    }
  }

  return (
    <AuthContext.Provider value={{ ready, session, demoMode: !SUPABASE_CONFIGURED, signIn, sendOtp, verifyOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
