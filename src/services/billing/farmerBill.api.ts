import { clearRequestMemo } from "../http/client";
import { getSession } from "../session";
import { dpuGet, dpuSaveAttempts, encryptedShapes, type SaveAttempt } from "../http/dpu";
import { ApiError, EmptyReplyError } from "../http/errors";
import { apiDate } from "../utils/date";
import { isObj, pickValue, type Obj } from "../utils/loose";
import { num } from "../utils/parse";
import { getCashSummary } from "./cashPaymentSummary.api";

/**
 * Farmer Bill on the DPU API (https://dpu.shivinfotech.co.in/api):
 *   GET  /Login/MilkBillProcessma?id=0&fromdate=<date>&todate=<date>&stationid=<vlc id>   -> bill JSON per farmer
 *   POST /Login/getMilkBillFreeze   (body = BillFreeze)                                  -> freeze the bill
 * Same calls as the old portal (/home/MilkBillProcessma and /dairy/dairy/getMilkBillFreeze), only the path moved to /Login.
 */
export const FARMER_BILL_PATH = "/Login/MilkBillProcessma";
export const BILL_FREEZE_PATH = "/Login/getMilkBillFreeze";

export interface BillFreeze {
  AutoRowNum: number;
  VillageId: string;
  EntryDate: string;
  StartDate: string;
  EndDate: string;
  flag: number;
  json: string;
}

const NO_RECORD = /no\s*(record|data)|not\s*found/i;
/** Server-side file-permission failure of the DPU host (it cannot write its bill cache file). */
const SERVER_FILE_ERROR = /access to the path|is denied|permission/i;

const billQuery = (from: string, to: string, stationId: string) =>
  `id=0&fromdate=${encodeURIComponent(apiDate(from))}&todate=${encodeURIComponent(apiDate(to))}&stationid=${encodeURIComponent(stationId)}`;

