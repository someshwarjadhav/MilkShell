import { ApiError } from "../http/errors";
import { excelFileName } from "../../lib/fileName";
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

  if (file.name.startsWith("~$"))
    throw new ApiError(
      "This is Excel's temporary lock file (~$...), not your rate file. Close Excel and choose the real .xlsx file.",
      "parse",
    );

  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch (e) {
    console.error("[rate] the browser could not read the file", file.name, e);
    throw new ApiError(
      "The browser could not open this file. Close it in Excel, save it, then choose it again (or copy it to the Desktop first).",
      "parse",
    );
  }
  if (buf.byteLength < 200)
    throw new ApiError(
      `This file is only ${buf.byteLength} bytes, so it is empty or damaged. Choose the real .xlsx file.`,
      "parse",
    );

  const start = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(64, buf.byteLength))).trimStart().toLowerCase();
  if (start.startsWith("<!doctype html") || start.startsWith("<html"))
    throw new ApiError(
      "This file is a web page saved with an .xlsx name, not a real Excel file. Download a proper rate file (Export Rate File) and choose that.",
      "parse",
    );

  let wb: import("xlsx").WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch (first) {
    try {
      let bin = "";
      const u8 = new Uint8Array(buf);
      for (let i = 0; i < u8.length; i += 0x8000)
        bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      wb = XLSX.read(btoa(bin), { type: "base64" });
    } catch {
      console.error("[rate] could not parse the file", file.name, file.size, first);
      const why = first instanceof Error ? first.message : "";
      throw new ApiError(
        `This file could not be read${why ? ` (${why})` : ""}. Choose an .xlsx file in the sample format.`,
        "parse",
      );
    }
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
  XLSX.writeFile(wb, excelFileName(name), { compression: true });
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
  XLSX.writeFile(wb, excelFileName(name), { compression: true });
}