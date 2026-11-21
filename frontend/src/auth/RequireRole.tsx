import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { PORTAL_HOME, type Role } from './roles'
import { Loading } from '../components/PageState'

/**
 * Route guard: only the given role may see these pages.
 *   - logged out          -> /login (and back here after logging in)
 *   - logged in, other role -> that role's own portal
 * Works the same in demo mode, using the role picked on the login page.
 *
 * This only decides what the browser shows. The real protection is on the
 * server: row-level security in Supabase and the owner-role check in the API.
 */
export default function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { ready, role: current } = useAuth()
  const location = useLocation()

  if (!ready) return <Loading what="your account" />
  if (!current) return <Navigate to="/login" replace state={{ from: location.pathname, role }} />
  if (current !== role) return <Navigate to={PORTAL_HOME[current]} replace />
  return <>{children}</>
}
