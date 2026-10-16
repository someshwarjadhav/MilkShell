import type * as React from 'react';
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import { PageLoader } from './components/PageLoader';
import { useAuth } from './context/AuthContext';

const Login = lazy(() => import('./pages/Login'));
const CreateAccount = lazy(() => import('./pages/CreateAccount'));
const Contact = lazy(() => import('./pages/Contact'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LiveCollection = lazy(() => import('./pages/LiveCollection'));
const Collections = lazy(() => import('./pages/Collections'));
const Farmers = lazy(() => import('./pages/Farmers'));
const Centers = lazy(() => import('./pages/Centers'));
const RateChart = lazy(() => import('./pages/RateChart'));
const Billing = lazy(() => import('./pages/Billing'));
const Sales = lazy(() => import('./pages/Sales'));
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

const Protected: React.FC = () => {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const { user } = useAuth();

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/create-account" element={user ? <Navigate to="/" replace /> : <CreateAccount />} />
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
              <Route path="sales" element={<Sales />} />
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
