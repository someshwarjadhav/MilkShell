import type * as React from "react";
import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import { PageLoader } from "./components/PageLoader";
import { useAuth } from "./context/AuthContext";
import { useLoginData } from "./hooks/useSessionData";
import {
  canOpenReport,
  PAGE_BANK_PAYMENT_SUMMARY,
  PAGE_CATTLEFEED_FARMER_BILL,
  PAGE_FARMER_MILK_ENTRY,
  PAGE_MANAGE_COLLECTION,
  PAGE_DPU_SETTINGS,
  PAGE_FARMER_MASTER,
  PAGE_VLC_MASTER,
  PAGE_RATE_MASTER,
  PAGE_RATE_STATUS,
  PAGE_EKO_MILK_SETTINGS,
  PAGE_MOBILE_SETTINGS,
  PAGE_VLC_MILK_ENTRY,
  REPORT_CLEANING,
  REPORT_EKO,
  REPORT_FARMERWISE,
  REPORT_UNIONWISE,
  REPORT_VARIANCE,
  REPORT_VLCC,
  REPORT_VLC_STATUS,
} from "./config/reportAccess";
import {
  applySession,
  isSessionDataLoaded,
  loadSessionData,
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
const BankPaymentSummary = lazy(() => import("./pages/billing/BankPaymentSummary"));
const CattleFeedFarmerBill = lazy(() => import("./pages/billing/CattleFeedFarmerBill"));
const ManageCollection = lazy(() => import('./pages/transactions/ManageCollection'));
const MobileAppSettings = lazy(
  () => import("./pages/settings/MobileAppSettings"),
);
const DpuSettings = lazy(() => import("./pages/settings/DpuSettings"));
const EkoMilkSettings = lazy(() => import("./pages/settings/EkoMilkSettings"));
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

const ReportGuard: React.FC<{ to: string; children: ReactNode }> = ({
  to,
  children,
}) => {
  const { user } = useAuth();
  return canOpenReport(user?.email, to) ? <>{children}</> : <NotFound />;
};

const FarmerCollectionRoute: React.FC = () => <Collections only="farmer" />;

const FarmersRoute: React.FC = () => {
  const { user } = useAuth();
  return canOpenReport(user?.email, PAGE_FARMER_MASTER) ? (
    <FarmerMaster />
  ) : (
    <Farmers />
  );
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
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login />}
          />
          <Route path="/contact" element={<Contact />} />
          <Route element={<Protected />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="live" element={<LiveCollection />} />
              <Route path="collections" element={<FarmerCollectionRoute />} />
              <Route
                path="reports/farmerwise"
                element={
                  <ReportGuard key="farmerwise" to={REPORT_FARMERWISE}>
                    <Collections only="entry" />
                  </ReportGuard>
                }
              />
              <Route
                path="reports/vlcc"
                element={
                  <ReportGuard key="vlcc" to={REPORT_VLCC}>
                    <Collections only="vlcc" />
                  </ReportGuard>
                }
              />
              <Route
                path="reports/cleaning"
                element={
                  <ReportGuard key="cleaning" to={REPORT_CLEANING}>
                    <CleaningReport />
                  </ReportGuard>
                }
              />
              <Route
                path="reports/eko-calibration"
                element={
                  <ReportGuard key="eko" to={REPORT_EKO}>
                    <EkoCalibration />
                  </ReportGuard>
                }
              />
              <Route
                path="transactions/vlc-milk-entry"
                element={
                  <ReportGuard key="vlcmilkentry" to={PAGE_VLC_MILK_ENTRY}>
                    <VlcMilkEntry />
                  </ReportGuard>
                }
              />
              <Route
                path="transactions/farmer-milk-entry"
                element={
                  <ReportGuard
                    key="farmermilkentry"
                    to={PAGE_FARMER_MILK_ENTRY}
                  >
                    <FarmerMilkEntry />
                  </ReportGuard>
                }
              />
              <Route
                path="transactions/manage-collection"
                element={
                  <ReportGuard
                    key="managecollection"
                    to={PAGE_MANAGE_COLLECTION}
                  >
                    <ManageCollection />
                  </ReportGuard>
                }
              />
              <Route path="farmers" element={<FarmersRoute />} />
              <Route path="farmers/report" element={<Farmers />} />
              <Route
                path="master/farmer-master"
                element={
                  <ReportGuard key="farmermaster" to={PAGE_FARMER_MASTER}>
                    <FarmerMaster />
                  </ReportGuard>
                }
              />
              <Route
                path="master/vlc-master"
                element={
                  <ReportGuard key="vlcmaster" to={PAGE_VLC_MASTER}>
                    <VlcMaster />
                  </ReportGuard>
                }
              />
              <Route
                path="master/excel-rate-upload"
                element={
                  <ReportGuard key="ratemaster" to={PAGE_RATE_MASTER}>
                    <RateMaster />
                  </ReportGuard>
                }
              />
              <Route
                path="master/rate-status"
                element={
                  <ReportGuard key="ratestatus" to={PAGE_RATE_STATUS}>
                    <RateStatus />
                  </ReportGuard>
                }
              />
              <Route path="centers" element={<Centers />} />
              <Route path="rates" element={<RateChart />} />
              <Route path="billing" element={<Billing />} />
              <Route path="billing/farmer-bill" element={<FarmerBill />} />
              <Route path="billing/standard-deduction" element={<StandardDeduction />} />
              <Route path="billing/vlc-standard-deduction" element={<VlcStandardDeduction />} />
              <Route
                path="billing/bank-payment-summary"
                element={
                  <ReportGuard key="bankpayment" to={PAGE_BANK_PAYMENT_SUMMARY}>
                    <BankPaymentSummary />
                  </ReportGuard>
                }
              />
              <Route
                path="billing/cattlefeed-farmer-bill"
                element={
                  <ReportGuard key="cattlefeedbill" to={PAGE_CATTLEFEED_FARMER_BILL}>
                    <CattleFeedFarmerBill />
                  </ReportGuard>
                }
              />
              <Route path="quality" element={<Quality />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route
                path="reports/unionwise"
                element={
                  <ReportGuard key="unionwise" to={REPORT_UNIONWISE}>
                    <UnionwiseCollection />
                  </ReportGuard>
                }
              />
              <Route
                path="reports/vlc-status"
                element={
                  <ReportGuard key="vlcstatus" to={REPORT_VLC_STATUS}>
                    <VlcStatus />
                  </ReportGuard>
                }
              />
              <Route
                path="reports/variance"
                element={
                  <ReportGuard key="variance" to={REPORT_VARIANCE}>
                    <VarianceReport />
                  </ReportGuard>
                }
              />
              <Route
                path="settings/mobile-app"
                element={
                  <ReportGuard key="mobileapp" to={PAGE_MOBILE_SETTINGS}>
                    <MobileAppSettings />
                  </ReportGuard>
                }
              />
              <Route
                path="settings/dpu-settings"
                element={
                  <ReportGuard key="dpusettings" to={PAGE_DPU_SETTINGS}>
                    <DpuSettings />
                  </ReportGuard>
                }
              />
              <Route
                path="settings/eko-milk-settings"
                element={
                  <ReportGuard
                    key="ekomilksettings"
                    to={PAGE_EKO_MILK_SETTINGS}
                  >
                    <EkoMilkSettings />
                  </ReportGuard>
                }
              />
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
