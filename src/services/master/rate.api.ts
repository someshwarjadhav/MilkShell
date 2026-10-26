import { BASE_URL } from "../config";
import { clearRequestMemo, directGet, gatewayGet, gatewayText, parseGatewayText } from "../http/client";
import { ApiError } from "../http/errors";
import { isObj, norm, pick, type Obj } from "../utils/loose";
import { vlccName } from "../vlcc/names";

export const MILK_TYPES = [
  { code: "C", label: "Cow" },
  { code: "B", label: "Buffalo" },
  { code: "M", label: "Mix" },
] as const;
export type MilkCode = (typeof MILK_TYPES)[number]["code"];
export const milkLabel = (code: string) =>
  MILK_TYPES.find((m) => m.code === code.toUpperCase())?.label ?? code;

const q = encodeURIComponent;

const asJson = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!/^[[{]/.test(t)) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
};

export function rowsOf(json: unknown): Obj[] {
  const v = asJson(json);
  if (Array.isArray(v)) return v.filter(isObj);
  if (!isObj(v)) return [];
  const ok = v.Success ?? v.success;
  const message = String(v.Message ?? v.message ?? "").trim();
  if (ok === false) {
    if (!message || /no\s*(record|data|rate)/i.test(message)) return [];
    throw new ApiError(message, "server");
  }
  for (const key of ["Message", "message", "Data", "data", "Result", "result"]) {
    const inner = asJson(v[key]);
    if (Array.isArray(inner)) return inner.filter(isObj);
    if (isObj(inner)) {
      const deeper = rowsOf(inner);
      if (deeper.length) return deeper;
    }
  }
  return [];
}

function assertDone(text: string, fallback: string): string {
  const clean = text.replace(/[\r\n]+/g, " ").trim();
  if (!clean) return "Done";
  let json: unknown = clean;
  try {
    json = parseGatewayText(clean);
  } catch {
    if (/^<|error|fail|exception/i.test(clean)) throw new ApiError(fallback, "server");
    return clean.replace(/^"|"$/g, "");
  }
  const v = asJson(json);
  if (isObj(v)) {
    const ok = v.Success ?? v.success;
    const message = String(v.Message ?? v.message ?? "").trim();
    if (ok === false) throw new ApiError(message || fallback, "server");
    return message || "Done";
  }
  if (typeof v === "string" && /fail|error|not\s/i.test(v)) throw new ApiError(v, "server");
  return typeof v === "string" ? v : "Done";
}

async function rateGet(endpoint: string): Promise<unknown> {
  try {
    return await gatewayGet(endpoint, 0);
  } catch (first) {
    if (first instanceof ApiError && first.kind === "auth") throw first;
    try {
      const root = BASE_URL || "https://smartx.shivinfotech.co.in";
      const base = /^https?:/i.test(root) ? root : `${window.location.origin}${root}`;
      return await directGet(`${base}/gateway/Interceptor?path=${endpoint}`, 0);
    } catch {
      throw first;
    }
  }
}

export interface SavedRate {
  vlcId: string;
  rangeType: string;
  date: string;
  time: string;
  milkType: string;
  active: boolean;
  label: string;
}

const timeText = (t: string) => t.replace(/-/g, ":");

export function toIsoDate(d: string): string {
  const t = d.trim();
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(t);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return ymd ? `${ymd[1]}-${ymd[2]}-${ymd[3]}` : t;
}

export function toShownDate(d: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim());
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : d.trim();
}

export async function getSavedRateList(vlcId: string, status: string): Promise<SavedRate[]> {
  const json = await rateGet(`/dairy/dairy/getSavedRateList?rateid=${q(vlcId)}&status=${q(status)}`);
  return rowsOf(json)
    .map((r): SavedRate => {
      const date = pick(r, ["date", "ratedate", "effectivedate", "edate"]);
      const time = timeText(pick(r, ["time", "ratetime"]));
      return {
        vlcId: pick(r, ["rateid"]) || vlcId,
        rangeType: pick(r, ["rangetype"]),
        date,
        time,
        milkType: (pick(r, ["milktype", "mtype", "type", "milk"]) || "C").toUpperCase(),
        active: pick(r, ["isactive", "status"]) !== "0",
        label: [date, time].filter(Boolean).join("  "),
      };
    })
    .filter((r) => r.rangeType);
}

export interface RateGrid {
  snfs: number[];
  rows: Array<{ fat: number; rates: Array<number | null> }>;
}

export const emptyGrid = (): RateGrid => ({ snfs: [], rows: [] });
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const FAT_KEYS = ["fat", "fatvalue", "fatstart", "fatrange", "startfat", "startvalue"];
const SNF_KEYS = ["snf", "snfvalue", "snfstart", "snfrange", "endsnf", "endvalue", "end"];
const RATE_KEYS = ["srate", "rate", "ratevalue", "amount", "rateamount", "price", "value"];

const firstNum = (r: Obj, keys: string[]): number | null => {
  const names = Object.keys(r);
  for (const k of keys) {
    const real = names.find((n) => norm(n) === k);
    if (real === undefined) continue;
    const n = num(r[real]);
    if (n !== null) return n;
  }
  return null;
};

