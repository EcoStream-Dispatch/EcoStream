import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase'
import { isRole, type Role } from './roles'

/*
 * Who is logged in, and as which role (owner / driver / shipper).
 *   const { role, signIn, signOut } = useAuth()
 *
 * Real mode (Supabase keys set): email + password through Supabase Auth.
 *   The role comes from the user's row in public.profiles, which users can't change.
 * Demo mode (no Supabase keys): no real login. The login page just picks a role
 *   (remembered for this browser tab) so every portal can be shown with sample data.
 */
interface AuthState {
  /** false while we're still checking for a saved session and its role */
  ready: boolean
  session: Session | null
  /** the logged-in role, or null when logged out */
  role: Role | null
  /** true when there is no Supabase config: sample data, pretend login */
  demoMode: boolean
  /** Log in. `asRole` is what was picked on the login page. Returns an error message, or null. */
  signIn: (email: string, password: string, asRole: Role) => Promise<string | null>
  /** Demo mode only: "log in" as a role without a password. */
  enterDemo: (role: Role) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const DEMO_ROLE_KEY = 'ecostream.demoRole'

const ROLE_WORD: Record<Role, string> = { owner: 'Owner', driver: 'Driver', shipper: 'Shipper' }

/** Read the user's role from public.profiles (RLS: only their own row is visible). */
async function fetchRole(): Promise<Role | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('role').maybeSingle()
  if (error || !data) return null
  return isRole(data.role) ? data.role : null
}

function savedDemoRole(): Role | null {
  try {
    const v = sessionStorage.getItem(DEMO_ROLE_KEY)
    return isRole(v) ? v : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(SUPABASE_CONFIGURED ? null : savedDemoRole)
  const [ready, setReady] = useState(!SUPABASE_CONFIGURED)
  // True while signIn() is checking the role. The background listener must not
  // set the role then, or a wrong-role login could open a portal for a moment.
  const signingIn = useRef(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    async function apply(s: Session | null) {
      if (signingIn.current) return
      const r = s ? await fetchRole() : null
      if (cancelled || signingIn.current) return
      setSession(s)
      setRole(r)
      setReady(true)
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    // Fires on login, logout and token refresh.
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refresh: same user, same role, no need to ask the database again.
      if (event === 'TOKEN_REFRESHED') setSession(s)
      // Run outside this callback (Supabase advises not to await inside it).
      else setTimeout(() => apply(s), 0)
    })
    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string, asRole: Role): Promise<string | null> {
    if (!supabase) return 'Login is not set up (no Supabase keys).'
    signingIn.current = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.toLowerCase().includes('invalid login')) return 'Wrong email or password.'
        return error.message
      }
      const actual = await fetchRole()
      if (!actual) {
        await signOut()
        return 'This account has no role yet. Ask EcoStream to set it up.'
      }
      if (actual !== asRole) {
        await signOut()
        return `This is a ${ROLE_WORD[actual]} account. Choose "${ROLE_WORD[actual]}" above and log in again.`
      }
      setSession(data.session)
      setRole(actual)
      setReady(true)
      return null
    } finally {
      signingIn.current = false
    }
  }

  function enterDemo(r: Role) {
    setRole(r)
    try {
      sessionStorage.setItem(DEMO_ROLE_KEY, r)
    } catch {
      // storage blocked: the role still works until the page is reloaded
    }
  }

  async function signOut() {
    if (!supabase) {
      setRole(null)
      try {
        sessionStorage.removeItem(DEMO_ROLE_KEY)
      } catch {
        // ignore
      }
      return
    }
    const { error } = await supabase.auth.signOut()
    if (error) {
      // No network (common on highways): Supabase keeps the session when the logout
      // request fails. Log out on this phone anyway by removing the saved session.
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach((k) => localStorage.removeItem(k))
    }
    setSession(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ ready, session, role, demoMode: !SUPABASE_CONFIGURED, signIn, enterDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
