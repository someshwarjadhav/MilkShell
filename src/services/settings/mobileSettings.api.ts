import { BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import { ApiError } from '../http/errors';
import { norm } from '../utils/loose';


const HOST = BASE_URL || 'https://smartx.shivinfotech.co.in';
const GATEWAY = `${HOST}/gateway/Interceptor?path=`;

const ANALYZER = `${HOST}/api/analyzer`;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

async function request(url: string, init: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    if (controller.signal.aborted) throw new ApiError(`The server took longer than ${timeoutMs / 1000} seconds to answer.`, 'timeout');
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 'network');
  } finally {
    clearTimeout(timer);
  }
}


function assertSaved(reply: unknown) {
  if (!isObj(reply)) return;
  const message = String(reply.Message ?? reply.message ?? '').trim();
  const refused = (reply.Success ?? reply.success) === false && !/^(done|success|saved|ok|insert|record|data saved)/i.test(message);
  if (refused) throw new ApiError(message || 'The portal did not save the settings.', 'server');
}

const get = (obj: Obj, ...keys: string[]): unknown => {
  const want = keys.map(norm);
  const k = Object.keys(obj).find((x) => want.includes(norm(x)));
  return k === undefined ? undefined : obj[k];
};

export const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
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

function recordsOf(json: unknown): Obj[] {
  if (Array.isArray(json)) return json.filter(isObj);
  if (isObj(json)) {
    for (const k of ['Data', 'data', 'Result', 'result']) {
      if (Array.isArray(json[k])) return (json[k] as unknown[]).filter(isObj);
    }
  }
  return [];
}



export interface MobileAppSettings {
  stationId: string;
  settingOn: boolean;
  autoWeight: boolean;
  autoFat: boolean;
  autoShift: boolean;
  autoTear: boolean;
  autoClr: boolean;
  realData: boolean;
  remoteDisplay: boolean;
  receipt: boolean;
  multiCollection: boolean;
  anyRate: boolean;
  rateSync: boolean;
  salesSync: boolean;
  appPass: string;
  morShiftEnd: string;
  eveShiftEnd: string;
}

const flag = (b: boolean) => (b ? 1 : 0);


export const buildSettingsPayload = (s: MobileAppSettings) => ({
  AutoWeight: flag(s.autoWeight),
  AutoFat: flag(s.autoFat),
  AutoShift: flag(s.autoShift),
  AutoTear: flag(s.autoTear),
  AutoClr: flag(s.autoClr),
  RealData: flag(s.realData),
  RDisplay: flag(s.remoteDisplay),
  Receipt: flag(s.receipt),
  MultiCol: flag(s.multiCollection),
  AnyRate: flag(s.anyRate),
  RateSync: flag(s.rateSync),
  SalesSync: flag(s.salesSync),
  AppPass: s.appPass,
  MorShiftEnd: s.morShiftEnd,
  EveShiftEnd: s.eveShiftEnd,
  StationId: s.stationId,
  Level: '0',
  SettingOn: flag(s.settingOn),
  txtfatcc: '',
  txtsnfcc: '',
  txtfatbc: '',
  txtsnfbc: '',
  txtmixfat: '',
  txtmixsnf: '',
  txtcfatcc: '',
  txtcsnfcc: '',
  txtcfatbc: '',
  txtcsnfbc: '',
  txtcmixfat: '',
  txtcmixsnf: '',
});


const GET_TIMEOUT_MS = 20000;

