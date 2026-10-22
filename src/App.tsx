import type * as React from 'react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import { PageLoader } from './components/PageLoader';
import { useAuth } from './context/AuthContext';
import { useLoginData } from './hooks/useSessionData';
import { applySession, isSessionDataLoaded, loadSessionData } from './services/bootstrap';

const Login = lazy(() => import('./pages/Login'));
const Contact = lazy(() => import('./pages/Contact'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LiveCollection = lazy(() => import('./pages/LiveCollection'));
const Collections = lazy(() => import('./pages/reports/Collections'));
const Farmers = lazy(() => import('./pages/Farmers'));
const Centers = lazy(() => import('./pages/Centers'));
const RateChart = lazy(() => import('./pages/RateChart'));
const Billing = lazy(() => import('./pages/Billing'));
const Quality = lazy(() => import('./pages/Quality'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Settings = lazy(() => import('./pages/Settings'));
const UnionwiseCollection = lazy(() => import('./pages/reports/UnionwiseCollection'));
const VlcStatus = lazy(() => import('./pages/reports/VlcStatus'));
const VarianceReport = lazy(() => import('./pages/reports/VarianceReport'));
const FormPlaceholder = lazy(() => import('./pages/FormPlaceholder'));
const NotFound = lazy(() => import('./pages/NotFound'));

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
};


const SessionGate: React.FC = () => {
  const { logout } = useAuth();
  const profile = useLoginData();
  const [ready, setReady] = useState(isSessionDataLoaded());
  const started = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!profile) { logout(); return; }
    if (isSessionDataLoaded()) { setReady(true); return; }
  
    started.current ??= loadSessionData(profile).then(() => applySession(profile));
    let alive = true;
    started.current.then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [profile, logout]);

  if (!profile) return <Navigate to="/login" replace />;
  return ready ? <Outlet /> : <PageLoader />;
};

const Protected: React.FC = () => {
  const { user } = useAuth();
  return user ? <SessionGate /> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const { user } = useAuth();

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/contact" element={<Contact />} />
          <Route element={<Protected />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="live" element={<LiveCollection />} />
              <Route path="collections" element={<Collections />} />
              <Route path="farmers" element={<Farmers />} />
              <Route path="centers" element={<Centers />} />
              <Route path="rates" element={<RateChart />} />
              <Route path="billing" element={<Billing />} />
              <Route path="quality" element={<Quality />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="reports/unionwise" element={<UnionwiseCollection />} />
              <Route path="reports/vlc-status" element={<VlcStatus />} />
              <Route path="reports/variance" element={<VarianceReport />} />
              <Route path="settings" element={<Settings />} />
              <Route path="portal/*" element={<FormPlaceholder />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
};

export default App;
