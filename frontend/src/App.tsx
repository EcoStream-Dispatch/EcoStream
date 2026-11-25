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
import {
  AboutPage,
  CreateShipmentPage,
  DriverHistoryPage,
  DriverLayout,
  DriverPortal,
  GaragesJoinPage,
  GaragesPage,
  Lazy,
  MyTripPage,
  PredictivePage,
  RedirectParam,
  SettingsPage,
  ShipmentRoutingPage,
  ShipmentsPage,
  SosPage,
} from './portal/routes'

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
      {/* Public pages from the team repo (Adithya, W1) */}
      <Route path="/about" element={<Lazy what="page"><AboutPage /></Lazy>} />
      <Route path="/garages/join" element={<Lazy what="page"><GaragesJoinPage /></Lazy>} />
      {/* Driver pages from the team repo (Adithya, W5): my trip, SOS, my trips */}
      <Route
        element={
          <RequireAuth>
            <DriverPortal />
          </RequireAuth>
        }
      >
        <Route element={<Lazy what="driver"><DriverLayout /></Lazy>}>
          <Route path="/driver/trip" element={<Lazy what="your trip"><MyTripPage /></Lazy>} />
          <Route path="/driver/sos" element={<Lazy what="SOS"><SosPage /></Lazy>} />
          <Route path="/driver/history" element={<Lazy what="your trips"><DriverHistoryPage /></Lazy>} />
        </Route>
      </Route>
      <Route path="/driver/truck" element={<Navigate to="/driver" replace />} />
      <Route path="/driver/alert/:id" element={<Navigate to="/driver" replace />} />
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
        {/* Owner pages from the team repo (Adithya, W3-W4) */}
        <Route path="/owner/shipments" element={<Lazy what="shipments"><ShipmentsPage /></Lazy>} />
        <Route path="/owner/shipments/new" element={<Lazy what="new shipment"><CreateShipmentPage /></Lazy>} />
        <Route path="/owner/shipments/:id" element={<Lazy what="shipment"><ShipmentRoutingPage /></Lazy>} />
        <Route path="/owner/predictive" element={<Lazy what="predictions"><PredictivePage /></Lazy>} />
        <Route path="/owner/garages" element={<Lazy what="garages"><GaragesPage /></Lazy>} />
        <Route path="/owner/settings" element={<Lazy what="settings"><SettingsPage /></Lazy>} />
      </Route>
      {/* Team-repo owner addresses that the merged app serves from its own pages */}
      <Route path="/owner" element={<Navigate to="/fleet" replace />} />
      <Route path="/owner/dashboard" element={<Navigate to="/fleet" replace />} />
      <Route path="/owner/map" element={<Navigate to="/fleet" replace />} />
      <Route path="/owner/trucks" element={<Navigate to="/fleet" replace />} />
      <Route path="/owner/trucks/:id" element={<RedirectParam to={(id) => `/trucks/${id}`} />} />
      <Route path="/owner/alerts" element={<Navigate to="/alerts" replace />} />
      <Route path="/owner/alerts/:id" element={<RedirectParam to={(id) => `/alerts/${id}`} />} />
      <Route path="/owner/drivers" element={<Navigate to="/drivers" replace />} />
      <Route path="/owner/drivers/:id" element={<Navigate to="/drivers" replace />} />
      <Route path="/owner/reports" element={<Navigate to="/reports" replace />} />
      <Route path="/owner/plan" element={<Navigate to="/plans" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
