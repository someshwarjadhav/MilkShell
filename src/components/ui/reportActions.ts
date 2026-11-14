import { FileSpreadsheet, FileText, Printer, Table2 } from "lucide-react";
import type { ExportAction } from "./ExportBar";
import {
  exportCSV,
  exportExcel,
  exportPDF,
  exportPlainExcel,
  printTable,
  type ExportTable,
} from "../../lib/exporters";

export const EXPORT_FAILED = "Export failed. Please try again.";

type Tone = "ok" | "warn" | "info" | "error";

interface Options {
  /** builds the table (columns, rows, totals) for the current filters */
  build: () => ExportTable;
  /** number of rows shown in the toast */
  count: number;
  /** word used in the toast: "entries", "rows"... */
  unit?: string;
  toast: (message: string, tone?: Tone) => void;
  /** adds the "Old Excel Export" + "New Excel Export" pair (Farmer Collection): STIPL sheets, header on row 1 */
  stiplExcel?: { old: () => ExportTable; new: () => ExportTable };
  /** leave a button out */
  without?: Array<"excel" | "pdf" | "print" | "csv">;
}

export function reportActions({
  build,
  count,
  unit = "rows",
  toast,
  stiplExcel,
  without = [],
}: Options): ExportAction[] {
  const go =
    (
      done: string,
      run: (t: ExportTable) => void | Promise<void>,
      builder: () => ExportTable = build,
    ) =>
    async () => {
      try {
        await run(builder());
        toast(done.replace("{n}", `${count} ${unit}`), "ok");
      } catch {
        toast(EXPORT_FAILED, "error");
      }
    };

  const all: Array<ExportAction & { key: "excel" | "pdf" | "print" | "csv" }> = [
    ...(stiplExcel
      ? [
          { key: "excel" as const, id: "old", label: "Old Excel Export", icon: FileSpreadsheet, variant: "primary" as const, run: go("Exported {n} as Old Excel", exportPlainExcel, stiplExcel.old) },
          { key: "excel" as const, id: "excel", label: "New Excel Export", icon: FileSpreadsheet, variant: "primary" as const, run: go("Exported {n} as New Excel", exportPlainExcel, stiplExcel.new) },
        ]
      : [{ key: "excel" as const, id: "excel", label: "Excel Export", icon: FileSpreadsheet, variant: "primary" as const, run: go("Exported {n} as Excel", exportExcel) }]),
    { key: "pdf", id: "pdf", label: "PDF Export", icon: FileText, variant: "danger", run: go("Exported {n} as PDF", exportPDF) },
    { key: "print", id: "print", label: "Print", icon: Printer, variant: "outline", run: go("Print preview opened for {n}", printTable) },
    { key: "csv", id: "csv", label: "CSV Export", icon: Table2, variant: "success", run: go("Exported {n} as CSV", exportCSV) },
  ];
  return all.filter((a) => !without.includes(a.key)).map(({ key: _key, ...action }) => action);
}
