import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Loading } from '../components/PageState'

/** Owner pages: send logged-out visitors to /login (except in demo mode). */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, session, demoMode } = useAuth()
  const location = useLocation()

  if (demoMode) return <>{children}</>
  if (!ready) return <Loading what="your account" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
