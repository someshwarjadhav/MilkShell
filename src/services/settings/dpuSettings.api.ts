import { BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import { decryptPayload, encryptPayload } from '../../lib/crypto';
import { getSession } from '../session';
import { ApiError } from '../http/errors';
import { norm } from '../utils/loose';

const HOST = BASE_URL || 'https://smartx.shivinfotech.co.in';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

async function request(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, cache: 'no-store', headers: { Accept: 'application/json, text/plain, */*', ...((init.headers as Record<string, string>) ?? {}) }, signal: controller.signal });
    if (res.status === 401 || res.status === 403) throw new ApiError('Your session was rejected by the server. Please sign in again.', 'auth');
    const text = (await res.text()).replace(/[\r\n]+/g, ' ').trim();
    if (!res.ok) {
      const body = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      throw new ApiError(`The server answered with error ${res.status}${body ? `: ${body}` : '.'}`, 'server');
    }
    if (!text) return null;
    if (text.startsWith('<')) throw new ApiError('The server returned a web page instead of data.', 'parse');
    try {
      let json: unknown = JSON.parse(text);
      if (typeof json === 'string') {
        try { json = JSON.parse(json); } catch { }
      }
      return json;
    } catch {
      return text;
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (controller.signal.aborted) throw new ApiError(`The server took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds to answer.`, 'timeout');
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 'network');
  } finally {
    clearTimeout(timer);
  }
}

function assertSaved(reply: unknown) {
  if (!isObj(reply)) return;
  const message = String(reply.Message ?? reply.message ?? '').trim();
  const refused = (reply.Success ?? reply.success) === false && !/^(done|success|saved|ok|insert|record|data saved)/i.test(message);
  if (refused) throw new ApiError(message || 'The portal did not save the DPU settings.', 'server');
}

const get = (obj: Obj, ...keys: string[]): unknown => {
  const want = keys.map(norm);
  const k = Object.keys(obj).find((x) => want.includes(norm(x)));
  return k === undefined ? undefined : obj[k];
};

const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const t = String(v ?? '').trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'yes' || t === 'y';
};

function firstRecord(json: unknown): Obj | null {
  if (Array.isArray(json)) return json.find(isObj) ?? null;
  if (isObj(json)) {
    for (const k of ['Data', 'data', 'Result', 'result']) {
      const inner = json[k];
      if (Array.isArray(inner)) return inner.find(isObj) ?? null;
      if (isObj(inner)) return inner;
    }
    return json;
  }
  return null;
}


const GET_URL = (stationId: string) => `${HOST}/home/getdpusettings?stationid=${encodeURIComponent(stationId)}`;
const SAVE_URL = `${HOST}/home/savedpusettings`;


export const DPU_MILK_TYPES: Array<{ value: string; label: string }> = [
  { value: '1', label: 'Cow' },
  { value: '2', label: 'Buffalo' },
  { value: '3', label: 'Both' },
];

const milkOf = (v: unknown): string => {
  const t = String(v ?? '').trim().toUpperCase();
  return ({ C: '1', B: '2', Z: '3' } as Record<string, string>)[t] ?? (t || '1');
};
export const INTERVAL_COUNT = 10;

export interface DpuInterval { time: string; amount: string }

export interface DpuSettings {
  stationId: string;
  autoWeight: boolean;
  autoFat: boolean;
  autoShift: boolean;
  autoTear: boolean;
  realData: boolean;
  multiCol: boolean;
  dpuSeize: boolean;
  dpuSync: boolean;
  milkType: string;
  mStart: string;
  mEnd: string;
  eStart: string;
  eEnd: string;
  operatorPass: string;
  supervisorPass: string;
  adminPass: string;
  intervals: DpuInterval[];
}

