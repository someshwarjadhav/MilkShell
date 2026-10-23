import { GLOBALS } from '../lib/global';
import { DATA_KEY, LOGIN_KEY, vaultClear, vaultLoad, vaultSave } from '../lib/vault';
import { mapLoginResponse, type LoginProfile } from './auth/auth.api';
import { getCenter, parseCenters } from './center/center.api';
import { parseMenu, getMenu, type MenuNode } from './menu/menu.api';
import { EMPTY_REPORT_CONFIG, getReportAccess, parseReportConfig, type ReportConfig } from './report/report.api';
import { setSession } from './session';
import type { Center } from './mappers/center.mapper';


interface SessionData {
  centers: Center[];
  menu: MenuNode[];
  report: ReportConfig;
}
interface RawData { centers: unknown; menu: unknown; report: unknown }
interface StoredLogin { username: string; record: unknown }
interface StoredData { userId: string; raw: RawData }

const EMPTY: SessionData = { centers: [], menu: [], report: EMPTY_REPORT_CONFIG };
let data: SessionData = EMPTY;
let loaded = false;
let rawData: RawData | null = null;
let errors: Record<string, string> = {};

export const getCenters = (): Center[] => data.centers;
export const getMenuTree = (): MenuNode[] => data.menu;
export const getReportConfig = (): ReportConfig => data.report;

export const getSessionErrors = () => errors;
export const getRawSessionData = (): RawData | null => rawData;
export const getSavedLoginRecord = (): unknown => vaultLoad<StoredLogin>(LOGIN_KEY)?.record ?? null;
export const isSessionDataLoaded = () => loaded;

function hydrate(raw: RawData) {
  rawData = raw;
  data = {
    centers: raw.centers ? parseCenters(raw.centers) : [],
    menu: raw.menu ? parseMenu(raw.menu) : [],
    report: raw.report ? parseReportConfig(raw.report) : EMPTY_REPORT_CONFIG,
  };
}


export function applySession(profile: LoginProfile) {
  const centers = data.centers;
  const names: Record<string, string> = { ...(profile.vlccNames ?? {}) };
  for (const c of centers) if (c.name) names[c.id] = c.name;
  const stationByVlcc: Record<string, string> = {};
  for (const c of centers) if (c.stationId) stationByVlcc[c.id] = c.stationId;
  const stations = [...new Set(Object.values(stationByVlcc))];
  setSession({
    ...profile,
    vlccIds: centers.length ? centers.map((c) => c.id) : profile.vlccIds,
    vlccNames: names,
    stationByVlcc,
  });
  if (import.meta.env.DEV) {
    console.info('[getCenter] routes:', [...new Set(centers.map((c) => c.routeName || c.routeId).filter(Boolean))], '| station ids:', stations);
  }
  Object.assign(GLOBALS, { centerdata: centers, userid: profile.userId ?? null, stationid: profile.centerStationId ?? null });
}


async function loadCenters(profile: LoginProfile): Promise<unknown> {
  const candidates = [profile.centerStationId, profile.vlccIds?.join(','), profile.mccId, profile.stationId]
    .map((x) => (x ?? '').trim())
    .filter((x, i, all) => x && all.indexOf(x) === i);
  if (!candidates.length) throw new Error('no station id in the login record');
  let answeredEmpty: unknown = null;
  let lastError: unknown;
  for (const id of candidates) {
    try {
      const reply = await getCenter(id);
      if (parseCenters(reply).length > 0) {
        if (import.meta.env.DEV) console.info('[getCenter] centres found with id:', id);
        return reply;
      }
      answeredEmpty = reply;
    } catch (e) {
      lastError = e;
      if (import.meta.env.DEV) console.warn('[getCenter] id', id, 'failed:', e instanceof Error ? e.message : e);
    }
  }
  if (answeredEmpty !== null) return answeredEmpty;
  throw lastError ?? new Error('the portal returned no centres');
}

export async function loadSessionData(profile: LoginProfile): Promise<void> {
  const { userId, centerStationId } = profile;
  errors = {};
  const missing = (what: string) => Promise.reject(new Error(`no ${what} in the login record`));
  const [c, m, r] = await Promise.allSettled([
    centerStationId || profile.vlccIds?.length ? loadCenters(profile) : missing('station id'),
    userId ? getMenu(userId) : missing('user id'),
    userId ? getReportAccess(userId) : missing('user id'),
  ]);
  const value = (res: PromiseSettledResult<unknown>, name: string) => {
    if (res.status === 'fulfilled') return res.value;
    const why = res.reason instanceof Error ? res.reason.message : String(res.reason);
    errors[name] = why;
    console.warn(`[${name}] not loaded:`, why);
    return null;
  };
  const raw: RawData = { centers: value(c, 'getCenter'), menu: value(m, 'getMenu'), report: value(r, 'getReportAccess') };
  hydrate(raw);

  loaded = raw.centers !== null || !centerStationId;
  vaultSave(DATA_KEY, { userId: userId ?? '', raw } satisfies StoredData);

  if (import.meta.env.DEV) {
    console.info('[bootstrap] user id:', userId ?? '(NOT FOUND in login record)', '| station id:', centerStationId ?? '(NOT FOUND in login record)');
    console.info('[getCenter] centres:', data.centers.length, '| first raw row:', data.centers[0]?.raw ?? raw.centers);
    console.info('[getMenu] top level entries:', data.menu.map((n) => n.title || n.url), '| raw:', raw.menu);
    console.info('[getReportAccess] rules:', [...data.report.rules].map(([k, v]) => ({ report: k || '(all)', hidden: [...v.hidden], shown: [...v.shown] })), '| raw:', raw.report);
  }
}

export function saveLogin(username: string, record: unknown) {
  vaultSave(LOGIN_KEY, { username, record } satisfies StoredLogin);
}


export function restoreSession(): LoginProfile | null {
  const login = vaultLoad<StoredLogin>(LOGIN_KEY);
  if (!login || !('record' in login)) return null;
  let profile: LoginProfile;
  try {
    profile = mapLoginResponse(login.record, login.username || '');
  } catch {
    return null;
  }
  const saved = vaultLoad<StoredData>(DATA_KEY);
  if (saved && saved.userId === (profile.userId ?? '') && saved.raw) {
    hydrate(saved.raw);
    loaded = saved.raw.centers !== null || !profile.centerStationId;
  } else {
    data = EMPTY;
    loaded = false;
    rawData = null;
  }
  applySession(profile);
  return profile;
}

export function clearSessionData() {
  data = EMPTY;
  loaded = false;
  rawData = null;
  vaultClear();
  Object.assign(GLOBALS, { userid: null, stationid: null });
}
