import type * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import PortalReportPage from './PortalReportPage';
import { EKO_CALIBRATION_PATH } from '../../services/report/portalReport.api';

const EkoCalibration: React.FC = () => (
  <PortalReportPage
    title="Eko Calibration"
    subtitle="Eko analyser calibration records of your centres for the chosen dates and shift."
    endpoint={EKO_CALIBRATION_PATH}
    slug="eko-calibration"
    icon={SlidersHorizontal}
    note="Calibration records are loaded from the SmartX portal using the selected filters."
  />
);

export default EkoCalibration;