/** Looks at a DPU reply: returns the bill JSON, or throws when the server sent a message instead of a bill. */
function checkReply(reply: unknown): unknown {
  if (typeof reply === "string") {
    const text = reply.trim();
    if (!text) return {};
    if (/^[{[]/.test(text)) return reply;
    if (NO_RECORD.test(text)) return {};
    throw new ApiError(text, "server");
  }
  if (isObj(reply)) {
    const ok = reply.Success ?? reply.success;
    const message = String(reply.Message ?? reply.message ?? "").trim();
    // { Success: false, Message: "No Record !" } = no bill for this period; any other refusal is an error
    if (ok === false) {
      if (!message || NO_RECORD.test(message)) return {};
      throw new ApiError(message, "server");
    }
  }
  return reply;
}

const TIMEOUT = /time\s*out|timed out|timeout/i;

/** A list of daily milk rows: named "...Milk" (CowMilk / BuffaloMilk / MixMilk) or, whatever it is named, rows that carry a date + weight. */
function looksLikeMilkRows(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  const first = v.find(isObj);
  if (!first) return false;
  const keys = Object.keys(first).map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return keys.includes("dtdate") && (keys.includes("mweight") || keys.includes("eweight"));
}
const isMilkList = (key: string, v: unknown): boolean => Array.isArray(v) && (/milk$/i.test(key) || looksLikeMilkRows(v));
const merged = new WeakSet<object>();
/** true when the bill was put together from several shorter requests (so it cannot be frozen as one bill) */
export const isMergedBill = (raw: unknown): boolean => typeof raw === "object" && raw !== null && merged.has(raw);

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const asObj = (v: unknown): Obj | null => {
  let x = v;
  if (typeof x === "string") {
    try {
      x = JSON.parse(x);
    } catch {
      return null;
    }
  }
  return isObj(x) ? x : null;
};
const SUM_KEYS = /^(incentive|totalincentive|transport|totaltransport|milkdeposit|deposit|advance|currentadvance|cattlefeed)$/;

/** Bills of the same farmer from several windows become one bill: daily milk lists are joined, Incentive / Transport / Deposit added up. */
/** Figures that are added up when a farmer's bill is joined from several windows (name used in the joined bill -> BillExtras field). */
const ADD_UP: Array<[keyof BillExtras, string]> = [
  ["incentive", "Incentive"],
  ["transport", "Transport"],
  ["deposit", "MilkDeposit"],
  ["advance", "CurrentAdvance"],
  ["cattleFeed", "CattleFeed"],
  ["overRate", "OverRate"],
];
/** Added up only when every window of the farmer carried it; otherwise worked out from the joined bill. */
const ADD_UP_ALL: Array<[keyof BillExtras, string]> = [
  ["totalDeduction", "TotalDeduction"],
  ["net", "NetPayment"],
];
/** Server totals of ONE window - never kept as they are in a joined bill (they would be the first window's only). */
const WINDOW_TOTALS = /^(totaldeduction|totaldeductions|deductionamount|netpayment|netpayable|netamount|payableamount)$/;

function mergeBills(parts: Obj[], from: string, to: string): Obj {
  const out: Obj = {};
  const idx = new Map<string, string>();
  const acc = new Map<string, { parts: number; sum: Map<string, number>; n: Map<string, number> }>();
  const dmy = (d: string) => d.split("-").reverse().join("-");
  for (const part of parts) {
    for (const [key, val] of Object.entries(part)) {
      if (!isObj(val)) continue;
      const id = billHeading(key).id || key;
      const a = acc.get(id) ?? { parts: 0, sum: new Map<string, number>(), n: new Map<string, number>() };
      acc.set(id, a);
      a.parts += 1;
      const found = scanExtras(val) as Record<string, number | undefined>;
      for (const [field] of [...ADD_UP, ...ADD_UP_ALL]) {
        const v = found[field];
        if (v === undefined) continue;
        a.sum.set(field, (a.sum.get(field) ?? 0) + v);
        a.n.set(field, (a.n.get(field) ?? 0) + 1);
      }
      const have = idx.get(id);
      if (!have) {
        const segs = key.split(" : ");
        const k = segs.length > 1 ? [...segs.slice(0, -1), `${dmy(from)} To ${dmy(to)}`].join(" : ") : key;
        idx.set(id, k);
        out[k] = { ...val };
        continue;
      }
      const into = out[have] as Obj;
      for (const [f, v] of Object.entries(val)) {
        const nf = f.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (Array.isArray(v) && (/milk$/.test(nf) || looksLikeMilkRows(v))) into[f] = [...(Array.isArray(into[f]) ? (into[f] as unknown[]) : []), ...v];
        else if (SUM_KEYS.test(nf) && toNum(v) !== undefined) into[f] = (toNum(into[f]) ?? 0) + (toNum(v) as number);
        else if (!(f in into)) into[f] = v;
      }
    }
  }
  // Incentive / Transport / Deposit / Total Deduction / Net Payment of the whole period = the windows added up
  for (const [id, k] of idx) {
    const a = acc.get(id);
    const bill = out[k] as Obj;
    const rest: Obj = {};
    for (const [f, v] of Object.entries(bill)) if (!WINDOW_TOTALS.test(f.toLowerCase().replace(/[^a-z0-9]/g, ""))) rest[f] = v;
    const extra: Obj = {};
    if (a) {
      for (const [field, name] of ADD_UP) if ((a.n.get(field) ?? 0) > 0) extra[name] = Math.round((a.sum.get(field) as number) * 100) / 100;
      for (const [field, name] of ADD_UP_ALL) if ((a.n.get(field) ?? 0) === a.parts) extra[name] = Math.round((a.sum.get(field) as number) * 100) / 100;
    }
    out[k] = { ...extra, ...rest };
  }
  return out;
}

async function billOnce(from: string, to: string, stationId: string, timeoutMs?: number): Promise<unknown> {
  const qs = billQuery(from, to, stationId);
  clearRequestMemo();
  try {
    return checkReply(await dpuGet(`${FARMER_BILL_PATH}?${qs}`, 0, timeoutMs));
  } catch (e) {
    if (e instanceof EmptyReplyError) return {};
    // The DPU host answers a VLC that has no bill for the period with this file-permission text: shown as "No record found"
    if (e instanceof ApiError && e.kind !== "auth" && SERVER_FILE_ERROR.test(e.message)) {
      console.warn("[farmer bill] DPU answered with a file error, shown as no record:", e.message);
      return {};
    }
    throw e;
  }
}

const partial = new WeakMap<object, string[]>();
/** Date ranges the server could not answer while the bill was put together from shorter requests (empty when the bill is complete). */
export const missingRanges = (raw: unknown): string[] => (typeof raw === "object" && raw !== null ? (partial.get(raw) ?? []) : []);

/** true when the reply holds at least one farmer's bill */
export function hasBillData(raw: unknown): boolean {
  const o = asObj(raw);
  return !!o && Object.values(o).some((v) => isObj(v) || asObj(v) !== null);
}

/** Top-level keys of a reply, for the "could not be read" message. */
export function replyKeys(raw: unknown): string[] {
  const o = asObj(raw);
  return o ? Object.keys(o).slice(0, 3) : [];
}

/** A long period is asked in small windows (the server times out on big ones), a few at a time. */
const WINDOW_DAYS = 5;
const WINDOW_PARALLEL = 5;
/** per window: a slow window gives up early and is cut into smaller pieces instead of blocking the screen for 90 seconds */
const WINDOW_TIMEOUT_MS = 60_000;
/** Answered windows are kept for a few minutes: showing the same VLC and dates again (or a longer period that contains them) is instant. */
const winCache = new Map<string, { at: number; got: Obj[] }>();
const CACHE_MS = 10 * 60_000;
const localToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const cacheKey = (stationId: string, start: string, end: string) => `${getSession()?.scope ?? ""}|${stationId}|${start}|${end}`;
function fromCache(stationId: string, start: string, end: string): Obj[] | null {
  const hit = winCache.get(cacheKey(stationId, start, end));
  return hit && Date.now() - hit.at < CACHE_MS ? hit.got : null;
}
function toCache(stationId: string, start: string, end: string, got: Obj[]) {
  if (end >= addDays(localToday(), -1)) return; // today's and yesterday's entries can still change
  if (winCache.size > 200) winCache.clear();
  winCache.set(cacheKey(stationId, start, end), { at: Date.now(), got });
}
const dmyShort = (iso: string): string => iso.split("-").reverse().join("-");
const dayCount = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

export interface BillProgress {
  done: number;
  total: number;
  /** the bills of the windows answered so far, joined (shown while the rest is still loading) */
  raw: unknown;
}

/**
 * One window. When the server does not answer it, the window is cut in two and each half is asked again (down to single days);
 * a single day that still fails (after one more try) is added to `missing` - never hidden as "no record".
 */
async function fetchSpan(start: string, end: string, stationId: string, missing: string[]): Promise<Obj[]> {
  const kept = fromCache(stationId, start, end);
  if (kept) return kept;
  const missingBefore = missing.length;
  const parts = await fetchSpanLive(start, end, stationId, missing);
  if (missing.length === missingBefore) toCache(stationId, start, end, parts);
  return parts;
}

async function fetchSpanLive(start: string, end: string, stationId: string, missing: string[]): Promise<Obj[]> {
  try {
    const got = asObj(await billOnce(start, end, stationId, WINDOW_TIMEOUT_MS));
    return got && Object.keys(got).length ? [got] : [];
  } catch (e) {
    if (e instanceof ApiError && e.kind === "auth") throw e;
    if (e instanceof ApiError && e.kind === "cancelled") throw e;
    console.warn(`[farmer bill] ${start} to ${end} not answered:`, e instanceof Error ? e.message : e);
    if (start >= end) {
      try {
        const got = asObj(await billOnce(start, end, stationId, WINDOW_TIMEOUT_MS));
        return got && Object.keys(got).length ? [got] : [];
      } catch {
        missing.push(start);
        return [];
      }
    }
    const mid = addDays(start, Math.floor((dayCount(start, end) - 1) / 2));
    const left = await fetchSpan(start, mid, stationId, missing);
    const right = await fetchSpan(addDays(mid, 1), end, stationId, missing);
    return [...left, ...right];
  }
}

/** days (yyyy-mm-dd) -> "dd-mm-yyyy To dd-mm-yyyy" ranges */
function dayRanges(days: string[]): string[] {
  const sorted = [...new Set(days)].sort();
  const out: string[] = [];
  let from = "";
  let prev = "";
  for (const d of sorted) {
    if (from && addDays(prev, 1) === d) {
      prev = d;
      continue;
    }
    if (from) out.push(from === prev ? dmyShort(from) : `${dmyShort(from)} To ${dmyShort(prev)}`);
    from = d;
    prev = d;
  }
  if (from) out.push(from === prev ? dmyShort(from) : `${dmyShort(from)} To ${dmyShort(prev)}`);
  return out;
}

/** The period asked in small windows (a few at a time); the screen is filled as the windows arrive. */
async function billInWindows(from: string, to: string, stationId: string, onProgress?: (p: BillProgress) => void, cancelled?: () => boolean): Promise<unknown> {
  const spans: Array<[string, string]> = [];
  for (let start = from; start <= to; start = addDays(start, WINDOW_DAYS)) {
    const end = addDays(start, WINDOW_DAYS - 1) < to ? addDays(start, WINDOW_DAYS - 1) : to;
    spans.push([start, end]);
  }
  const results: Obj[][] = spans.map(() => []);
  const missing: string[] = [];
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (next < spans.length && !cancelled?.()) {
      const i = next++;
      const [a, b] = spans[i] as [string, string];
      results[i] = await fetchSpan(a, b, stationId, missing);
      done += 1;
      if (onProgress && done < spans.length) {
        onProgress({ done, total: spans.length, raw: {} });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(WINDOW_PARALLEL, spans.length) }, worker));
  if (cancelled?.()) return {}; // a newer Show Record replaced this one
  const parts = results.flat();
  if (!parts.length) {
    // nothing came back: when some days did not answer that is a server problem, not "no record"
    if (missing.length) throw new ApiError(`The server did not answer for ${dayRanges(missing).join(", ")}. Please press Show Record again.`, "server");
    return {};
  }
  const all = mergeBills(parts, from, to);
  merged.add(all);
  if (missing.length) partial.set(all, dayRanges(missing));
  return all;
}

export async function getPrintTableData(
  from: string,
  to: string,
  stationId: string,
  onProgress?: (p: BillProgress) => void,
  cancelled?: () => boolean,
): Promise<unknown> {
  // DPU API only: GET https://dpu.shivinfotech.co.in/api/Login/MilkBillProcessma?id=0&fromdate=&todate=&stationid=
  // A long period goes straight to small windows: asking it in one piece only makes the server time out after 90 seconds.
  if (dayCount(from, to) > WINDOW_DAYS) return billInWindows(from, to, stationId, onProgress, cancelled);
  try {
    return await billOnce(from, to, stationId);
  } catch (e) {
    if (!(e instanceof ApiError) || !TIMEOUT.test(e.message)) throw e;
    if (from >= to) throw e; // a single day the server cannot answer: an error, not "no record"
    return billInWindows(from, to, stationId, onProgress, cancelled);
  }
}

/** Freeze the bill. The plain JSON body is sent first; if the server refuses it, the encrypted { Payload } form is tried. */
export async function postBillFreeze(data: BillFreeze): Promise<string> {
  const attempts: SaveAttempt[] = [{ label: "json", path: BILL_FREEZE_PATH, body: data }];
  try {
    for (const body of encryptedShapes(data)) attempts.push({ label: "payload", path: BILL_FREEZE_PATH, body });
  } catch {
    /* no encryption key configured: only the plain body is tried */
  }
  const message = await dpuSaveAttempts("FarmerBillFreeze", attempts);
  clearRequestMemo();
  return message;
}

export interface BillShift {
  wt: string;
  fat: string;
  snf: string;
  rate: string;
  amt: string;
}
export interface BillLine {
  label: string;
  milk: string;
  total: boolean;
  m: BillShift;
  e: BillShift;
}
export interface BillPair {
  label: string;
  value: string;
}
export interface BillExtras {
  incentive: number;
  transport: number;
  deposit: number;
  advance: number;
  cattleFeed: number;
  /** sent by the server, else deposit + advance + cattle feed */
  totalDeduction?: number;
  /** sent by the server, else Total Amount + Incentive + Transport - Total Deduction */
  net?: number;
  overRate?: number;
}
export interface FarmerBillData {
  id: string;
  name: string;
  range: string;
  lines: BillLine[];
  summary: BillPair[][];
  net: string;
  /** litres / amounts per milk type, kept so the summary can be built again when more figures arrive */
  totals: { liters: Record<string, number>; amounts: Record<string, number> };
  extras: BillExtras;
  /** true when the bill reply itself carried Incentive / Transport / Milk Deposit */
  extrasFound: boolean;
  extended: boolean;
}

/** "1 Ufjttj": the farmer's id and name together, as on the old bill. */
export const farmerLabel = (b: { id: string; name: string }): string => {
  const id = b.id.trim();
  const name = b.name.trim();
  if (!id) return name;
  if (!name) return id;
  return name.toLowerCase().startsWith(`${id.toLowerCase()} `) ? name : `${id} ${name}`;
};

const BILL_KNOWN: Record<string, string> = {
  cowmilk: "Cow",
  buffalomilk: "Buff",
  mixmilk: "Mix",
};
const BILL_ORDER = ["cowmilk", "buffalomilk", "mixmilk"];
const f2 = (x: number) => x.toFixed(2);
const billKey = (d: string) => {
  const [dd, mm, yy] = d.split("/");
  return `${yy}${(mm ?? "").padStart(2, "0")}${(dd ?? "").padStart(2, "0")}`;
};
const billDmy = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s.trim())
    ? s.trim().split("-").reverse().join("-")
    : s.trim();

