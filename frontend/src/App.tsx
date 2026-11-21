import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import PlansPage from './pages/PlansPage'
import GaragesJoinPage from './pages/GaragesJoinPage'
import AboutPage from './pages/AboutPage'
import AppLayout from './components/AppLayout'
import RequireRole from './auth/RequireRole'
import RolePortalPage from './pages/RolePortalPage'
import FleetPage from './pages/FleetPage'
import AlertsPage from './pages/AlertsPage'
import { Loading } from './components/PageState'

// The Truck page pulls in the chart library (recharts), which is big.
// Loading it only when needed keeps the first page load fast on phones.
const TruckPage = lazy(() => import('./pages/TruckPage'))

/**
 * All routes live here.
 * Public: home, plans, for garages, about/contact, login.
 * Each portal is guarded by RequireRole: logged out -> /login, wrong role -> own portal.
 * Owner pages sit inside AppLayout (top bar, tab bar, live connection).
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
      </Route>
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