export const emptyDpuSettings = (stationId = ''): DpuSettings => ({
  stationId, autoWeight: false, autoFat: false, autoShift: false, autoTear: false, realData: false, multiCol: false, dpuSeize: false, dpuSync: false,
  milkType: '1', mStart: '00:00', mEnd: '00:00', eStart: '00:00', eEnd: '00:00',
  operatorPass: '', supervisorPass: '', adminPass: '',
  intervals: Array.from({ length: INTERVAL_COUNT }, () => ({ time: '00:00', amount: '0' })),
});

const timeOf = (v: unknown): string => {
  const m = /(\d{1,2}):(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '00:00';
};
const pass = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(0, 4);
const amountOf = (v: unknown) => { const t = String(v ?? '').trim(); return t === '' || Number.isNaN(Number(t)) ? '0' : t; };

const authHeader = (): Record<string, string> => { const t = getSession()?.token; return t ? { Authorization: `Bearer ${t}` } : {}; };


function unpack(reply: unknown): unknown {
  if (typeof reply === 'string' && /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(reply.trim())) {
    try { return decryptPayload(reply.trim()); } catch { return reply; }
  }
  return reply;
}

export async function getDpuSettings(stationId: string): Promise<DpuSettings> {
  const rec = firstRecord(unpack(await request(GET_URL(stationId), { headers: authHeader() })));
  const out = emptyDpuSettings(stationId);
  if (!rec) return out;
  return {
    stationId,
    autoWeight: toBool(get(rec, 'AutoWeight')),
    autoFat: toBool(get(rec, 'AutoFat')),
    autoShift: toBool(get(rec, 'AutoShift')),
    autoTear: toBool(get(rec, 'AutoTear')),
    realData: toBool(get(rec, 'RealData')),
    multiCol: toBool(get(rec, 'MultiCol')),
    dpuSeize: toBool(get(rec, 'dpuseize')),
  
    dpuSync: toBool(get(rec, 'dpuseize')) || String(get(rec, 'DPUPass') ?? '').trim() === '1',
    milkType: milkOf(get(rec, 'MilkType')),
    mStart: timeOf(get(rec, 'MStartTime')),
    mEnd: timeOf(get(rec, 'MEndTime')),
    eStart: timeOf(get(rec, 'EStartTime')),
    eEnd: timeOf(get(rec, 'EEndTime')),
    operatorPass: pass(get(rec, 'p1')),
    supervisorPass: pass(get(rec, 'p2')),
    adminPass: pass(get(rec, 'p3')),
    intervals: out.intervals.map((_, i) => ({ time: timeOf(get(rec, `i${i + 1}`)), amount: amountOf(get(rec, `v${i + 1}`)) })),
  };
}

const flag = (b: boolean) => (b ? 1 : 0);

const nonce = (n = 15) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

export function buildDpuPayload(s: DpuSettings, entryDate: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    StationId: s.stationId,
    EntryDate: entryDate,
    AutoWeight: s.autoWeight,
    AutoFat: s.autoFat,
    AutoShift: s.autoShift,
    AutoTear: s.autoTear,
    RealData: s.realData,
    MultiCol: s.multiCol,
    DPUPass: s.dpuSync ? '1' : '0',
    MilkType: s.milkType || '0',
    MStartTime: s.mStart,
    MEndTime: s.mEnd,
    EStartTime: s.eStart,
    EEndTime: s.eEnd,
    datetime: entryDate,
    p1: s.operatorPass,
    p2: s.supervisorPass,
    p3: s.adminPass,
    p4: '0000',
  };
  s.intervals.forEach((row, i) => {
    payload[`i${i + 1}`] = row.time;
    payload[`v${i + 1}`] = i === INTERVAL_COUNT - 1 ? Number(row.amount || 0) : (row.amount === '' ? '0' : row.amount);
  });
  payload.encryptionkey = nonce();
  payload.dpuseize = flag(s.dpuSeize);
  return payload;
}

export async function saveDpuSettings(s: DpuSettings, entryDate: string): Promise<void> {
  let payload: string;
  try {
    payload = encryptPayload(buildDpuPayload(s, entryDate));
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'The settings could not be encrypted.', 'parse');
  }
  assertSaved(await request(SAVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ payload }),
  }));
}
