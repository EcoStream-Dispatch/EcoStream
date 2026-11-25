import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { Loading } from '../components/PageState'

/*
 * Adithya's pages from the team repo (EcoStream-Dispatch/EcoStream, stages W1-W7) that the
 * merged app didn't have yet. Their code and helpers live in src/portal/ unchanged except
 * for small adapters (shared login, language, Supabase client and live updates).
 * Loaded lazily so the map library (leaflet) only downloads on these pages.
 */
export const AboutPage = lazy(() => import('./pages/AboutPage'))
export const GaragesJoinPage = lazy(() => import('./pages/GaragesJoinPage'))
export const ShipmentsPage = lazy(() => import('./pages/owner/ShipmentsPage'))
export const CreateShipmentPage = lazy(() => import('./pages/owner/CreateShipmentPage'))
export const ShipmentRoutingPage = lazy(() => import('./pages/owner/ShipmentRoutingPage'))
export const PredictivePage = lazy(() => import('./pages/owner/PredictivePage'))
export const GaragesPage = lazy(() => import('./pages/owner/GaragesPage'))
export const SettingsPage = lazy(() => import('./pages/owner/SettingsPage'))
export const MyTripPage = lazy(() => import('./pages/driver/MyTripPage'))
export const DriverHistoryPage = lazy(() => import('./pages/driver/DriverHistoryPage'))
export const SosPage = lazy(() => import('./pages/driver/SosPage'))
export const DriverLayout = lazy(() => import('./pages/driver/DriverLayout'))
const DriverDataProviderLazy = lazy(() => import('./pages/driver/DriverLayout').then((m) => ({ default: m.DriverDataProvider })))

/** Suspense wrapper for one lazy page. */
export function Lazy({ what, children }: { what: string; children: ReactNode }) {
  return <Suspense fallback={<Loading what={what} />}>{children}</Suspense>
}

/** Driver data (sample trip) for Adithya's driver pages. */
export function DriverPortal() {
  return (
    <Lazy what="your trip">
      <DriverDataProviderLazy>
        <Outlet />
      </DriverDataProviderLazy>
    </Lazy>
  )
}

/** Old team-repo addresses -> the merged app's pages. */
export function RedirectParam({ to }: { to: (id: string) => string }) {
  const { id = '' } = useParams()
  return <Navigate to={to(id)} replace />
}