function billHeading(key: string): { id: string; name: string; range: string } {
  const parts = key.split(" : ");
  const range = (parts.length > 1 ? parts[parts.length - 1] : "")
    .split(/\s+To\s+/i)
    .map(billDmy)
    .join(" To ");
  const pieces = parts
    .slice(1, -1)
    .join(" : ")
    .split(",")
    .map((s) => s.trim());
  const id = pieces[0] || (parts[0] ?? "").replace(/^farmerid:/i, "").trim();
  const name =
    pieces.length >= 3 ? pieces.slice(1, -1).filter(Boolean).join(", ") : "";
  return { id, name, range };
}

interface BillRaw {
  date: string;
  mw: number;
  mf: number;
  ms: number;
  mr: number;
  ma: number;
  ew: number;
  ef: number;
  es: number;
  er: number;
  ea: number;
}
const bv = (o: Obj, ...keys: string[]) =>
  pickValue(
    o,
    keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "")),
  );
const billRaw = (o: Obj): BillRaw => ({
  date: String(bv(o, "dtdate") ?? ""),
  mw: num(bv(o, "mweight")),
  mf: num(bv(o, "mfat")),
  ms: num(bv(o, "msnf")),
  mr: num(bv(o, "mrate")),
  ma: num(bv(o, "mtotal_amount")),
  ew: num(bv(o, "eweight")),
  ef: num(bv(o, "efat")),
  es: num(bv(o, "esnf")),
  er: num(bv(o, "erate")),
  ea: num(bv(o, "etotal_amount")),
});
const billShift = (
  w: number,
  f: number,
  s: number,
  r: number,
  a: number,
): BillShift => ({
  wt: f2(w),
  fat: f2(f),
  snf: f2(s),
  rate: f2(r),
  amt: f2(a),
});
const billAvg = (
  rows: BillRaw[],
  wt: (r: BillRaw) => number,
  val: (r: BillRaw) => number,
): number => {
  const live = rows.filter((r) => wt(r) > 0);
  return live.length ? live.reduce((a, r) => a + val(r), 0) / live.length : 0;
};

