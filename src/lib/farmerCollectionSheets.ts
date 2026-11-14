import type { ColType, ExportTable } from "./tableExport";
import type { CollectionEntry } from "./collectionEntry";
import { fmtDateDots, fmtDateLong, time24 } from "./format";

/*
 * Farmer Collection: column definitions and the STIPL Old / New Excel layouts.
 * Ported from the SmartX report so MilkShell gives exactly the same files.
 * "Station Id" is always the CUSTOM station id (entry.stationCode), never the raw backend VLC id.
 */

/** Report-access column names (userReportConfig) each table column can be called by. */
export const COLUMN_ALIASES: Record<string, string[]> = {
  station: ["stationid", "station"],
  date: ["date", "trdate", "collectiondate"],
  shift: ["shift"],
  kind: ["milktype", "milk"],
  farmerId: ["farmerid", "farmercode"],
  name: ["name", "farmername"],
  centre: [
    "centre",
    "centrevlc",
    "vlc",
    "vlcname",
    "villagename",
    "stationname",
  ],
  sample: ["sampleno", "sample", "sampleid"],
  litres: ["liter", "litre", "litres", "qty"],
  kg: ["kg", "weight"],
  fat: ["fat"],
  snf: ["snf"],
  clr: ["clr"],
  water: ["water"],
  time: ["time"],
  rate: ["rate", "rtpl"],
  amount: ["amount", "amt"],
};

/**
 * Export columns for PDF / CSV / Print: same keys as COLUMNS, so columns hidden for this login are left out too.
 * `total` = how the Total row is calculated (see TotalKind in lib/exporters).
 */
export type ExportCol = {
  key: string;
  header: string;
  type?: ColType;
  total?: "sum" | "wavg" | "ratio";
  value: (r: CollectionEntry) => string | number;
};
export const EXPORT_COLS: ExportCol[] = [
  {
    key: "station",
    header: "Station Id",
    value: (r) => r.stationCode || r.stationId,
  },
  { key: "date", header: "Date", value: (r) => fmtDateLong(r.date) },
  { key: "shift", header: "Shift", value: (r) => r.shift },
  {
    key: "kind",
    header: "Milk Type",
    value: (r) => KIND_TEXT[r.kind] ?? r.kind,
  },
  { key: "farmerId", header: "Farmer Id", value: (r) => r.farmerId },
  { key: "name", header: "Name", value: (r) => r.farmer },
  { key: "centre", header: "Station Name", value: (r) => r.centre },
  { key: "sample", header: "Sample No", value: (r) => r.sampleNo ?? "" },
  {
    key: "litres",
    header: "Liter",
    type: "dec2",
    total: "sum",
    value: (r) => r.litres,
  },
  {
    key: "kg",
    header: "Kg",
    type: "dec2",
    total: "sum",
    value: (r) => r.kg ?? 0,
  },
  {
    key: "fat",
    header: "Fat",
    type: "dec2",
    total: "wavg",
    value: (r) => r.fat,
  },
  {
    key: "snf",
    header: "Snf",
    type: "dec2",
    total: "wavg",
    value: (r) => r.snf,
  },
  {
    key: "clr",
    header: "Clr",
    type: "dec2",
    total: "wavg",
    value: (r) => r.clr ?? 0,
  },
  {
    key: "water",
    header: "Water",
    type: "dec2",
    total: "wavg",
    value: (r) => r.water ?? 0,
  },
  { key: "time", header: "Time", value: (r) => r.time },
  {
    key: "rate",
    header: "Rate",
    type: "money",
    total: "ratio",
    value: (r) => r.rate,
  },
  {
    key: "amount",
    header: "Amount",
    type: "money",
    total: "sum",
    value: (r) => r.amount,
  },
];


/* ---------- STIPL Excel layouts (Old Excel Export / New Excel Export) ---------- */

export const r2 = (n: number): number => Math.round(n * 100) / 100;
export const KIND_TEXT: Record<string, string> = {
  cow: "Cow",
  buffalo: "Buffalo",
  mix: "Mix",
};

interface SheetCol {
  header: string;
  /** 'sum' | 'wavg' (weighted by Liter) | 'ratio' (Amount / Liter) -> formula in the Total row */
  total?: "sum" | "wavg" | "ratio";
  num?: boolean;
  value: (r: CollectionEntry) => string | number;
}

