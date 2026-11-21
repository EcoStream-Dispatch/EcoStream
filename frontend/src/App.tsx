import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import PlansPage from './pages/PlansPage'
import GaragesJoinPage from './pages/GaragesJoinPage'
import AboutPage from './pages/AboutPage'
import AppLayout from './components/AppLayout'
import RequireRole from './auth/RequireRole'
import ShipperLayout from './pages/shipper/ShipperLayout'
import MyShipmentsPage from './pages/shipper/MyShipmentsPage'
import RequestShipmentPage from './pages/shipper/RequestShipmentPage'
import TrackShipmentPage from './pages/shipper/TrackShipmentPage'
import DeliveriesPage, { InvoicePage } from './pages/shipper/DeliveriesPage'
import DriverLayout, { DriverDataProvider } from './pages/driver/DriverLayout'
import MyTripPage from './pages/driver/MyTripPage'
import TruckCockpitPage from './pages/driver/TruckCockpitPage'
import DriverAlertPage from './pages/driver/DriverAlertPage'
import SosPage from './pages/driver/SosPage'
import DriverHistoryPage from './pages/driver/DriverHistoryPage'
import AlertsPage from './pages/AlertsPage'
import DashboardPage from './pages/owner/DashboardPage'
import LiveMapPage from './pages/owner/LiveMapPage'
import TrucksPage from './pages/owner/TrucksPage'
import PredictivePage from './pages/owner/PredictivePage'
import ShipmentsPage from './pages/owner/ShipmentsPage'
import CreateShipmentPage from './pages/owner/CreateShipmentPage'
import ShipmentRoutingPage from './pages/owner/ShipmentRoutingPage'
import DriversPage, { DriverProfilePage } from './pages/owner/DriversPage'
import GaragesPage from './pages/owner/GaragesPage'
import PlanBillingPage from './pages/owner/PlanBillingPage'
import SettingsPage from './pages/owner/SettingsPage'
import AlertDetailPage from './pages/owner/AlertDetailPage'
import { Loading } from './components/PageState'

// The Truck page pulls in the chart library (recharts), which is big.
// Loading it only when needed keeps the first page load fast on phones.
const TruckDetailPage = lazy(() => import('./pages/owner/truck/TruckDetailPage'))
const ReportsPage = lazy(() => import('./pages/owner/ReportsPage'))

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
        <Route path="/owner/alerts/:id" element={<AlertDetailPage />} />
        <Route path="/owner/predictive" element={<PredictivePage />} />
        <Route path="/owner/shipments" element={<ShipmentsPage />} />
        <Route path="/owner/shipments/new" element={<CreateShipmentPage />} />
        <Route path="/owner/shipments/:id" element={<ShipmentRoutingPage />} />
        <Route path="/owner/drivers" element={<DriversPage />} />
        <Route path="/owner/drivers/:id" element={<DriverProfilePage />} />
        <Route path="/owner/garages" element={<GaragesPage />} />
        <Route
          path="/owner/reports"
          element={
            <Suspense fallback={<Loading what="reports" />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route path="/owner/plan" element={<PlanBillingPage />} />
        <Route path="/owner/settings" element={<SettingsPage />} />
      </Route>
      {/* Old addresses from before stage W3 */}
      <Route path="/fleet" element={<Navigate to="/owner/dashboard" replace />} />
      <Route path="/alerts" element={<Navigate to="/owner/alerts" replace />} />
      <Route path="/trucks/:id" element={<OldTruckLink />} />
      {/* Driver portal (stage W5) */}
      <Route
        element={
          <RequireRole role="driver">
            <DriverDataProvider>
              <Outlet />
            </DriverDataProvider>
          </RequireRole>
        }
      >
        <Route element={<DriverLayout />}>
          <Route path="/driver" element={<MyTripPage />} />
          <Route path="/driver/truck" element={<TruckCockpitPage />} />
          <Route path="/driver/sos" element={<SosPage />} />
          <Route path="/driver/history" element={<DriverHistoryPage />} />
        </Route>
        <Route path="/driver/alert/:id" element={<DriverAlertPage />} />
      </Route>
      {/* Shipper portal (stage W6) */}
      <Route
        element={
          <RequireRole role="shipper">
            <ShipperLayout />
          </RequireRole>
        }
      >
        <Route path="/shipper" element={<MyShipmentsPage />} />
        <Route path="/shipper/request" element={<RequestShipmentPage />} />
        <Route path="/shipper/track/:id" element={<TrackShipmentPage />} />
        <Route path="/shipper/deliveries" element={<DeliveriesPage />} />
        <Route path="/shipper/invoices/:id" element={<InvoicePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