function billOf(
  key: string,
  value: Obj,
  extended: boolean,
): FarmerBillData | null {
  const lines: BillLine[] = [];
  const liters: Record<string, number> = {};
  const amounts: Record<string, number> = {};

  const groups = Object.keys(value)
    .filter((k) => isMilkList(k, value[k]))
    .sort((a, b) => {
      const ia = BILL_ORDER.indexOf(a.toLowerCase());
      const ib = BILL_ORDER.indexOf(b.toLowerCase());
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  for (const g of groups) {
    const label =
      BILL_KNOWN[g.toLowerCase()] ??
      g.replace(/milk$/i, "").replace(/^./, (c) => c.toUpperCase());
    const rows = (value[g] as unknown[])
      .filter(isObj)
      .map(billRaw)
      .sort((a, b) => billKey(a.date).localeCompare(billKey(b.date)));
    if (!rows.length) continue;
    for (const r of rows)
      lines.push({
        label: r.date,
        milk: label,
        total: false,
        m: billShift(r.mw, r.mf, r.ms, r.mr, r.ma),
        e: billShift(r.ew, r.ef, r.es, r.er, r.ea),
      });
    const sum = (f: (r: BillRaw) => number) =>
      rows.reduce((a, r) => a + f(r), 0);
    lines.push({
      label,
      milk: "Total",
      total: true,
      m: billShift(
        sum((r) => r.mw),
        billAvg(
          rows,
          (r) => r.mw,
          (r) => r.mf,
        ),
        billAvg(
          rows,
          (r) => r.mw,
          (r) => r.ms,
        ),
        billAvg(
          rows,
          (r) => r.mw,
          (r) => r.mr,
        ),
        sum((r) => r.ma),
      ),
      e: billShift(
        sum((r) => r.ew),
        billAvg(
          rows,
          (r) => r.ew,
          (r) => r.ef,
        ),
        billAvg(
          rows,
          (r) => r.ew,
          (r) => r.es,
        ),
        billAvg(
          rows,
          (r) => r.ew,
          (r) => r.er,
        ),
        sum((r) => r.ea),
      ),
    });
    liters[label] = sum((r) => r.mw + r.ew);
    amounts[label] = sum((r) => r.ma + r.ea);
  }
  if (!lines.length) return null;

  const found = scanExtras(value);
  const extras: BillExtras = {
    incentive: found.incentive ?? 0,
    transport: found.transport ?? 0,
    deposit: found.deposit ?? 0,
    advance: found.advance ?? 0,
    cattleFeed: found.cattleFeed ?? 0,
    ...(found.totalDeduction !== undefined ? { totalDeduction: found.totalDeduction } : {}),
    ...(found.net !== undefined ? { net: found.net } : {}),
    ...(found.overRate !== undefined ? { overRate: found.overRate } : {}),
  };
  const extrasFound = found.incentive !== undefined || found.transport !== undefined || found.deposit !== undefined;
  if (import.meta.env.DEV && !extrasFound) {
    console.info("[farmer bill] no Incentive / Transport / Milk Deposit in the reply of", key, "- fields:", Object.keys(value));
  }

  const h = billHeading(key);
  const bill: FarmerBillData = {
    id: h.id,
    name: h.name || scanName(value),
    range: h.range,
    lines,
    summary: [],
    net: "0.00",
    totals: { liters, amounts },
    extras,
    extrasFound,
    extended,
  };
  return withSummary(bill);
}

/** Farmer name kept inside the reply when the heading has none (top level first, then the first daily row). */
function scanName(value: Obj): string {
  const NAMES = ["farmername", "membername", "fname", "name"];
  const look = (o: Obj): string => {
    for (const w of NAMES) {
      const k = Object.keys(o).find((x) => x.toLowerCase().replace(/[^a-z0-9]/g, "") === w);
      const v = k === undefined ? undefined : o[k];
      if (typeof v === "string" && v.trim() && !/^[\d\s.,-]+$/.test(v.trim())) return v.trim();
    }
    return "";
  };
  const top = look(value);
  if (top) return top;
  for (const [k, v] of Object.entries(value)) {
    if (isMilkList(k, v) && Array.isArray(v) && isObj(v[0])) {
      const n = look(v[0]);
      if (n) return n;
    }
  }
  return "";
}

/** Summary block (litres, amounts, advance, incentive, transport, deductions, net) of a bill, from its totals and extras. */
function withSummary(bill: FarmerBillData): FarmerBillData {
  const { liters, amounts } = bill.totals;
  const e = bill.extras;
  const L = (k: string) => liters[k] ?? 0;
  const A = (k: string) => amounts[k] ?? 0;
  const totalLiter = Object.values(liters).reduce((a, b) => a + b, 0);
  const totalAmount = Object.values(amounts).reduce((a, b) => a + b, 0);
  const totalDeduction = e.totalDeduction ?? e.deposit + e.advance + e.cattleFeed;
  // old bill: Net Payment = Total Amount + Incentive + Transport - Total Deduction
  const netValue = e.net ?? totalAmount + e.incentive + e.transport - totalDeduction;
  const net = f2(netValue);
  const p = (label: string, v: number | string): BillPair => ({
    label,
    value: typeof v === "number" ? f2(v) : v,
  });

  const summary: BillPair[][] = [
    [
      p("Cow Liter", L("Cow")),
      p("Buff Liter", L("Buff")),
      p("Mix Liter", L("Mix")),
      p("Cow Amt", A("Cow")),
    ],
    [
      p("Buff Amount", A("Buff")),
      p("Mix Amount", A("Mix")),
      p("Total Liter", totalLiter),
      p("Total Amount", totalAmount),
    ],
  ];
  if (bill.extended) {
    summary.push(
      [
        p("Current Advance", e.advance),
        p("Over Rate", e.overRate ?? A("Mix")),
        p("Milk Deposit", e.deposit),
        p("Cattle Feed", e.cattleFeed),
      ],
      [
        p("Incentive", e.incentive),
        p("Transport", e.transport),
        p("Total Deduction", totalDeduction),
        p("Net Payment", net),
      ],
    );
  } else {
    // Milk Deposit is shown on every bill; Net Payment gets its own full-width row
    summary.push(
      [
        p("Incentive", e.incentive),
        p("Transport", e.transport),
        p("Milk Deposit", e.deposit),
        p("Total Deduction", totalDeduction),
      ],
      [p("Net Payment", net)],
    );
  }
  return { ...bill, summary, net };
}

/** Adds figures that arrived later (e.g. from the payment summary) and builds the summary again. */
export function applyExtras(bill: FarmerBillData, patch: Partial<BillExtras>): FarmerBillData {
  return withSummary({ ...bill, extras: { ...bill.extras, ...patch }, extrasFound: true });
}

/* ---- Incentive / Transport / Milk Deposit ... read from the bill reply, wherever the server keeps them ---- */

const toNum = (v: unknown): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string" || !v.trim()) return undefined;
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
};
const NAME_FIELDS = ["billhead", "headname", "head", "deductionname", "deductiontype", "particular", "particulars", "description", "name", "type"];
const AMOUNT_FIELDS = ["amount", "amt", "value", "total", "totalamount"];

/** Scalars of the farmer's object (the daily milk lists are skipped). A list of { head name, amount } rows becomes name -> amount. */
function flatten(o: Obj, out: Map<string, number>, depth = 0): void {
  if (depth > 3) return;
  for (const [k, v] of Object.entries(o)) {
    const nk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (Array.isArray(v)) {
      if (/milk$/.test(nk) || looksLikeMilkRows(v)) continue;
      for (const item of v) {
        if (!isObj(item)) continue;
        const keys = Object.keys(item);
        const nameKey = NAME_FIELDS.map((n) => keys.find((x) => x.toLowerCase().replace(/[^a-z0-9]/g, "") === n)).find((x) => x && typeof item[x] === "string");
        const amountKey = AMOUNT_FIELDS.map((n) => keys.find((x) => x.toLowerCase().replace(/[^a-z0-9]/g, "") === n)).find((x) => x && toNum(item[x]) !== undefined);
        if (nameKey && amountKey) {
          const hk = String(item[nameKey]).toLowerCase().replace(/[^a-z0-9]/g, "");
          if (hk && !out.has(hk)) out.set(hk, toNum(item[amountKey]) as number);
        }
        flatten(item, out, depth + 1);
      }
      continue;
    }
    if (isObj(v)) {
      flatten(v, out, depth + 1);
      continue;
    }
    const n = toNum(v);
    if (n !== undefined && !out.has(nk)) out.set(nk, n);
  }
}

const firstOf = (m: Map<string, number>, names: string[]): number | undefined => {
  for (const n of names) {
    const v = m.get(n);
    if (v !== undefined) return v;
  }
  return undefined;
};
const sumOf = (m: Map<string, number>, names: string[]): number | undefined => {
  const vals = names.map((n) => m.get(n)).filter((x): x is number => x !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
};

function scanExtras(value: Obj): Partial<BillExtras> {
  const m = new Map<string, number>();
  flatten(value, m);
  const out: Partial<BillExtras> = {};
  const set = <K extends keyof BillExtras>(k: K, v: number | undefined) => {
    if (v !== undefined) out[k] = v as BillExtras[K];
  };
  set("incentive", firstOf(m, ["incentive", "totalincentive", "incentiveamount", "incentiveamt", "commission", "totalcommission", "comm", "totalcomm"]) ?? sumOf(m, ["cowcomm", "buffcomm", "buffalocomm", "mixcomm"]));
  set("transport", firstOf(m, ["transport", "totaltransport", "transportamount", "transportamt"]) ?? sumOf(m, ["cowtrans", "bufftrans", "buffalotrans", "mixtrans"]));
  set("deposit", firstOf(m, ["milkdeposit", "deposit", "totaldeposit", "milkdepositamount"]) ?? sumOf(m, ["cowdeposit", "buffdeposit", "buffalodeposit", "mixdeposit"]));
  set("advance", firstOf(m, ["currentadvance", "advance", "advanceamount"]));
  set("cattleFeed", firstOf(m, ["cattlefeed", "cattlefeedamount", "cattlefeedamt"]));
  set("overRate", firstOf(m, ["overrate", "overrateamount"]));
  set("totalDeduction", firstOf(m, ["totaldeduction", "totaldeductions", "deductionamount"]));
  set("net", firstOf(m, ["netpayment", "netpayable", "netamount", "payableamount"]));
  return out;
}

/**
 * Fallback when the bill reply carries no Incentive / Transport / Milk Deposit: the same figures from the farmer payment
 * summary (MilkBillPayCashMA) of the same VLC and dates, by farmer id. Quiet - an empty map when it has nothing.
 */
export async function getExtrasFromSummary(from: string, to: string, stationId: string): Promise<Map<string, Partial<BillExtras>>> {
  const out = new Map<string, Partial<BillExtras>>();
  try {
    const rows = await getCashSummary({ type: "farmer", fromdate: from, todate: to, stationid: stationId });
    for (const r of rows) {
      const m = new Map<string, number>();
      for (const [k, v] of Object.entries(r)) {
        const n = toNum(v);
        if (n !== undefined) m.set(k.toLowerCase().replace(/[^a-z0-9]/g, ""), n);
      }
      const idRaw = ["farmerid", "codeno", "farmercode"].map((k) => r[Object.keys(r).find((x) => x.toLowerCase().replace(/[^a-z0-9]/g, "") === k) ?? ""]).find((v) => v !== undefined && v !== null && String(v).trim() !== "");
      if (idRaw === undefined) continue;
      const part: Partial<BillExtras> = {};
      const inc = sumOf(m, ["cowcomm", "buffcomm"]) ?? firstOf(m, ["incentive"]);
      const tr = sumOf(m, ["cowtrans", "bufftrans"]) ?? firstOf(m, ["transport"]);
      const dep = sumOf(m, ["cowdeposit", "buffdeposit"]) ?? firstOf(m, ["milkdeposit"]);
      if (inc !== undefined) part.incentive = inc;
      if (tr !== undefined) part.transport = tr;
      if (dep !== undefined) part.deposit = dep;
      const adv = firstOf(m, ["advance"]);
      const cf = firstOf(m, ["cattlefeed"]);
      if (adv !== undefined) part.advance = adv;
      if (cf !== undefined) part.cattleFeed = cf;
      out.set(idKey(String(idRaw)), part);
    }
  } catch {
    /* no summary for this period (bill not frozen yet): the bill keeps the figures it has */
  }
  return out;
}

/** "0001" and "1" are the same farmer */
export const idKey = (id: string): string => {
  const t = id.trim();
  return /^\d+$/.test(t) ? String(Number(t)) : t.toLowerCase();
};

export function parseFarmerBills(
  data: unknown,
  extended = false,
): FarmerBillData[] {
  let json = data;
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch {
      return [];
    }
  }
  if (!isObj(json)) return [];
  const billsOf = (o: Obj): FarmerBillData[] => {
    const list: FarmerBillData[] = [];
    for (const [key, raw] of Object.entries(o)) {
      const value = isObj(raw) ? raw : asObj(raw);
      if (!value) continue;
      const bill = billOf(key, value, extended);
      if (bill) list.push(bill);
    }
    return list;
  };
  const out = billsOf(json);
  if (out.length) return out;
  // the bills may sit one level deeper (e.g. { Data: { "farmerid:... ": {...} } })
  for (const raw of Object.values(json)) {
    const inner = isObj(raw) ? raw : asObj(raw);
    if (inner) out.push(...billsOf(inner));
  }
  return out;
}

export interface BillExportRow {
  farmer: string;
  date: string;
  milk: string;
  m: BillShift | null;
  e: BillShift | null;
  net?: string;
}

export function billExportRows(
  bills: FarmerBillData[],
  repeatName = false,
): BillExportRow[] {
  const out: BillExportRow[] = [];
  for (const b of bills) {
    let first = true;
    const who = () => {
      const v = repeatName || first ? farmerLabel(b) : "";
      first = false;
      return v;
    };
    for (const l of b.lines)
      out.push({ farmer: who(), date: l.label, milk: l.milk, m: l.m, e: l.e });
    out.push({
      farmer: who(),
      date: "Net Payment",
      milk: "",
      m: null,
      e: null,
      net: b.net,
    });
  }
  return out;
}
