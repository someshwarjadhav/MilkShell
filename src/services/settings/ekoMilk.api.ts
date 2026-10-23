import { BASE_URL, REQUEST_TIMEOUT_MS, STIPL_BASE } from '../config';
import { getSession } from '../session';
import { ApiError } from '../http/errors';
import { norm } from '../utils/loose';


const HOST = BASE_URL || 'https://smartx.shivinfotech.co.in';

const STATIC = STIPL_BASE;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const authHeader = (): Record<string, string> => { const t = getSession()?.token; return t ? { Authorization: `Bearer ${t}` } : {}; };

async function request(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, cache: 'no-store', headers: { Accept: 'application/json, text/plain, */*', ...authHeader(), ...((init.headers as Record<string, string>) ?? {}) }, signal: controller.signal });
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
      if (typeof json === 'string') { try { json = JSON.parse(json); } catch { } }
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

function assertOk(reply: unknown, fallback: string) {
  if (!isObj(reply)) return;
  const message = String(reply.Message ?? reply.message ?? '').trim();
  const refused = (reply.Success ?? reply.success) === false && !/^(done|success|saved|ok|insert|record|data saved|update)/i.test(message);
  if (refused) throw new ApiError(message || fallback, 'server');
}

const get = (obj: Obj, ...keys: string[]): unknown => {
  const want = keys.map(norm);
  const k = Object.keys(obj).find((x) => want.includes(norm(x)));
  return k === undefined ? undefined : obj[k];
};
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

function recordsOf(json: unknown): Obj[] {
  if (Array.isArray(json)) return json.filter(isObj);
  if (isObj(json)) {
    for (const k of ['Data', 'data', 'Result', 'result']) {
      const inner = json[k];
      if (Array.isArray(inner)) return inner.filter(isObj);
      if (isObj(inner)) return [inner];
    }
  }
  return [];
}

const form = (data: Obj) => {
  const p = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => p.append(k, String(v ?? '')));
  return p.toString();
};



export interface Quality6 { cowFat: string; cowSnf: string; buffFat: string; buffSnf: string; mixFat: string; mixSnf: string }
export const emptyQuality = (): Quality6 => ({ cowFat: '', cowSnf: '', buffFat: '', buffSnf: '', mixFat: '', mixSnf: '' });
export const QUALITY_FIELDS: Array<[keyof Quality6, string]> = [
  ['cowFat', 'Cow Fat'], ['cowSnf', 'Cow SNF'], ['buffFat', 'Buff Fat'], ['buffSnf', 'Buff SNF'], ['mixFat', 'MIX Fat'], ['mixSnf', 'MIX SNF'],
];

const num2 = (v: unknown) => { const n = Number(str(v)); return str(v) === '' || Number.isNaN(n) ? '' : n.toFixed(2); };


export async function getVlcQuality(stationId: string, shift: string): Promise<Quality6> {
  const rec = recordsOf(await request(`${STATIC}/home/collectionbulkquality?stationid=${encodeURIComponent(stationId)}&shift=${encodeURIComponent(shift)}`))[0];
  if (!rec) return emptyQuality();
  return {
    cowFat: num2(get(rec, 'CowFat', 'CFat', 'FatCow')), cowSnf: num2(get(rec, 'CowSnf', 'CSnf', 'SnfCow')),
    buffFat: num2(get(rec, 'BuffFat', 'BuffaloFat', 'BFat', 'FatBuff')), buffSnf: num2(get(rec, 'BuffSnf', 'BuffaloSnf', 'BSnf', 'SnfBuff')),
    mixFat: num2(get(rec, 'MixFat', 'MFat', 'FatMix')), mixSnf: num2(get(rec, 'MixSnf', 'MSnf', 'SnfMix')),
  };
}


const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();


const statusOf = (r: Obj): string => cap(str(get(r, 'Flag', 'IsActive', 'Status'))) || '-';


const clock = (v: string): string => {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v.trim());
  if (!m) return v;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};


