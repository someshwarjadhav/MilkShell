import { FileSpreadsheet, FileText, Printer, Table2 } from 'lucide-react';
import type { ExportAction } from '../components/ExportBar';
import { exportPDF, exportPlainExcel, exportTableCSV, printTable, type ExportTable } from './tableExport';

type ToastFn = (message: string, tone?: 'ok' | 'warn' | 'info' | 'error') => void;

export const EXPORT_FAILED = 'Export failed. Please try again.';

interface Options {
  /** builds the table (columns, rows, totals) for the current filters */
  build: () => ExportTable;
  /** number of rows shown in the toast */
  count: number;
  /** word used in the toast: "entries", "rows"... */
  unit?: string;
  toast: ToastFn;
  /** adds the "Old Excel Export" + "New Excel Export" pair (Farmer Collection) */
  stiplExcel?: { old: () => ExportTable; new: () => ExportTable };
}

/** Old Excel / New Excel / PDF / Print / CSV buttons - same set and same files as the SmartX Farmer Collection report. */
export function reportActions({ build, count, unit = 'rows', toast, stiplExcel }: Options): ExportAction[] {
  const go =
    (done: string, run: (t: ExportTable) => void | Promise<void>, builder: () => ExportTable = build) =>
    async () => {
      try {
        await run(builder());
        toast(done.replace('{n}', `${count} ${unit}`), 'ok');
      } catch {
        toast(EXPORT_FAILED, 'error');
      }
    };

  return [
    ...(stiplExcel
      ? ([
          { id: 'old', label: 'Old Excel Export', icon: FileSpreadsheet, variant: 'primary', run: go('Exported {n} as Old Excel', exportPlainExcel, stiplExcel.old) },
          { id: 'excel', label: 'New Excel Export', icon: FileSpreadsheet, variant: 'primary', run: go('Exported {n} as New Excel', exportPlainExcel, stiplExcel.new) },
        ] as ExportAction[])
      : []),
    { id: 'pdf', label: 'PDF Export', icon: FileText, variant: 'danger', run: go('Exported {n} as PDF', exportPDF) },
    { id: 'print', label: 'Print', icon: Printer, variant: 'outline', run: go('Print preview opened for {n}', printTable) },
    { id: 'csv', label: 'CSV Export', icon: Table2, variant: 'success', run: go('Exported {n} as CSV', exportTableCSV) },
  ];
}
