import { ALL_MILK_CODE, FARMER_MILK_CODES } from '../config';
import { gatewayPostJson, gatewayText, listOf, parseGatewayText, type Priority } from '../http/client';
import { dpuGet, dpuPostJson, dpuUrl, openDpuReply } from '../http/dpu';
import { adaptiveCollection, collectionWaves, fanOut, needSession, type CollectionParams, type Emit } from '../http/fanout';
import type { RawFarmerRow, RawLoose } from '../types/raw';
import type { QueryData } from '../http/fanout';
import { apiDate, eachDay } from '../utils/date';
import { ApiError, isCancelled } from '../http/errors';
import { dayCacheGet, dayCacheSet } from '../http/chunkCache';


export const DPU_FARMER_COLLECTION = true;
export const DPU_FARMER_COLLECTION_URL = dpuUrl('/Login/FarmerCollection');

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const nk = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Raw field -> names the DPU reply may use for it (compared ignoring case / symbols). */
const ALIASES: Record<keyof RawFarmerRow, string[]> = {
  farmerid: ['farmerid', 'farmercode', 'farmer', 'farmerno', 'fid'],
  sampleno: ['sampleno', 'sampleid', 'sample'],
  trdate: ['trdate', 'date', 'collectiondate', 'entrydate', 'dtdate'],
  qty: ['qty', 'liter', 'litre', 'liters', 'quantity'],
  Kg: ['kg', 'weight'],
  fat: ['fat'],
  snf: ['snf'],
  clr: ['clr'],
  water: ['water'],
  milktype: ['milktype', 'milk', 'milkcode'],
  Time: ['time', 'collectiontime', 'entrytime'],
  vlccid: ['vlccid', 'villageid', 'vlcid', 'stationid', 'dcscode'],
  shift: ['shift'],
  rtpl: ['rtpl', 'rate', 'ratepl'],
  amount: ['amount', 'amt', 'total'],
  farmername: ['farmername', 'name', 'fname'],
  usbflag: ['usbflag'],
  MaxId: ['maxid', 'id', 'recordid'],
  villagename: ['villagename', 'vlccname', 'dcsname', 'centername'],
  villageagentaddress: ['villageagentaddress', 'address'],
  beneficiaryname: ['beneficiaryname', 'centercode', 'customstationid'],
  stationcode: ['stationcode', 'customstationid', 'centercode', 'stationid'],
  branchid: ['branchid', 'branchcode'],
};

/** "2026-11-02T00:00:00" / "02/11/2026" -> "02 Nov 2026" (the format the pages read). */
export function trdateOf(v: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return `${iso[3]} ${MON[Number(iso[2]) - 1]} ${iso[1]}`;
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(v);
  if (dmy) return `${dmy[1]!.padStart(2, '0')} ${MON[Number(dmy[2]) - 1]} ${dmy[3]}`;
  return v;
}

/**
 * Which reply key answers which raw field. The key names of a reply are the same for every row, so the lookup is worked out ONCE
 * per distinct set of keys (not once per row x field x alias, which made big reports very slow).
 */
const aliasPlanCache = new Map<string, Array<[string, string[]]>>();
function aliasPlanFor(keys: string[]): Array<[string, string[]]> {
  const sig = keys.join('\u0001');
  const hit = aliasPlanCache.get(sig);
  if (hit) return hit;
  const normal = keys.map((k) => nk(k));
  const plan: Array<[string, string[]]> = [];
  for (const [field, names] of Object.entries(ALIASES)) {
    const found: string[] = [];
    for (const want of names) {
      const i = normal.indexOf(want);
      if (i >= 0) found.push(keys[i]!);
    }
    if (found.length) plan.push([field, found]);
  }
  if (aliasPlanCache.size > 50) aliasPlanCache.clear();
  aliasPlanCache.set(sig, plan);
  return plan;
}

