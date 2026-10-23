import type * as React from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Radio,
  RefreshCw,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { PageHeader } from "./ui/PageHeader";
import { nf } from "../lib/format";
import { cn } from "../lib/cn";

export type ExportKind = "xls" | "pdf" | "csv";

export const IconBadge: React.FC<{
  icon: LucideIcon;
  tone?: string;
  size?: number;
}> = ({ icon: Icon, tone = "text-brand", size = 18 }) => {
  const still = useReducedMotion();
  
  return (
    <motion.span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-current/10",
        tone,
      )}
      animate={still ? undefined : { y: [0, -3, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.08 }}
    >
      <Icon size={size} className={tone} />
    </motion.span>
  );
};

export const CardTitle: React.FC<{
  icon: LucideIcon;
  children: ReactNode;
  tone?: string;
}> = ({ icon, children, tone }) => (
  <span className="flex items-center gap-3">
    <IconBadge icon={icon} tone={tone} />
    {children}
  </span>
);

export const Reveal: React.FC<{
  children: ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
export const ReportPage: React.FC<{
  title: string;
  subtitle ?: string;
  children: ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="min-w-0 space-y-4">
    <Reveal>
      <PageHeader title={title} subtitle={subtitle} />
    </Reveal>
    {children}
  </div>
);

export interface ReportSourceState {
  fetching: boolean;
  stale: boolean;
  updatedAt: number | null;
  failed?: number;
  total?: number;
  error?: unknown;
  hasData?: boolean;
}

export const ReportDataBadge: React.FC<{ state: ReportSourceState }> = ({
  state,
}) => {
  const {
    fetching,
    stale,
    updatedAt,
    failed = 0,
    total = 0,
    error,
    hasData = false,
  } = state;
  const failedText =
    total > 0 && failed > 0 ? ` · ${failed}/${total} requests failed` : "";
  if (error && hasData) {
    return (
      <Badge
        tone="warn"
        dot
        title={`Showing previously loaded portal data. API refresh failed${failedText}.`}
      >
        Cached API data · refresh failed
      </Badge>
    );
  }
  if (error) {
    return (
      <Badge
        tone="danger"
        dot
        title="No report rows loaded; the live portal request failed."
      >
        <AlertCircle size={13} /> API unavailable
      </Badge>
    );
  }
  if (fetching && stale) {
    return (
      <Badge
        tone="warn"
        dot
        title="Showing saved API results while refreshing from the portal."
      >
        <RefreshCw size={13} /> Refreshing cached data
      </Badge>
    );
  }
  if (stale) {
    return (
      <Badge
        tone="neutral"
        dot
        title="These results came from the app's local cache and have not yet been refreshed from the portal."
      >
        <Database size={13} /> Cached API data
      </Badge>
    );
  }
  if (failed > 0) {
    return (
      <Badge
        tone="warn"
        dot
        title={`Some portal requests failed${failedText}.`}
      >
        Partial portal data{failedText}
      </Badge>
    );
  }
  if (fetching) {
    return (
      <Badge tone="brand" dot>
        <RefreshCw size={13} /> Updating from portal
      </Badge>
    );
  }
  if (updatedAt !== null) {
    const stamp = new Date(updatedAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      <Badge tone="ok" dot title={`Loaded from the SmartX portal at ${stamp}.`}>
        <Radio size={13} /> Portal API data
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" dot>
      <Database size={13} /> Waiting for portal data
    </Badge>
  );
};

const LABEL: Record<ExportKind, string> = {
  xls: "Excel",
  pdf: "PDF / Print",
  csv: "CSV",
};
const ICON: Record<ExportKind, ReactNode> = {
  xls: <FileSpreadsheet size={15} />,
  pdf: <FileText size={15} />,
  csv: <Download size={15} />,
};

export const ReportBar: React.FC<{
  count: number;
  hideCount?: boolean;
  disabled: boolean;
  kinds: ExportKind[];
  onExport: (k: ExportKind) => void;
  left?: ReactNode;
  source?: ReactNode;
}> = ({ count, hideCount, disabled, kinds, onExport, left, source }) => (
  <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
      {left}
      {!hideCount && <Badge tone="brand">Record Count: {nf(count)}</Badge>}
      {source}
    </div>
    <div className="flex flex-wrap gap-2">
      {kinds.map((k) => (
        <motion.div key={k} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
          <Button
            size="sm"
            variant="soft"
            icon={ICON[k]}
            onClick={() => onExport(k)}
            disabled={disabled}
          >
            {LABEL[k]}
          </Button>
        </motion.div>
      ))}
    </div>
  </div>
);