function appliedOf(r: Obj): [string, string] {
  const [d, t] = splitStamp(get(r, 'AppliedDateTime'));
  return [d || dateOnly(get(r, 'ApplyDate', 'AppliedDate')), clock(t || str(get(r, 'ApplyTime', 'AppliedTime')))];
}

const debugFirst = (name: string, rows: Obj[]) => {
  if (import.meta.env.DEV && rows[0]) console.info(`[eko] ${name} - first record keys:`, rows[0]);
};


export interface CorrectionRow {
  id: string; entryDate: string; stationId: string;
  cowFat: string; cowSnf: string; buffFat: string; buffSnf: string; mixFat: string; mixSnf: string;
  status: string; appliedDate: string; appliedTime: string;
}

const splitStamp = (v: unknown): [string, string] => {
  const t = str(v);
  if (!t) return ['', ''];
  const [d, ...rest] = t.split(/\s+/);
  return [d, rest.join(' ')];
};
const dateOnly = (v: unknown) => str(v).split(/\s+/)[0];

export async function getEkoCorrections(stationId: string): Promise<CorrectionRow[]> {
  const rows = recordsOf(await request(`${HOST}/home/GetEkoCorrectionRecords?stationid=${encodeURIComponent(stationId)}`));
  debugFirst('GetEkoCorrectionRecords', rows);
  return rows.map((r) => {
    const [ad, at] = appliedOf(r);
    return {
      id: str(get(r, 'RecordId')), entryDate: dateOnly(get(r, 'EntryDate')), stationId: str(get(r, 'StationId')),
      cowFat: str(get(r, 'FatCC')), cowSnf: str(get(r, 'SNFCC')), buffFat: str(get(r, 'FATBC')), buffSnf: str(get(r, 'SNFBC')),
      mixFat: str(get(r, 'FATMC')), mixSnf: str(get(r, 'SNFMC')),
      status: statusOf(r), appliedDate: ad, appliedTime: at,
    };
  });
}

export interface CorrectionInput { stationId: string; entryDate: string; shift: string; vlc: Quality6; doc: Quality6; diff: Quality6 }

export async function saveEkoCorrection(c: CorrectionInput): Promise<void> {
  const body = form({
    StationId: c.stationId, EntryDate: c.entryDate, Shift: c.shift,
    FatCC: c.diff.cowFat, SNFCC: c.diff.cowSnf, FATBC: c.diff.buffFat, FATMC: c.diff.mixFat, SNFBC: c.diff.buffSnf, SNFMC: c.diff.mixSnf,
    VlcCowFat: c.vlc.cowFat, VlcCowSnf: c.vlc.cowSnf, VlcBuffFat: c.vlc.buffFat, VlcBuffSnf: c.vlc.buffSnf, VlcMixFat: c.vlc.mixFat, VlcMixSnf: c.vlc.mixSnf,
    DocCowFat: c.doc.cowFat, DocCowSnf: c.doc.cowSnf, DocBuffFat: c.doc.buffFat, DocBuffSnf: c.doc.buffSnf, DocMixFat: c.doc.mixFat, DocMixSnf: c.doc.mixSnf,
  });
  assertOk(await request(`${HOST}/home/settingscorrection`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }), 'The portal did not save the Eko calibration.');
}

export async function updateEkoCorrectionFlag(stationId: string, recordId: string, flag: string): Promise<void> {
  assertOk(await request(`${HOST}/api/analyzer/UpdateEkoCorrectionFlag?stationid=${encodeURIComponent(stationId)}&recordid=${encodeURIComponent(recordId)}&flag=${encodeURIComponent(flag)}`), 'The record could not be updated.');
}



export interface Sample3 { fat: string; snf: string; clr: string }
export interface ControlSampleInput { stationId: string; entryDate: string; cow: Sample3; buff: Sample3; mix: Sample3 }
export const emptySample = (): Sample3 => ({ fat: '', snf: '', clr: '' });