function toRawFarmer(r: RawLoose, vlccid: string, milk: string, shift: string): RawFarmerRow {
  const out: Record<string, unknown> = { ...r };
  for (const [field, found] of aliasPlanFor(Object.keys(r))) {
    for (const key of found) {
      const v = r[key];
      if (v !== undefined && v !== null && v !== '') {
        out[field] = typeof v === 'number' ? String(v) : v;
        break;
      }
    }
  }
  if (!out.vlccid) out.vlccid = vlccid;
  if (!out.milktype) out.milktype = milk;
  if (!out.shift && shift !== 'Z') out.shift = shift;
  if (typeof out.trdate === 'string') out.trdate = trdateOf(out.trdate);
  return out as unknown as RawFarmerRow;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const LIST_KEYS = ['data', 'result', 'results', 'rows', 'items', 'table', 'list', 'response', 'farmercollection', 'collection', 'records', 'details'];

/** Finds the array of rows wherever the DPU reply keeps it (root, Data, Result, JSON-in-a-string, nested). */
function findRows(v: unknown, depth = 0): RawLoose[] | null {
  if (depth > 5) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t.startsWith('[') && !t.startsWith('{')) return null;
    try {
      return findRows(JSON.parse(t), depth + 1);
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) return v.filter(isObj) as RawLoose[];
  if (!isObj(v)) return null;
  const keys = Object.keys(v);
  for (const want of LIST_KEYS) {
    const k = keys.find((x) => nk(x) === want);
    if (k === undefined) continue;
    const got = findRows(v[k], depth + 1);
    if (got) return got;
  }
  for (const k of keys) {
    const got = findRows(v[k], depth + 1);
    if (got && (got.length > 0 || Array.isArray(v[k]))) return got;
  }
  return null;
}

export function rowsOfReply(reply: unknown): RawLoose[] {
  if (isObj(reply)) {
    const okKey = Object.keys(reply).find((k) => ['success', 'issuccess', 'status'].includes(nk(k)));
    const ok = okKey ? reply[okKey] : undefined;
    const msgKey = Object.keys(reply).find((k) => ['message', 'msg', 'error'].includes(nk(k)));
    const msg = msgKey ? String(reply[msgKey] ?? '').trim() : '';
    if (ok === false || String(ok).toLowerCase() === 'false') {
      if (!msg || /no\s*(record|data)/i.test(msg)) return [];
      throw new ApiError(msg, 'server');
    }
  }
  const rows = findRows(reply);
  if (rows) return rows;
  const shape = isObj(reply) ? `keys: ${Object.keys(reply).join(', ')}` : typeof reply;
  throw new ApiError(`DPU FarmerCollection reply has no row list (${shape}).`, 'parse');
}

const dpuMilkCodes = (m: CollectionParams['milk']): string[] =>
  m !== 'ALL' ? [m] : ALL_MILK_CODE ? [ALL_MILK_CODE] : FARMER_MILK_CODES;

async function dpuCall(body: Record<string, string>, priority: Priority = 1, signal?: AbortSignal, timeoutMs?: number): Promise<unknown> {
  const text = await gatewayText(
    DPU_FARMER_COLLECTION_URL,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    priority,
    true,
    { ...(signal ? { signal } : {}), ...(timeoutMs ? { timeoutMs } : {}) },
  );
  const reply = openDpuReply(parseGatewayText(text));
  return reply;
}

/** Most requests one report may have in flight at once for its date range (the browser sends 10 at a time). */
const MAX_RANGE_REQUESTS = 24;
/** A small (one centre, a few days) request that has not answered after this long is retried instead of hanging for 90 s. */
const CHUNK_TIMEOUT_MS = 80_000;

/** Splits a date range into the day windows that are asked in parallel. */
export function dateChunks(from: string, to: string, windows: number): Array<[string, string]> {
  const days = eachDay(from, to);
  const size = Math.max(1, Math.ceil(days.length / Math.max(1, windows)));
  const out: Array<[string, string]> = [];
  for (let i = 0; i < days.length; i += size) out.push([days[i]!, days[Math.min(days.length, i + size) - 1]!]);
  return out.length ? out : [[from, to]];
}

const MON_INDEX: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** "07 Aug 2026" (what toRawFarmer produces) -> "2026-08-07"; '' when it cannot be read */
export const isoOfTrdate = (v: unknown): string => {
  const m = /^(\d{2}) ([A-Za-z]{3}) (\d{4})$/.exec(String(v ?? '').trim());
  const mm = m ? MON_INDEX[m[2]!] : undefined;
  return m && mm ? `${m[3]}-${mm}-${m[1]}` : '';
};
const addOneDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
/** Missing days -> request windows: runs of following days, cut into at most about `windows` pieces. */
export function windowsOf(missing: string[], windows: number): Array<[string, string]> {
  if (!missing.length) return [];
  const days = [...missing].sort();
  const size = Math.max(1, Math.ceil(days.length / Math.max(1, windows)));
  const out: Array<[string, string]> = [];
  let start = 0;
  for (let i = 1; i <= days.length; i++) {
    const breaks = i === days.length || addOneDay(days[i - 1]!) !== days[i] || i - start >= size;
    if (breaks) {
      out.push([days[start]!, days[i - 1]!]);
      start = i;
    }
  }
  return out;
}