const SHEET_COLS: Record<string, SheetCol> = {
  station: { header: "Station Id", value: (r) => r.stationCode || r.stationId },
  date: { header: "Date", value: (r) => fmtDateLong(r.date) },
  shift: { header: "Shift", value: (r) => (r.shift === "Morning" ? "M" : "E") },
  kind: { header: "Milk Type", value: (r) => KIND_TEXT[r.kind] ?? r.kind },
  farmerId: { header: "Farmer Id", value: (r) => r.farmerId },
  // Excel exports: the name exactly as the server sends it (original case, blank when the server has no name)
  name: { header: "Name", value: (r) => r.farmerRaw ?? r.farmer },
  litres: { header: "Liter", total: "sum", num: true, value: (r) => r.litres },
  // Kg: the server's own Kg; when it is missing / 0 the sheet uses Liter x 1.03 (same as the portal's farmercollection.xlsx)
  kg: {
    header: "Kg",
    total: "sum",
    num: true,
    value: (r) => (r.kg && r.kg > 0 ? r.kg : r2(r.litres * 1.03)),
  },
  fat: { header: "Fat", total: "wavg", num: true, value: (r) => r.fat },
  snf: { header: "Snf", total: "wavg", num: true, value: (r) => r.snf },
  clr: { header: "Clr", total: "wavg", num: true, value: (r) => r.clr ?? 0 },
  water: {
    header: "Water",
    total: "wavg",
    num: true,
    value: (r) => r.water ?? 0,
  },
  time: { header: "Time", value: (r) => r.time },
  rate: { header: "Rate", total: "ratio", num: true, value: (r) => r.rate },
  amount: { header: "Amount", total: "sum", num: true, value: (r) => r.amount },
  branch: { header: "BranchId", value: (r) => r.branchId ?? "1" },
  stationName: {
    header: "Station Name",
    value: (r) => r.centre || r.village || "",
  },
  kgFat: {
    header: "Kg Fat",
    total: "sum",
    num: true,
    value: (r) => r2((r.litres * r.fat) / 100),
  },
  kgSnf: {
    header: "Kg Snf",
    total: "sum",
    num: true,
    value: (r) => r2((r.litres * r.snf) / 100),
  },
  collDate: { header: "Collection Date", value: (r) => fmtDateDots(r.date) },
  collTime: { header: "Collection Time", value: (r) => time24(r.time) },
  sampleNo: { header: "Sample No", value: (r) => r.sampleNo ?? "" },
};

/**
 * New Excel Export = the portal's 101010.xlsx: 22 columns, Station Id first, plain data rows only (NO Total row).
 */
export const NEW_ORDER = [
  "station",
  "date",
  "shift",
  "kind",
  "farmerId",
  "name",
  "litres",
  "kg",
  "fat",
  "snf",
  "clr",
  "water",
  "time",
  "rate",
  "amount",
  "branch",
  "stationName",
  "kgFat",
  "kgSnf",
  "collDate",
  "collTime",
  "sampleNo",
];
/**
 * Old Excel Export = the portal's farmercollection.xlsx: 22 columns, Date first, plain data rows only (NO Total row).
 * Like the portal's file, every cell is TEXT ("3.00", "10.00", farmer id "1" ...): selecting a column does not show a Sum in the
 * status bar, and AutoSum only types an empty =SUM( ) formula instead of adding the cells up.
 */
export const OLD_ORDER = [
  "date",
  "farmerId",
  "name",
  "litres",
  "kg",
  "fat",
  "snf",
  "clr",
  "water",
  "kind",
  "time",
  "station",
  "shift",
  "rate",
  "amount",
  "branch",
  "stationName",
  "kgFat",
  "kgSnf",
  "collDate",
  "collTime",
  "sampleNo",
];

/** always a real number (never text) for the numeric columns */
const asNumber = (v: string | number): number => {
  const n =
    typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? r2(n) : 0;
};

/** a column whose every value is a whole number without leading zeros (farmer id 3, branch id 1 ...) is written as REAL numbers, not text */
const PLAIN_INT = /^(0|[1-9]\d{0,14})$/;
const ID_COLS = new Set(["farmerId", "branch", "sampleNo"]);

export function sheetTable(
  order: string[],
  rows: CollectionEntry[],
  filename: string,
  numType: ColType,
  withTotal: boolean,
  exactFileName = false,
): ExportTable {
  const cols = order
    .map((k) => SHEET_COLS[k])
    .filter((c): c is SheetCol => !!c);
  const keyOf = (c: SheetCol): string =>
    order.find((k) => SHEET_COLS[k] === c) ?? "";
  const at = (key: string): number =>
    cols.findIndex((c) => c.header === SHEET_COLS[key]?.header);
  const litres = at("litres");
  const amount = at("amount");
  // The STIPL Old / New Excel (no Total row) is written exactly like the portal's file: every cell is text ("3.00", "1" ...).
  // Only when a Total row is asked for (withTotal) the number columns stay real numbers, because the Total formulas need them.
  const asText = !withTotal;
  // number-like text columns: numbers (right aligned, can be summed) when every value is a plain whole number, else they stay text
  const idCol = cols.map(
    (c) =>
      ID_COLS.has(keyOf(c)) &&
      rows.every((r) => {
        const v = String(c.value(r) ?? "").trim();
        return v === "" || PLAIN_INT.test(v);
      }),
  );
  return {
    filename,
    ...(exactFileName ? { exactFileName: true } : {}),
    title: "Farmer collection",
    columns: cols.map((c, i) => ({
      header: c.header,
      // text sheet: number columns stay text (no Sum, AutoSum gives an empty =SUM( )) but are shown on the right side
      ...(asText
        ? c.num
          ? { align: "right" as const }
          : {}
        : c.num
          ? { type: numType }
          : idCol[i]
            ? { type: "id" as ColType }
            : {}),
      // Total row only when asked for; the STIPL Old / New Excel pass false, so no Total row is written
      ...(!withTotal
        ? {}
        : c.total === "sum"
          ? { total: "sum" as const }
          : c.total === "wavg"
            ? { total: { wavg: litres } }
            : c.total === "ratio"
              ? { total: { ratio: [amount, litres] as [number, number] } }
              : {}),
    })),
    rows: rows.map((r) =>
      cols.map((c, i) => {
        if (asText)
          return c.num
            ? asNumber(c.value(r)).toFixed(2)
            : String(c.value(r) ?? "");
        return c.num
          ? asNumber(c.value(r))
          : idCol[i]
            ? String(c.value(r) ?? "").trim() === ""
              ? ""
              : Number(String(c.value(r)).trim())
            : c.value(r);
      }),
    ),
  };
}

