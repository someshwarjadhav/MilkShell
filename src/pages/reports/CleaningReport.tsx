import type * as React from 'react';
import { Sparkles } from 'lucide-react';
import PortalReportPage from './PortalReportPage';
import { CLEANING_REPORT_PATH } from '../../services/report/portalReport.api';

const CleaningReport: React.FC = () => (
  <PortalReportPage
    title="Cleaning Report"
    subtitle="Cleaning records of your centres for the chosen dates and shift."
    endpoint={CLEANING_REPORT_PATH}
    slug="cleaning"
    icon={Sparkles}
    note="Cleaning records are loaded from the SmartX portal using the selected filters."
  />
);

export default CleaningReport;