export function gridFromRecords(records: Obj[]): RateGrid {
  const fats = new Map<number, Map<number, number>>();
  const snfSet = new Set<number>();
  for (const r of records) {
    const fat = firstNum(r, FAT_KEYS);
    const snf = firstNum(r, SNF_KEYS);
    const rate = firstNum(r, RATE_KEYS);
    if (fat === null || snf === null || rate === null) continue;
    const f = r2(fat);
    const s = r2(snf);
    snfSet.add(s);
    const row = fats.get(f) ?? new Map<number, number>();
    row.set(s, rate);
    fats.set(f, row);
  }
  const snfs = [...snfSet].sort((a, b) => a - b);
  const rows = [...fats.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([fat, m]) => ({ fat, rates: snfs.map((s) => m.get(s) ?? null) }));
  return { snfs, rows };
}

export async function showRate(
  stationId: string,
  isoDate: string,
  milkType: string,
  rangeType: string,
): Promise<RateGrid> {
  const json = await rateGet(
    `/dairy/dairy/ShowRateWeb?stationid=${q(stationId)}&edate=${q(isoDate)}&milktype=${q(milkType)}&rateid=${q(rangeType)}`,
  );
  const records = rowsOf(json);
  if (!records.length) return emptyGrid();
  const grid = gridFromRecords(records);
  if (!grid.rows.length) {
    if (import.meta.env.DEV) console.warn("[rate] unknown ShowRateWeb record shape", records[0]);
    throw new ApiError(
      "The rate chart came back in a shape this page does not know. Open the browser console to see one record.",
      "parse",
    );
  }
  return grid;
}

export interface RateUpload {
  stationid: string;
  json: string;
  milktype: string;
  shift: string;
  effectivedate: string;
  currentrate?: string;
}

function rateForm(body: RateUpload): FormData {
  const f = new FormData();
  f.append("json", body.json);
  f.append("stationid", body.stationid);
  f.append("milktype", body.milktype);
  f.append("shift", body.shift);
  f.append("trdate", body.effectivedate);
  f.append("currentrate", body.currentrate?.trim() ? body.currentrate : "0");
  return f;
}

export async function saveRateExcel(body: RateUpload): Promise<string> {
  const root = BASE_URL || "https://smartx.shivinfotech.co.in";
  let text: string;
  try {
    text = await gatewayText(
      `${root}/gateway/Interceptor?path=/home/rateexcel`,
      { method: "POST", body: rateForm(body) },
      0,
      true,
    );
  } catch (first) {
    if (first instanceof ApiError && first.kind === "auth") throw first;
    try {
      text = await gatewayText("/home/rateexcel", { method: "POST", body: rateForm(body) });
    } catch {
      throw first;
    }
  }
  clearRequestMemo();
  return assertDone(text, "The rate chart could not be saved.");
}

export async function updateRate(p: {
  vlccid: string;
  rateDate: string;
  type: string;
  rateid: string;
  fromdate: string;
  todate: string;
}): Promise<string> {
  const text = await gatewayText(
    `/dairy/dairy/updateCollectionRate?vlccid=${q(p.vlccid)}&rateDate=${q(p.rateDate)}&type=${q(p.type)}&rateid=${q(p.rateid)}&fromdate=${q(p.fromdate)}&todate=${q(p.todate)}`,
    { method: "GET" },
  );
  return assertDone(text, "The collection rate could not be updated.");
}

export async function syncAsyncRate(p: {
  status: string;
  villageid: string;
  rateid: string;
  type: string;
}): Promise<string> {
  const text = await gatewayText(
    `/dairy/dairy/dpuSyncAsync?status=${q(p.status)}&villageid=${q(p.villageid)}&rateid=${q(p.rateid)}&type=${q(p.type)}`,
    { method: "GET" },
  );
  clearRequestMemo();
  return assertDone(text, "The rate could not be synced.");
}

export interface RateStatusRow {
  villageId: string;
  villageName: string;
  effectiveDate: string;
  entryDate: string;
  currentRate: string;
  downloadDate: string;
  downloadTime: string;
  rateId: string;
  status: string;
}

const dayOnly = (d: string) => /^(\d{4}-\d{2}-\d{2})/.exec(d.trim())?.[1] ?? d.trim();

export async function getRateStatus(mccid: string, plantid: string, type: string): Promise<RateStatusRow[]> {
  const json = await rateGet(
    `/dairy/dairy/getRateStatus?mccid=${q(mccid)}&plantid=${q(plantid)}&type=${q(type)}`,
  );
  return rowsOf(json).map((r): RateStatusRow => {
    const vid = pick(r, ["vid", "villageid", "vlccid", "vlcid", "stationid"]);
    const code = pick(r, ["beneficiaryname", "centercode", "customstationid"]) || vid;
    return {
      villageId: code,
      villageName:
        pick(r, ["villageagentaddress", "villagename", "vlcname", "vlccname", "centername", "name"]) || vlccName(vid),
      effectiveDate: dayOnly(pick(r, ["rateeffectivedate", "effectivedate", "effectdate", "ratedate"])),
      entryDate: dayOnly(pick(r, ["entrydate", "entereddate"])),
      currentRate: pick(r, ["currentrate", "rate"]),
      downloadDate: pick(r, ["downloaddate", "dwldate"]),
      downloadTime: timeText(pick(r, ["downloadtime", "dwltime"])),
      rateId: pick(r, ["rateid", "rangetype"]),
      status: pick(r, ["status", "ratestatus"]),
    };
  });
}