export interface ControlRow {
  id: string; entryDate: string; stationId: string;
  cowFat: string; cowSnf: string; buffFat: string; buffSnf: string; mixFat: string; mixSnf: string;

  prev: Quality6; next: Quality6;
  status: string; appliedDate: string; appliedTime: string;
}

const lineOf = (r: Obj, prefix: string): Quality6 => {
  const pick = (name: string) => str(get(r, `${prefix}${name}`, `${name}${prefix}`));
  return { cowFat: pick('CowFat'), cowSnf: pick('CowSnf'), buffFat: pick('BuffFat'), buffSnf: pick('BuffSnf'), mixFat: pick('MixFat'), mixSnf: pick('MixSnf') };
};

export async function getControlSamples(stationId: string): Promise<ControlRow[]> {
  const rows = recordsOf(await request(`${HOST}/home/GetCorrectorRecords?stationid=${encodeURIComponent(stationId)}`));
  debugFirst('GetCorrectorRecords', rows);
  return rows.map((r) => {
    const [ad, at] = appliedOf(r);
    return {
      id: str(get(r, 'RecordId')), entryDate: dateOnly(get(r, 'EntryDate')), stationId: str(get(r, 'StationId')),
      cowFat: str(get(r, 'CowFat')), cowSnf: str(get(r, 'CowSnf')),
      buffFat: str(get(r, 'BuffFat', 'BuffaloFat')), buffSnf: str(get(r, 'BuffSnf', 'BuffaloSnf')),
      mixFat: str(get(r, 'MixFat')), mixSnf: str(get(r, 'MixSnf')),
      prev: lineOf(r, 'Prev'), next: lineOf(r, 'New'),
      status: statusOf(r), appliedDate: ad, appliedTime: at,
    };
  });
}


export async function saveControlSample(c: ControlSampleInput): Promise<void> {
  const body = form({
    StationId: c.stationId, EntryDate: c.entryDate,
    CowFat: c.cow.fat, CowSnf: c.cow.snf, CowClr: c.cow.clr,
    BuffFat: c.buff.fat, BuffSnf: c.buff.snf, BuffClr: c.buff.clr,
    MixFat: c.mix.fat, MixSnf: c.mix.snf, MixClr: c.mix.clr,
  });
  assertOk(await request(`${HOST}/home/correctorsample`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }), 'The portal did not save the control sample.');
}

export async function updateCorrectorFlag(stationId: string, recordId: string, flag: string): Promise<void> {
  assertOk(await request(`${HOST}/api/analyzer/UpdateCorrectorFlag?stationid=${encodeURIComponent(stationId)}&recordid=${encodeURIComponent(recordId)}&flag=${encodeURIComponent(flag)}`, { method: 'POST' }), 'The record could not be updated.');
}



export interface EkoCredentials { villageId: string; contact: string; pcbSerial: string; currentPass: string; newPass: string; passFlag: string; name: string }
export const emptyCredentials = (): EkoCredentials => ({ villageId: '', contact: '', pcbSerial: '', currentPass: '', newPass: '', passFlag: '0', name: '' });

export async function getEkoCredentials(villageId: string): Promise<EkoCredentials> {
  const rec = recordsOf(await request(`${STATIC}/home/getVillageId?villageid=${encodeURIComponent(villageId)}`))[0];
  if (!rec) return { ...emptyCredentials(), villageId };
  return {
    villageId, name: str(get(rec, 'villagename')),
    contact: str(get(rec, 'villageagentcontact')), pcbSerial: str(get(rec, 'pcbsrno')),
    currentPass: str(get(rec, 'euppass')), newPass: str(get(rec, 'ekonewpass')), passFlag: str(get(rec, 'ekopassflag')) || '0',
  };
}

export async function updateEkoPassword(c: { villageId: string; currentPass: string; newPass: string }): Promise<void> {
  assertOk(await request(`${STATIC}/home/updateEkoPassword`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ villageid: c.villageId, euppass: c.currentPass, ekonewpass: c.newPass, ekopassflag: '1' }),
  }), 'The Eko password could not be updated.');
}
