import type * as React from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import { PageLoader } from "./components/PageLoader";
import { useAuth } from "./context/AuthContext";
import { useLoginData } from "./hooks/useSessionData";
import { useNav, isRouteAllowed } from "./layout/nav";
import {
  applySession,
  isSessionDataLoaded,
  loadSessionData,
  refreshMenu,
} from "./services/bootstrap";

const Login = lazy(() => import("./pages/Login"));
const Contact = lazy(() => import("./pages/Contact"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LiveCollection = lazy(() => import("./pages/LiveCollection"));
const Collections = lazy(() => import("./pages/reports/Collections"));
const Farmers = lazy(() => import("./pages/Farmers"));
const FarmerMaster = lazy(() => import("./pages/master/FarmerMaster"));
const VlcMaster = lazy(() => import("./pages/master/VlcMaster"));
const RateMaster = lazy(() => import("./pages/master/RateMaster"));
const RateStatus = lazy(() => import("./pages/master/RateStatus"));
const Centers = lazy(() => import("./pages/Centers"));
const RateChart = lazy(() => import("./pages/RateChart"));
const Billing = lazy(() => import("./pages/Billing"));
const FarmerBill = lazy(() => import("./pages/billing/FarmerBill"));
const Quality = lazy(() => import("./pages/Quality"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Settings = lazy(() => import("./pages/Settings"));
const UnionwiseCollection = lazy(
  () => import("./pages/reports/UnionwiseCollection"),
);
const VlcStatus = lazy(() => import("./pages/reports/VlcStatus"));
const VarianceReport = lazy(() => import("./pages/reports/VarianceReport"));
const CleaningReport = lazy(() => import("./pages/reports/CleaningReport"));
const EkoCalibration = lazy(() => import("./pages/reports/EkoCalibration"));
const VlcMilkEntry = lazy(() => import("./pages/transactions/VlcMilkEntry"));
const FarmerMilkEntry = lazy(
  () => import("./pages/transactions/FarmerMilkEntry"),
);
const StandardDeduction = lazy(() => import("./pages/billing/StandardDeduction"));
const VlcStandardDeduction = lazy(() => import("./pages/billing/VlcStandardDeduction"));
const CashPaymentSummary = lazy(() => import("./pages/billing/CashPaymentSummary"));
const BankPaymentSummary = lazy(() => import("./pages/billing/BankPaymentSummary"));
const CattleFeedFarmerBill = lazy(() => import("./pages/billing/CattleFeedFarmerBill"));
const ManageCollection = lazy(() => import('./pages/transactions/ManageCollection'));
const MobileAppSettings = lazy(
  () => import("./pages/settings/MobileAppSettings"),
);
const DpuSettings = lazy(() => import("./pages/settings/DpuSettings"));
const EkoMilkSettings = lazy(() => import("./pages/settings/EkoMilkSettings"));
const UserAccess = lazy(() => import("./pages/administrator/UserAccess"));
const FormPlaceholder = lazy(() => import("./pages/FormPlaceholder"));
const NotFound = lazy(() => import("./pages/NotFound"));

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
};

const SessionGate: React.FC = () => {
  const { logout } = useAuth();
  const profile = useLoginData();
  const [ready, setReady] = useState(isSessionDataLoaded());
  const started = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!profile) {
      logout();
      return;
    }
    if (isSessionDataLoaded()) {
      setReady(true);
      if (profile.userId) void refreshMenu(profile.userId);
      return;
    }

    started.current ??= loadSessionData(profile).then(() =>
      applySession(profile),
    );
    let alive = true;
    started.current.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [profile, logout]);

  if (!profile) return <Navigate to="/login" replace />;
  return ready ? <Outlet /> : <PageLoader />;
};

// Har page ka guard: route sidebar (getMenu API) mein ho tabhi khulega, warna NotFound.
const RouteGate: React.FC = () => {
  const { pathname } = useLocation();
  const sections = useNav();
  return isRouteAllowed(sections, pathname) ? <Outlet /> : <NotFound />;
};

const FarmerCollectionRoute: React.FC = () => <Collections only="farmer" />;

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
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login />}
          />
          <Route path="/contact" element={<Contact />} />
          <Route element={<Protected />}>
            <Route element={<AppLayout />}>
            <Route element={<RouteGate />}>
              <Route index element={<Dashboard />} />
              <Route path="live" element={<LiveCollection />} />
              <Route path="collections" element={<FarmerCollectionRoute />} />
              <Route
                path="reports/farmerwise"
                element={
                  <Collections only="entry" />
                }
              />
              <Route
                path="reports/vlcc"
                element={
                  <Collections only="vlcc" />
                }
              />
              <Route
                path="reports/cleaning"
                element={
                  <CleaningReport />
                }
              />
              <Route
                path="reports/eko-calibration"
                element={
                  <EkoCalibration />
                }
              />
              <Route
                path="transactions/vlc-milk-entry"
                element={
                  <VlcMilkEntry />
                }
              />
              <Route
                path="transactions/farmer-milk-entry"
                element={
                  <FarmerMilkEntry />
                }
              />
              <Route
                path="transactions/manage-collection"
                element={
                  <ManageCollection />
                }
              />
              <Route path="farmers" element={<Farmers />} />
              <Route path="farmers/report" element={<Farmers />} />
              <Route
                path="master/farmer-master"
                element={
                  <FarmerMaster />
                }
              />
              <Route
                path="master/vlc-master"
                element={
                  <VlcMaster />
                }
              />
              <Route
                path="master/excel-rate-upload"
                element={
                  <RateMaster />
                }
              />
              <Route
                path="master/rate-status"
                element={
                  <RateStatus />
                }
              />
              <Route path="centers" element={<Centers />} />
              <Route path="rates" element={<RateChart />} />
              <Route path="billing" element={<Billing />} />
              <Route path="billing/farmer-bill" element={<FarmerBill />} />
              <Route path="billing/standard-deduction" element={<StandardDeduction />} />
              <Route path="billing/vlc-standard-deduction" element={<VlcStandardDeduction />} />
              <Route path="billing/cash-payment-summary" element={<CashPaymentSummary />} />
              <Route
                path="billing/bank-payment-summary"
                element={
                  <BankPaymentSummary />
                }
              />
              <Route
                path="billing/cattlefeed-farmer-bill"
                element={
                  <CattleFeedFarmerBill />
                }
              />
              <Route path="quality" element={<Quality />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route
                path="reports/unionwise"
                element={
                  <UnionwiseCollection />
                }
              />
              <Route
                path="reports/vlc-status"
                element={
                  <VlcStatus />
                }
              />
              <Route
                path="reports/variance"
                element={
                  <VarianceReport />
                }
              />
              <Route
                path="settings/mobile-app"
                element={
                  <MobileAppSettings />
                }
              />
              <Route
                path="settings/dpu-settings"
                element={
                  <DpuSettings />
                }
              />
              <Route
                path="settings/eko-milk-settings"
                element={
                  <EkoMilkSettings />
                }
              />
              <Route path="settings" element={<Settings />} />
              <Route path="administrator/user-access" element={<UserAccess />} />
              <Route path="portal/*" element={<FormPlaceholder />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
};

export default App;