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
const Collections = lazy(() => import('./pages/Collections'));
const Farmers = lazy(() => import('./pages/Farmers'));
const Centers = lazy(() => import('./pages/Centers'));
const RateChart = lazy(() => import('./pages/RateChart'));
const Billing = lazy(() => import('./pages/Billing'));
const Quality = lazy(() => import('./pages/Quality'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
};

/**
 * Runs for every page that opens:
 *  - useLoginData() decrypts the saved (encrypted) login again, so the readable copy only lives in memory.
 *    If the saved text was changed by hand it cannot be decrypted and the user is signed out.
 *  - If the centre list / menu / report access were never loaded (e.g. the saved copy was cleared), they are loaded once here.
 */
const SessionGate: React.FC = () => {
  const { logout } = useAuth();
  const profile = useLoginData();
  const [ready, setReady] = useState(isSessionDataLoaded());
  const started = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!profile) { logout(); return; }
    if (isSessionDataLoaded()) { setReady(true); return; }
    // One load per app start, even if React runs this effect twice (StrictMode): later runs just wait for it.
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
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
};

export default App;
