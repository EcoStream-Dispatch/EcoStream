import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import PlansPage from './pages/PlansPage'
import GaragesJoinPage from './pages/GaragesJoinPage'
import AboutPage from './pages/AboutPage'
import AppLayout from './components/AppLayout'
import RequireRole from './auth/RequireRole'
import RolePortalPage from './pages/RolePortalPage'
import AlertsPage from './pages/AlertsPage'
import DashboardPage from './pages/owner/DashboardPage'
import LiveMapPage from './pages/owner/LiveMapPage'
import TrucksPage from './pages/owner/TrucksPage'
import ComingSoonPage from './pages/owner/ComingSoonPage'
import { Loading } from './components/PageState'

// The Truck page pulls in the chart library (recharts), which is big.
// Loading it only when needed keeps the first page load fast on phones.
const TruckDetailPage = lazy(() => import('./pages/owner/truck/TruckDetailPage'))

/** Old links from before stage W3 (/trucks/:id) go to the new owner portal address. */
function OldTruckLink() {
  const { id = '' } = useParams()
  return <Navigate to={`/owner/trucks/${id}`} replace />
}

/**
 * All routes live here.
 * Public: home, plans, for garages, about/contact, login.
 * Each portal is guarded by RequireRole: logged out -> /login, wrong role -> own portal.
 * Owner pages live under /owner/... inside AppLayout (sidebar, top bar, live connection).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/garages/join" element={<GaragesJoinPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireRole role="owner">
            <AppLayout />
          </RequireRole>
        }
      >
        <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />
        <Route path="/owner/dashboard" element={<DashboardPage />} />
        <Route path="/owner/map" element={<LiveMapPage />} />
        <Route path="/owner/trucks" element={<TrucksPage />} />
        <Route
          path="/owner/trucks/:id"
          element={
            <Suspense fallback={<Loading what="truck" />}>
              <TruckDetailPage />
            </Suspense>
          }
        />
        <Route path="/owner/alerts" element={<AlertsPage />} />
        {/* Built in stage W4 */}
        {['predictive', 'shipments', 'drivers', 'garages', 'reports', 'plan', 'settings'].map((p) => (
          <Route key={p} path={`/owner/${p}/*`} element={<ComingSoonPage />} />
        ))}
      </Route>
      {/* Old addresses from before stage W3 */}
      <Route path="/fleet" element={<Navigate to="/owner/dashboard" replace />} />
      <Route path="/alerts" element={<Navigate to="/owner/alerts" replace />} />
      <Route path="/trucks/:id" element={<OldTruckLink />} />
      <Route
        path="/driver"
        element={
          <RequireRole role="driver">
            <RolePortalPage role="driver" />
          </RequireRole>
        }
      />
      <Route
        path="/shipper"
        element={
          <RequireRole role="shipper">
            <RolePortalPage role="shipper" />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