async function fetchDpuFarmerCollection(p: CollectionParams, emit?: Emit<RawFarmerRow>, signal?: AbortSignal) {
  const session = needSession();
  const priority = p.priority ?? 1;
  const codes = dpuMilkCodes(p.milk);
  const started = Date.now();
  const days = eachDay(p.from, p.to);
  const keyOf = (id: string, code: string, day: string) => `${session.scope}|${id}|${code}|${p.shift}|${day}`;

  // 1) days that were already loaded (this visit or earlier): answered from the browser, no request
  const saved = await dayCacheGet(p.vlccIds.flatMap((id) => codes.flatMap((code) => days.map((d) => keyOf(id, code, d)))));

  // 2) only the missing days go to the server. One centre (the normal report): the missing range is cut into day windows
  // asked at the same time, so the whole range is ready much sooner than one long request - which the server may also cut off.
  // Many centres (dashboard): one request per centre and milk type.
  const windows = Math.max(1, Math.floor(MAX_RANGE_REQUESTS / Math.max(1, p.vlccIds.length * codes.length)));
  const cachedJobs: Array<() => Promise<RawFarmerRow[]>> = [];
  const plan: Array<{ id: string; code: string; from: string; to: string }> = [];
  for (const id of p.vlccIds) {
    for (const code of codes) {
      const have: RawFarmerRow[] = [];
      const missing: string[] = [];
      for (const d of days) {
        const hit = saved.get(keyOf(id, code, d));
        if (hit) have.push(...(hit as RawFarmerRow[]));
        else missing.push(d);
      }
      if (have.length || !missing.length) cachedJobs.push(async () => have);
      for (const [from, to] of windowsOf(missing, windows)) plan.push({ id, code, from, to });
    }
  }
  const split = plan.length > 1;
  const timings: Array<{ label: string; ms: number; rows: number }> = [];

  const jobs = plan.map(({ id, code, from, to }) => async () => {
    const read = async (f: string, t: string): Promise<RawFarmerRow[]> => {
      const at = Date.now();
      const got = rowsOfReply(
        await dpuCall({ id, stationid: id, shift: p.shift, milktype: code, fromdate: apiDate(f), todate: apiDate(t) }, priority, signal, split ? CHUNK_TIMEOUT_MS : undefined),
      ).map((r) => toRawFarmer(r, id, code, p.shift));
      timings.push({ label: `${code} ${f}..${t}`, ms: Date.now() - at, rows: got.length });
      return got;
    };
    // one retry, then (for a window of several days) day by day: a failed request would otherwise silently drop data
    const once = async (f: string, t: string): Promise<RawFarmerRow[]> => {
      try {
        return await read(f, t);
      } catch (e) {
        if (isCancelled(e)) throw e;
        await new Promise((r) => setTimeout(r, 200));
        return read(f, t);
      }
    };
    let rows: RawFarmerRow[];
    try {
      rows = await once(from, to);
    } catch (e) {
      if (isCancelled(e) || from >= to) throw e;
      rows = (await Promise.all(eachDay(from, to).map((d) => once(d, d)))).flat();
    }
    // the pages match rows to centres by vlccid: keep it one of the ids that were asked for
    for (const r of rows) if (!p.vlccIds.includes(String(r.vlccid))) r.vlccid = id;
    // remember this window day by day (only when every row can be placed on a day of the window)
    const byDay = new Map<string, RawFarmerRow[]>(eachDay(from, to).map((d) => [d, []]));
    let placeable = true;
    for (const r of rows) {
      const bucket = byDay.get(isoOfTrdate(r.trdate));
      if (bucket) bucket.push(r);
      else placeable = false;
    }
    if (placeable) dayCacheSet([...byDay].map(([d, list]) => [keyOf(id, code, d), list] as [string, unknown[]]));
    return rows;
  });

  const result = await fanOut<RawFarmerRow>([[...cachedJobs, ...jobs]], emit, true, signal);
  if (timings.length) {
    const slowest = timings.reduce((a, b) => (b.ms > a.ms ? b : a));
    const sum = timings.reduce((n, x) => n + x.ms, 0);
    // wall time close to "sum of request times" = the server answers one request after the other; much smaller = it answers in parallel
    console.info(`[report] timing: ${timings.length} answered request(s), slowest ${slowest.ms} ms (${slowest.label}, ${slowest.rows} rows), sum of request times ${sum} ms, wall time ${Date.now() - started} ms`);
  }
  console.info(`[report] ${plan.length} request(s) to the server, ${days.length * p.vlccIds.length * codes.length - plan.reduce((n, w) => n + eachDay(w.from, w.to).length, 0)} day(s) from the saved copy, ${result.rows.length} rows in ${Date.now() - started} ms`);
  return result;
}
/**
 * Farmer collection. The DPU API is asked first; when it fails or has no rows for the filters, the portal's own
 * `/home/farmercollection` is asked (the call the other logins use), so every login shows the data SmartX shows.
 */
