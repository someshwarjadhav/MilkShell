import { FARMER_MILK_CODES, ALL_MILK_CODE } from '../config';
import { gatewayText, parseGatewayText } from '../http/client';
import { dpuUrl, openDpuReply } from '../http/dpu';
import { ApiError } from '../http/errors';
import { fanOut, needSession, type CollectionParams, type Emit, type QueryData } from '../http/fanout';
import { isoOfTrdate, nk, rowsOfReply, trdateOf, windowsOf } from '../farmer/farmer.api';
import { dayCacheGet, dayCacheSet } from '../http/chunkCache';
import type { RawLoose, RawVlccRow } from '../types/raw';
import { apiDate, eachDay } from '../utils/date';


export const DPU_VLCC_COLLECTION_PATH = '/Login/VlccCollection';

/** Raw field -> names the DPU reply may use for it (compared ignoring case / symbols). */
const ALIASES: Record<keyof RawVlccRow, string[]> = {
  villagename: ['villagename', 'vlccname', 'vlcname', 'dcsname', 'centername', 'centrename', 'name'],
  vlccid: ['vlccid', 'vlcid', 'villageid', 'stationid', 'dcscode', 'centerid', 'centreid'],
  trdate: ['trdate', 'date', 'collectiondate', 'entrydate', 'dtdate'],
  qty: ['qty', 'liter', 'litre', 'liters', 'totalliter', 'totalqty', 'quantity'],
  fat: ['fat', 'avgfat'],
  snf: ['snf', 'avgsnf'],
  clr: ['clr'],
  milktype: ['milktype', 'milk', 'milkcode'],
  shift: ['shift'],
  kg: ['kg', 'weight', 'totalkg'],
  rate: ['rate', 'rtpl', 'avgrate'],
  amount: ['amount', 'amt', 'total', 'totalamount'],
  beneficiaryname: ['beneficiaryname', 'centercode', 'customstationid'],
};

function toRawVlcc(r: RawLoose, vlccid: string, milk: string, shift: string): RawVlccRow {
  const keys = Object.keys(r);
  const out: Record<string, unknown> = { ...r };
  for (const [field, names] of Object.entries(ALIASES)) {
    for (const want of names) {
      const k = keys.find((x) => nk(x) === want);
      const v = k === undefined ? undefined : r[k];
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
  return out as unknown as RawVlccRow;
}

const milkCodes = (m: CollectionParams['milk']): string[] => (m !== 'ALL' ? [m] : ALL_MILK_CODE ? [ALL_MILK_CODE] : FARMER_MILK_CODES);

async function dpuGetCall(query: Record<string, string>, priority: 0 | 1 | 2 = 1): Promise<unknown> {
  const url = `${dpuUrl(DPU_VLCC_COLLECTION_PATH)}?${new URLSearchParams(query).toString()}`;
  const text = await gatewayText(url, { method: 'GET' }, priority, true);
  return openDpuReply(parseGatewayText(text));
}

export async function fetchVlccCollection(p: CollectionParams, emit?: Emit<RawVlccRow>): Promise<QueryData<RawVlccRow>> {
  const s = needSession();
  if (!s.mccId) {
    throw new ApiError('MCC id is missing. Put VITE_MCC_ID=709 in .env.local and restart `npm run dev`, or sign in again.', 'config');
  }
  const query = (id: string, code: string, from: string, to: string): Record<string, string> => ({
    id,
    stationid: id,
    shift: p.shift,
    milktype: code,
    fromdate: apiDate(from),
    todate: apiDate(to),
    mccid: s.mccId,
  });
  const readRange = async (id: string, code: string, fallbackId: string, from: string, to: string): Promise<RawVlccRow[]> =>
    rowsOfReply(await dpuGetCall(query(id, code, from, to), p.priority ?? 1)).map((r) => toRawVlcc(r, fallbackId, code, p.shift));
  // retry once; a long date range that fails is asked day by day so no centre silently drops out of the totals
  const read = async (id: string, code: string, fallbackId: string, rangeFrom: string, rangeTo: string): Promise<RawVlccRow[]> => {
    const once = async (from: string, to: string): Promise<RawVlccRow[]> => {
      try {
        return await readRange(id, code, fallbackId, from, to);
      } catch {
        await new Promise((r) => setTimeout(r, 200));
        return readRange(id, code, fallbackId, from, to);
      }
    };
    try {
      return await once(rangeFrom, rangeTo);
    } catch (e) {
      if (rangeFrom >= rangeTo) throw e;
      return (await Promise.all(eachDay(rangeFrom, rangeTo).map((d) => once(d, d)))).flat();
    }
  };

  // days that were already loaded (this visit or earlier) come from the browser; only the missing days go to the server
  const codes = milkCodes(p.milk);
  const days = eachDay(p.from, p.to);
  const idsKey = p.vlccIds.join(',');
  const keyOf = (code: string, day: string) => `${s.scope}|vlcc|${idsKey}|${code}|${p.shift}|${day}`;
  const saved = await dayCacheGet(codes.flatMap((code) => days.map((d) => keyOf(code, d))));

  const cachedJobs: Array<() => Promise<RawVlccRow[]>> = [];
  const plan: Array<{ code: string; from: string; to: string }> = [];
  for (const code of codes) {
    const have: RawVlccRow[] = [];
    const missing: string[] = [];
    for (const d of days) {
      const hit = saved.get(keyOf(code, d));
      if (hit) have.push(...(hit as RawVlccRow[]));
      else missing.push(d);
    }
    if (have.length || !missing.length) cachedJobs.push(async () => have);
    for (const [from, to] of windowsOf(missing, 1)) plan.push({ code, from, to });
  }

  const jobs = plan.map(({ code, from, to }) => async () => {
    let incomplete = false;
    const rows = await (async (): Promise<RawVlccRow[]> => {
      if (p.vlccIds.length <= 1) return read(p.vlccIds[0] ?? '', code, p.vlccIds[0] ?? '', from, to);
      // one call for every centre; if the API only answers one centre per call, ask centre by centre
      try {
        const joined = await read(idsKey, code, '', from, to);
        const centres = new Set(joined.map((r) => String(r.vlccid)).filter(Boolean));
        if (joined.length === 0 || centres.size > 1) return joined;
      } catch {
        /* fall through to centre-by-centre */
      }
      const parts = await Promise.all(p.vlccIds.map((id) => read(id, code, id, from, to).catch(() => { incomplete = true; return [] as RawVlccRow[]; })));
      return parts.flat();
    })();
    // remember this window day by day, but only when it is complete and every row can be placed on a day of the window
    const byDay = new Map<string, RawVlccRow[]>(eachDay(from, to).map((d) => [d, []]));
    let placeable = true;
    for (const r of rows) {
      const bucket = byDay.get(isoOfTrdate(r.trdate));
      if (bucket) bucket.push(r);
      else placeable = false;
    }
    // a centre that did not answer was turned into an empty list above: an incomplete answer is never remembered
    if (placeable && !incomplete) dayCacheSet([...byDay].map(([d, list]) => [keyOf(code, d), list] as [string, unknown[]]));
    return rows;
  });
  return fanOut<RawVlccRow>([[...cachedJobs, ...jobs]], emit, true);
}
