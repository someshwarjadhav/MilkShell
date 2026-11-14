import { GitCompareArrows } from "lucide-react";
import EkoDataReport from "../../components/EkoDataReport";
import { EKO_CORRECTION_FIELDS, getEkoCorrectionData } from "../../services/report/ekoCorrection.api";

export default function EkoCorrection() {
  return (
    <EkoDataReport
      title="Eko Correction"
      subtitle="Eko correction settings by selected VLC."
      icon={GitCompareArrows}
      fields={EKO_CORRECTION_FIELDS}
      load={getEkoCorrectionData}
    />
  );
}
