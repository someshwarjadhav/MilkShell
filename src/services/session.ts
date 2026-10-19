import { ENV_MCC_ID, ENV_STATION_ID, ENV_VLCC_IDS } from './config';
import { GLOBALS } from '../lib/global';
import { VILLAGE_NAMES } from './vlcc/villages';

/** Ids that every SmartX call needs. Filled from the login response (AuthContext), never hardcoded. */
export interface SmartxSession {
  vlccIds: string[];
  vlccNames: Record<string, string>;
  stationId: string;
  mccId: string;
  token?: string;
  /** Cache namespace, so one user never sees another user's saved data. */
  scope: string;
}

export const splitIds = (v: unknown): string[] => {
  const parts = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  for (const p of parts) {
    if (typeof p !== 'string' && typeof p !== 'number') continue;
    for (const s of String(p).split(/[,;\s]+/)) if (s && !out.includes(s)) out.push(s);
  }
  return out;
};

let current: SmartxSession | null = null;

export function setSession(s: { vlccIds?: string[]; vlccNames?: Record<string, string>; stationId?: string; plantId?: string; mccId?: string; token?: string; email?: string } | null) {
  if (!s) {
    current = null;
    Object.assign(GLOBALS, { plantid: null, sessionid: null, customsessionid: null, mccid: null, centerdata: null, id: null });
    return;
  }
  const fromLogin = !!s.vlccIds?.length;
  const vlccIds = fromLogin ? s.vlccIds! : splitIds(ENV_VLCC_IDS);
  if (import.meta.env.DEV) {
    console.info('[smartx] VLC ids:', vlccIds, fromLogin ? '(from login)' : vlccIds.length ? '(from VITE_VLCC_IDS in .env.local)' : '(NONE: not in login response, VITE_VLCC_IDS empty or the dev server was not restarted)', '| station:', s.stationId || ENV_STATION_ID || '-', '| mcc used:', ENV_MCC_ID || vlccIds[0]?.slice(0, 3) || s.mccId || '-', s.mccId && s.mccId !== (ENV_MCC_ID || vlccIds[0]?.slice(0, 3)) ? `(login record says ${s.mccId}: ignored)` : '');
  }
  current = {
    vlccIds,
    vlccNames: { ...VILLAGE_NAMES, ...(s.vlccNames ?? {}) },
    // The portal sends every VLC id, comma separated, as `stationid`; mccid is the 3-digit prefix of the VLC ids (709).
    stationId: s.stationId || ENV_STATION_ID || vlccIds.join(','),
    // SmartX wants 709 = the 3-digit prefix of the VLC ids (7090801 -> 709), exactly what the SmartX portal itself sends.
    // The `mccid` in the MilkShell login record (e.g. 119) is a different id: sending it makes the server answer HTTP 500.
    mccId: ENV_MCC_ID || (vlccIds[0] ?? '').slice(0, 3) || s.mccId || '',
    token: s.token,
    scope: (s.email || 'user').toLowerCase(),
  };
  Object.assign(GLOBALS, {
    plantid: s.plantId || null,
    sessionid: vlccIds[0] ?? null,
    customsessionid: vlccIds.join(','),
    mccid: current.mccId || null,
    id: vlccIds[0] ?? null,
  });
}

export const getSession = () => current;
