import { ENV_MCC_ID, ENV_STATION_ID, ENV_VLCC_IDS } from './config';
import { GLOBALS } from '../lib/global';
import { VILLAGE_NAMES } from './vlcc/villages';

export interface SmartxSession {
  vlccIds: string[];
  vlccNames: Record<string, string>;
  stationId: string;
  mccId: string;
  mccName: string;
  mccLoginId: string;
  stationByVlcc: Record<string, string>;
  token?: string;
 
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

export function setSession(s: { vlccIds?: string[]; vlccNames?: Record<string, string>; stationId?: string; plantId?: string; mccId?: string; mccName?: string; stationByVlcc?: Record<string, string>; token?: string; email?: string } | null) {
  if (!s) {
    current = null;
    Object.assign(GLOBALS, { plantid: null, sessionid: null, customsessionid: null, mccid: null, mccname: null, mccLoginId: null, centerdata: null, id: null });
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

    stationId: s.stationId || ENV_STATION_ID || vlccIds.join(','),

    mccId: (fromLogin ? '' : ENV_MCC_ID) || (vlccIds[0] ?? '').slice(0, 3) || s.mccId || '',
    mccName: s.mccName ?? '',
    mccLoginId: s.mccId ?? '',
    stationByVlcc: s.stationByVlcc ?? {},
    token: s.token,
    scope: (s.email || 'user').toLowerCase(),
  };
  Object.assign(GLOBALS, {
    plantid: s.plantId || null,
    sessionid: vlccIds[0] ?? null,
    customsessionid: vlccIds.join(','),
    mccid: current.mccId || null,
    mccname: s.mccName || null,
    mccLoginId: s.mccId || null,
    id: vlccIds[0] ?? null,
  });
}

export const getSession = () => current;

export function stationFor(ids: string[]): string {
  const s = current;
  if (!s) return '';
  const own = [...new Set(ids.map((id) => s.stationByVlcc[id]).filter(Boolean))];
  return own.length ? own.join(',') : s.stationId;
}
