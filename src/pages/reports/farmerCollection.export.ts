import type { ColType, ExportTable } from "../../lib/exporters";
import type { FarmerRow } from "../../services/mappers/farmer.mapper";
import { isoFromTrdate } from "../../services/utils/date";
import { stationCodeOf, vlccTitle } from "../../services/vlcc/names";
import { SHIFT_EVENING } from "../../lib/global";
import { fmtDateDots, fmtDateLong, time24 } from "../../lib/format";
import { titleCase } from "../../lib/titleCase";

export type EntryKind = "cow" | "buffalo" | "mix";
export type EntryShift = "Morning" | "Evening";

export interface FarmerEntry {
  id: string;
  vlccid: string;
  stationCode: string;
  date: string;
  time: string;
  shift: EntryShift;
  kind: EntryKind;
  farmerId: string;
  farmer: string;
  farmerRaw: string;
  centre: string;
  village: string;
  sampleNo: string;
  litres: number;
  kg: number;
  fat: number;
  snf: number;
  clr: number;
  water: number;
  rate: number;
  amount: number;
  branchId: string;
}

export const KIND_TEXT: Record<EntryKind, string> = {
  cow: "Cow",
  buffalo: "Buffalo",
  mix: "Mix",
};

const KIND_RANK: Record<string, number> = { cow: 0, buffalo: 1, mix: 2 };

const rowOrder = (r: FarmerEntry): string => {
  const id = /^\d+$/.test(r.farmerId)
    ? String(Number(r.farmerId)).padStart(8, "0")
    : r.farmerId;
  return `${r.date}|${r.shift === "Morning" ? 0 : 1}|${KIND_RANK[r.kind] ?? 3}|${id}|${time24(r.time)}`;
};

export function toEntries(rows: FarmerRow[]): FarmerEntry[] {
  const used = new Map<string, number>();
  const list = rows.map((r): FarmerEntry => {
    const date = isoFromTrdate(r.date) ?? r.date;
    const shift: EntryShift = r.shift === SHIFT_EVENING ? "Evening" : "Morning";
    const kind: EntryKind =
      r.milk === "cow" || r.milk === "buffalo" ? r.milk : "mix";
    const base = `${r.vlccid}|${r.farmerId}|${date}|${shift}|${kind}|${r.sampleNo}|${r.time}|${r.liter}|${r.amount}`;
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return {
      id: n ? `${base}#${n}` : base,
      vlccid: r.vlccid,
      stationCode: stationCodeOf(r.vlccid, r.stationCode),
      date,
      time: r.time || "",
      shift,
      kind,
      farmerId: r.farmerId,
      farmer: titleCase(r.farmerName),
      farmerRaw: r.rawName,
      centre: titleCase(vlccTitle(r.vlccid, r.village)),
      village: r.village,
      sampleNo: r.sampleNo,
      litres: r.liter,
      kg: r.kg,
      fat: r.fat,
      snf: r.snf,
      clr: r.clr,
      water: r.water,
      rate: r.rate,
      amount: r.amount,
      branchId: r.branchId,
    };
  });
  return list
    .map((r) => [rowOrder(r), r] as const)
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .map((x) => x[1]);
}

export const COLUMN_ALIASES: Record<string, string[]> = {
  station: ["stationid", "station", "stationcode", "customstationid"],
  date: ["date", "trdate", "collectiondate"],
  shift: ["shift"],
  kind: ["milktype", "milk"],
  farmerId: ["farmerid", "farmercode", "farmerno"],
  name: ["name", "farmername"],
  centre: [
    "centre",
    "center",
    "centrevlc",
    "vlc",
    "vlcname",
    "vlccname",
    "villagename",
    "stationname",
  ],
  sample: ["sampleno", "sample", "sampleid", "samplenumber"],
  litres: ["liter", "litre", "litres", "qty", "quantity"],
  kg: ["kg", "weight"],
  fat: ["fat"],
  snf: ["snf"],
  clr: ["clr"],
  water: ["water"],
  time: ["time", "sampletime"],
  rate: ["rate", "rtpl"],
  amount: ["amount", "amt", "totalamount"],
};

