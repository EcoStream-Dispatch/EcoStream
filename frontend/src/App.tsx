import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import AppLayout from './components/AppLayout'
import RequireAuth from './auth/RequireAuth'
import FleetPage from './pages/FleetPage'
import AlertsPage from './pages/AlertsPage'
import AlertDetailPage from './pages/AlertDetailPage'
import BookingPage from './pages/BookingPage'
import PlansPage from './pages/PlansPage'
import ProfilePage from './pages/ProfilePage'
import DriversPage from './pages/DriversPage'
import ReportsPage from './pages/ReportsPage'
import { Loading } from './components/PageState'
import PhotoHero from './landing3d/PhotoHero'
import { hasWebGL } from './landing3d/store'

// The Truck page pulls in the chart library (recharts), which is big.
// Loading it only when needed keeps the first page load fast on phones.
const TruckPage = lazy(() => import('./pages/TruckPage'))
const DriverPage = lazy(() => import('./pages/DriverPage'))
const ShipperPage = lazy(() => import('./pages/ShipperPage'))
// The 3D landing page (three.js) is only loaded on "/", so the app itself stays light.
const Landing3D = lazy(() => import('./landing3d/Landing3D'))
// The photo-real landing page (no three.js): the default.
const PhotoStory = lazy(() => import('./landing3d/PhotoStory'))

/**
 * Photo-real landing by default. "?3d" shows the 3D digital-twin tour, "?static" the calm
 * version (also used when the visitor has asked for less motion).
 */
function HomeRoute() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || params.has('static')) return <LandingPage />
  if (params.has('3d') && hasWebGL()) {
    return (
      <Suspense fallback={<PhotoHero loading3d />}>
        <Landing3D />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<PhotoHero />}>
      <PhotoStory />
    </Suspense>
  )
}

/**
 * All routes live here.
 * Public: landing + login. Owner pages need a login (RequireAuth; skipped in demo mode)
 * and sit inside AppLayout (top bar, tab bar, live connection).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/driver"
        element={
          <RequireAuth>
            <Suspense fallback={<Loading what="cockpit" />}>
              <DriverPage />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/shipper"
        element={
          <RequireAuth>
            <Suspense fallback={<Loading what="shipment" />}>
              <ShipperPage />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/fleet" element={<FleetPage />} />
        <Route
          path="/trucks/:id"
          element={
            <Suspense fallback={<Loading what="truck" />}>
              <TruckPage />
            </Suspense>
          }
        />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
        <Route path="/bookings/:id" element={<BookingPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