export async function fetchFarmerCollection(p: CollectionParams, emit?: Emit<RawFarmerRow>, signal?: AbortSignal) {
  if (!DPU_FARMER_COLLECTION) return adaptiveCollection<RawFarmerRow>('/home/farmercollection', p, emit);
  let dpuError: unknown;
  let dpu: QueryData<RawFarmerRow> | null = null;
  try {
    dpu = await fetchDpuFarmerCollection(p, emit, signal);
  } catch (e) {
    if (isCancelled(e)) throw e;
    dpuError = e;
  }
  if (dpu && dpu.rows.length > 0) return dpu;
  try {
    const legacy = await adaptiveCollection<RawFarmerRow>('/home/farmercollection', p, emit);
    if (legacy.rows.length > 0 || !dpu) {
      console.info(`[farmer collection] DPU gave no rows, the portal API gave ${legacy.rows.length}`);
      return legacy;
    }
  } catch (e) {
    if (isCancelled(e)) throw e;
    console.warn('[farmer collection] portal fallback failed:', e instanceof Error ? e.message : e);
  }
  if (dpu) return dpu;
  throw dpuError;
}

export const fetchFarmerMilkEntry = (p: CollectionParams & { rateId: string }, emit?: Emit<RawLoose>) =>
  fanOut<RawLoose>(collectionWaves<RawLoose>('/home/FarmerMilkEntry', p, { rateid: p.rateId }), emit, true);

export function fetchFarmerMaster(vlccIds: string[], emit?: Emit<RawLoose>, priority: Priority = 1) {
  needSession();
  return fanOut<RawLoose>(
    [vlccIds.map((id) => async () => (listOf<RawLoose>(await gatewayPostJson('/home/farmermaster', { VillageIds: id }, priority))).map((r) => ({ ...r, vlccid: id })))],
    emit,
    false,
  );
}

export const getFarmer = (vlcid: string, priority: Priority = 1): Promise<unknown> => {
  needSession();
  return gatewayPostJson('/home/farmermaster', { VillageIds: vlcid }, priority);
};

export async function fetchFarmersOf(vlcid: string): Promise<QueryData<RawLoose>> {
  const rows = listOf<RawLoose>(await getFarmer(vlcid)).map((r) => ({ ...r, vlccid: vlcid }));
  return { rows, failed: 0, total: 1, done: 1 };
}

/* ------------------------------------------------------------------ */
/*  DPU Farmer Master (farmer dropdown): POST /api/Login/FarmerMaster   */
/* ------------------------------------------------------------------ */
export interface MasterFarmerOption {
  vlccid: string;
  farmerId: string;
  name: string;
}

const FARMER_ID_KEYS = ['farmerid', 'farmercode', 'farmer', 'farmerno', 'fid'];
const FARMER_NAME_KEYS = ['farmername', 'name', 'fname'];
const firstOf = (r: RawLoose, wanted: string[]): string => {
  const keys = Object.keys(r);
  for (const w of wanted) {
    const k = keys.find((x) => nk(x) === w);
    const v = k === undefined ? undefined : r[k];
    if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return String(v).trim();
  }
  return '';
};

/** Farmers of one centre, straight from the DPU farmer master (id + name, no collection needed). */
export async function fetchDpuFarmerMaster(vlccid: string): Promise<MasterFarmerOption[]> {
  const parse = (reply: unknown): MasterFarmerOption[] => {
    const found: MasterFarmerOption[] = [];
    for (const r of rowsOfReply(reply)) {
      const farmerId = firstOf(r, FARMER_ID_KEYS);
      if (farmerId) found.push({ vlccid, farmerId, name: firstOf(r, FARMER_NAME_KEYS) });
    }
    return found;
  };
  // 1) POST /Login/FarmerMaster   2) GET /Login/GetFarmer  (the swagger lists both; the first one that answers with farmers wins)
  try {
    const got = parse(await dpuPostJson('/Login/FarmerMaster', { VillageIds: vlccid, id: vlccid, vlccid, stationid: vlccid }, 1));
    if (got.length) return got;
  } catch (e) {
    console.warn('[farmers] FarmerMaster failed:', e instanceof Error ? e.message : e);
  }
  for (const param of ['vlccid', 'VillageIds', 'id']) {
    try {
      const got = parse(await dpuGet(`/Login/GetFarmer?${param}=${encodeURIComponent(vlccid)}`, 1));
      if (got.length) return got;
    } catch (e) {
      console.warn(`[farmers] GetFarmer?${param}= failed:`, e instanceof Error ? e.message : e);
    }
  }
  return [];
}