export interface ExportCol {
  key: string;
  header: string;
  type?: ColType;
  total?: "sum" | "wavg" | "ratio";
  value: (r: FarmerEntry) => string | number;
}

export const EXPORT_COLS: ExportCol[] = [
  { key: "station", header: "Station Id", value: (r) => r.stationCode },
  { key: "date", header: "Date", value: (r) => fmtDateLong(r.date) },
  { key: "shift", header: "Shift", value: (r) => r.shift },
  { key: "kind", header: "Milk Type", value: (r) => KIND_TEXT[r.kind] },
  { key: "farmerId", header: "Farmer Id", value: (r) => r.farmerId },
  { key: "name", header: "Name", value: (r) => r.farmer },
  { key: "centre", header: "Station Name", value: (r) => r.centre },
  { key: "sample", header: "Sample No", value: (r) => r.sampleNo },
  {
    key: "litres",
    header: "Liter",
    type: "dec2",
    total: "sum",
    value: (r) => r.litres,
  },
  { key: "kg", header: "Kg", type: "dec2", total: "sum", value: (r) => r.kg },
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
    value: (r) => r.clr,
  },
  {
    key: "water",
    header: "Water",
    type: "dec2",
    total: "wavg",
    value: (r) => r.water,
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

const r2 = (n: number): number => Math.round(n * 100) / 100;

interface SheetCol {
  header: string;

  total?: "sum" | "wavg" | "ratio";
  num?: boolean;
  value: (r: FarmerEntry) => string | number;
}

const SHEET_COLS: Record<string, SheetCol> = {
  station: { header: "Station Id", value: (r) => r.stationCode },
  date: { header: "Date", value: (r) => fmtDateLong(r.date) },
  shift: { header: "Shift", value: (r) => (r.shift === "Morning" ? "M" : "E") },
  kind: { header: "Milk Type", value: (r) => KIND_TEXT[r.kind] },
  farmerId: { header: "Farmer Id", value: (r) => r.farmerId },

  name: { header: "Name", value: (r) => r.farmerRaw || r.farmer },
  litres: { header: "Liter", total: "sum", num: true, value: (r) => r.litres },

  kg: {
    header: "Kg",
    total: "sum",
    num: true,
    value: (r) => (r.kg && r.kg > 0 ? r.kg : r2(r.litres * 1.03)),
  },
  fat: { header: "Fat", total: "wavg", num: true, value: (r) => r.fat },
  snf: { header: "Snf", total: "wavg", num: true, value: (r) => r.snf },
  clr: { header: "Clr", total: "wavg", num: true, value: (r) => r.clr },
  water: { header: "Water", total: "wavg", num: true, value: (r) => r.water },
  time: { header: "Time", value: (r) => r.time },
  rate: { header: "Rate", total: "ratio", num: true, value: (r) => r.rate },
  amount: { header: "Amount", total: "sum", num: true, value: (r) => r.amount },
  branch: { header: "BranchId", value: (r) => r.branchId || "1" },
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
  sampleNo: { header: "Sample No", value: (r) => r.sampleNo },
};

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

const asNumber = (v: string | number): number => {
  const n =
    typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? r2(n) : 0;
};

const PLAIN_INT = /^(0|[1-9]\d{0,14})$/;
const ID_COLS = new Set(["farmerId", "branch", "sampleNo"]);

export function sheetTable(
  order: string[],
  rows: FarmerEntry[],
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

  const asText = !withTotal;
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
      ...(asText
        ? c.num
          ? { align: "right" as const }
          : {}
        : c.num
          ? { type: numType }
          : idCol[i]
            ? { type: "id" as ColType }
            : {}),
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
