import { ApiError } from "../http/errors";
import type { RateGrid, RateStatusRow } from "./rate.api";

const loadXlsx = () => import("xlsx");

export const SAMPLE_RATE_URL = `${import.meta.env.BASE_URL}Rate.xlsx`;

export interface RateFile {
  grid: RateGrid;
  json: string;
}

const cellNum = (v: unknown): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function readRateFile(file: File): Promise<RateFile> {
  const XLSX = await loadXlsx();
  let wb: import("xlsx").WorkBook;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  } catch {
    throw new ApiError("This file could not be read. Choose an .xlsx file in the sample format.", "parse");
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new ApiError("The file has no sheet.", "parse");

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  const head = aoa[0] ?? [];
  const snfs = head.slice(1).map(cellNum);
  if (head.length < 2 || snfs.some((s) => s === null)) {
    throw new ApiError("Row 1 must be Fat, then the SNF values (see the sample file).", "parse");
  }

  const rows = aoa
    .slice(1)
    .map((r) => ({ fat: cellNum(r[0]), cells: snfs.map((_, i) => cellNum(r[i + 1])) }))
    .filter((r): r is { fat: number; cells: Array<number | null> } => r.fat !== null && r.cells.some((c) => c !== null))
    .map((r) => ({ fat: r2(r.fat), rates: r.cells }));
  if (!rows.length) throw new ApiError("The file has no rate rows.", "parse");

  const grid: RateGrid = { snfs: snfs.map((s) => r2(s as number)), rows };
  return { grid, json: gridToPortalJson(grid) };
}

export function gridToPortalJson(grid: RateGrid): string {
  const two = (n: number) => n.toFixed(2);
  return JSON.stringify(
    grid.rows.map((r) => {
      const o: Record<string, string> = { Fat: two(r.fat) };
      grid.snfs.forEach((snf, i) => {
        const v = r.rates[i];
        o[two(snf)] = v === null || v === undefined ? "" : two(v);
      });
      return o;
    }),
  );
}

const gridAoa = (g: RateGrid): Array<Array<string | number>> => [
  ["Fat", ...g.snfs],
  ...g.rows.map((r) => [r.fat, ...r.rates.map((v) => (v === null ? "" : v))]),
];

export async function downloadGrid(grid: RateGrid, name: string) {
  const XLSX = await loadXlsx();
  const ws = XLSX.utils.aoa_to_sheet(gridAoa(grid));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${name}.xlsx`, { compression: true });
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function exportRateFileCsv(grid: RateGrid, name: string) {
  const lines = ["Fat,SNF,Rate"];
  for (const r of grid.rows)
    r.rates.forEach((v, i) => {
      if (v !== null) lines.push([r.fat, grid.snfs[i], v].map(csvCell).join(","));
    });
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportRateStatus(rows: RateStatusRow[], name: string) {
  const XLSX = await loadXlsx();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Village Id", "Village Name", "Effective Date", "Entry Date", "Current Rate", "Download Date", "Download Time", "RateId", "Status"],
    ...rows.map((r) => [
      r.villageId,
      r.villageName,
      r.effectiveDate,
      r.entryDate,
      r.currentRate,
      r.downloadDate,
      r.downloadTime,
      r.rateId,
      r.status,
    ]),
  ]);
  ws["!cols"] = [14, 28, 16, 16, 14, 16, 16, 16, 12].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rate Status");
  XLSX.writeFile(wb, `${name}.xlsx`, { compression: true });
}