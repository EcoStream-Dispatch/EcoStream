import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { BackendProvider } from './context/BackendContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BackendBanner } from './components/BackendBanner';

import { LandingPage } from './pages/LandingPage';
import { DemoControlPanel } from './pages/DemoControlPanel';
import { StationOverview } from './pages/StationOverview';
import { ChangeoverGuide } from './pages/ChangeoverGuide';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { PassportsPage } from './pages/PassportsPage';
import { PassportDetail } from './pages/PassportDetail';
import { SopsPage } from './pages/SopsPage';
import { PocComparisonPage } from './pages/PocComparisonPage';
import { FleetOverview } from './pages/FleetOverview';
import { TruckDetail } from './pages/TruckDetail';
import { DevicesPage } from './pages/DevicesPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BackendProvider>
      <RoleProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col bg-grid-pattern">
            <Header />
            <BackendBanner />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/demo" element={<DemoControlPanel />} />
                <Route path="/station" element={<StationOverview />} />
                <Route path="/station/:id" element={<ChangeoverGuide />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/passports" element={<PassportsPage />} />
                <Route path="/passports/:id" element={<PassportDetail />} />
                <Route path="/sops" element={<SopsPage />} />
                <Route path="/poc" element={<PocComparisonPage />} />
                <Route path="/fleet" element={<FleetOverview />} />
                <Route path="/fleet/:id" element={<TruckDetail />} />
                <Route path="/devices" element={<DevicesPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </RoleProvider>
    </BackendProvider>
  );
};

export default App;
