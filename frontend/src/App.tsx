import { Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'

/**
 * All routes live here.
 * Stage 2 adds the owner pages (Fleet, Truck, Alerts).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  )
}