const timeOf = (v: unknown, fallback: string): string => {
  const m = /(\d{1,2}):(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : fallback;
};

function toSettings(stationId: string, rec: Obj): MobileAppSettings | null {
  if (get(rec, 'AutoWeight') === undefined && get(rec, 'AutoFat') === undefined) return null; 
  return {
    stationId,
    settingOn: toBool(get(rec, 'SettingOn', 'ServerSetting')),
    autoWeight: toBool(get(rec, 'AutoWeight')),
    autoFat: toBool(get(rec, 'AutoFat')),
    autoShift: toBool(get(rec, 'AutoShift')),
    autoTear: toBool(get(rec, 'Tear', 'AutoTear')),
    autoClr: toBool(get(rec, 'Clr', 'AutoClr')),
    realData: toBool(get(rec, 'RealData')),
    remoteDisplay: toBool(get(rec, 'RmtDisply', 'RDisplay', 'RemoteDisplay')),
    receipt: toBool(get(rec, 'Receipt')),
    multiCollection: toBool(get(rec, 'MltColl', 'MultiCol', 'MultiCollection')),
    anyRate: toBool(get(rec, 'AnyRate')),
    rateSync: toBool(get(rec, 'RateSync')),
    salesSync: toBool(get(rec, 'SalesSync')),
    appPass: String(get(rec, 'AdPass', 'AppPass', 'AppPassword') ?? '').replace(/\D/g, '').slice(0, 4),
    morShiftEnd: timeOf(get(rec, 'MorShiftEnd', 'MShiftEnd'), '00:00'),
    eveShiftEnd: timeOf(get(rec, 'EveShiftEnd', 'EShiftEnd'), '00:00'),
  };
}


const buildFetchPayload = (stationId: string) => ({
  AutoWeight: 0, AutoFat: 0, AutoShift: 0, AutoTear: 0, AutoClr: 0, RealData: 0, RDisplay: 0, Receipt: 0, MultiCol: 0,
  AnyRate: 0, RateSync: 0, SalesSync: 0, AppPass: '', StationId: stationId, Level: '1', SettingOn: 0,
  txtfatcc: '', txtsnfcc: '', txtfatbc: '', txtsnfbc: '', txtmixfat: '', txtmixsnf: '',
  txtcfatcc: '', txtcsnfcc: '', txtcfatbc: '', txtcsnfbc: '', txtcmixfat: '', txtcmixsnf: '',
});


export async function getMobileSettings(stationId: string): Promise<MobileAppSettings | null> {
  const body = new FormData();
  body.append('data', JSON.stringify(buildFetchPayload(stationId)));
  const rec = firstRecord(await request(`${GATEWAY}/dairy/dairy/settingUpdateWeb/`, { method: 'POST', body }, GET_TIMEOUT_MS));
  return rec ? toSettings(stationId, rec) : null;
}

export async function saveMobileSettings(s: MobileAppSettings): Promise<void> {
  const body = new FormData();
  body.append('data', JSON.stringify(buildSettingsPayload(s)));
  assertSaved(await request(`${GATEWAY}/dairy/dairy/settingUpdateWeb/`, { method: 'POST', body }));
}



export const MENU_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'Collection', label: 'Collection' },
  { key: 'Datatransfer', label: 'Data Transfer' },
  { key: 'Totalcollection', label: 'Total Collection' },
  { key: 'Reports', label: 'Reports' },
  { key: 'Details', label: 'Details' },
  { key: 'Setting', label: 'Settings' },
  { key: 'Accountmaster', label: 'Account Master' },
  { key: 'Branchmaster', label: 'Branch Master' },
  { key: 'Ratechart', label: 'Rate Chart' },
  { key: 'Payment', label: 'Payment/Receipt' },
  { key: 'Purchase', label: 'Purchase Sales' },
  { key: 'Deduction', label: 'Deduction' },
  { key: 'Dispatch', label: 'Dispatch' },
  { key: 'Billprocess', label: 'Bill Process' },
];

const MENU_HIDDEN = ['ShiftLock'];

export type MenuValues = Record<string, boolean>;

export async function getMenuSettings(villageId: string): Promise<MenuValues> {
  const rec = firstRecord(await request(`${ANALYZER}/GetMyDairyMenu?flag=0&villageid=${encodeURIComponent(villageId)}&test=0`));
  const out: MenuValues = {};
  for (const k of [...MENU_ITEMS.map((m) => m.key), ...MENU_HIDDEN]) out[k] = rec ? toBool(get(rec, k)) : false;
  return out;
}

const tf = (b: boolean) => (b ? 'True' : 'False');


export const buildMenuPayload = (villageId: string, entryDate: string, v: MenuValues) => ({
  VillageId: villageId,
  EntryDate: entryDate,
  ...Object.fromEntries([...MENU_ITEMS.map((m) => m.key), ...MENU_HIDDEN].map((k) => [k, tf(!!v[k])])),
});

export async function saveMenuSettings(villageId: string, entryDate: string, v: MenuValues): Promise<void> {
  assertSaved(
    await request(`${ANALYZER}/MyDairyMenu?flag=0`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildMenuPayload(villageId, entryDate, v)),
    }),
  );
}



export const ACCESS_FORMS: Array<{ id: number; name: string }> = [
  { id: 1, name: 'Collection' },
  { id: 2, name: 'Account Master' },
  { id: 3, name: 'Branch Master' },
  { id: 4, name: 'Purchase' },
  { id: 5, name: 'Sales' },
];

export interface AccessRights { add: boolean; modify: boolean; del: boolean }
export type AccessValues = Record<number, AccessRights>;

export const emptyAccess = (): AccessValues => Object.fromEntries(ACCESS_FORMS.map((f) => [f.id, { add: false, modify: false, del: false }]));

export async function getUserAccess(villageId: string): Promise<AccessValues> {
  const rows = recordsOf(await request(`${ANALYZER}/GetUserAccess?villageid=${encodeURIComponent(villageId)}&flag=0&status=0`));
  const out = emptyAccess();
  for (const r of rows) {
    const id = Number(get(r, 'MenuId'));
    const byName = ACCESS_FORMS.find((f) => norm(f.name) === norm(String(get(r, 'MenuItem') ?? '')));
    const key = Number.isFinite(id) && out[id] ? id : byName?.id;
    if (key === undefined) continue;
    out[key] = { add: toBool(get(r, 'CanAdd')), modify: toBool(get(r, 'CanModify')), del: toBool(get(r, 'CanDelete')) };
  }
  return out;
}

export const buildAccessPayload = (villageId: string, v: AccessValues) =>
  ACCESS_FORMS.map((f) => ({
    VillageId: Number(villageId),
    MenuId: f.id,
    MenuItem: f.name,
    CanAdd: !!v[f.id]?.add,
    CanModify: !!v[f.id]?.modify,
    CanDelete: !!v[f.id]?.del,
  }));

export async function saveUserAccess(villageId: string, v: AccessValues): Promise<void> {
  assertSaved(
    await request(`${ANALYZER}/MyDairyUserAccess?status=0&flag=0`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildAccessPayload(villageId, v)),
    }),
  );
}