import { GLOBALS } from "../lib/global";
import {
  DATA_KEY,
  LOGIN_KEY,
  MENU_KEY,
  vaultClear,
  vaultLoad,
  vaultSave,
} from "../lib/vault";
import { mapLoginResponse, type LoginProfile } from "./auth/auth.api.ts";
import { getCenter, getDpuCenter, parseCenters } from "./center/center.api.ts";
import { parseMenu, getMenu, type MenuNode } from "./menu/menu.api.ts";
import {
  EMPTY_REPORT_CONFIG,
  getReportAccess,
  parseReportConfig,
  type ReportConfig,
} from "./report/report.api.ts";
import { setSession } from "./session";
import type { Center } from "./mappers/center.mapper.ts";

interface SessionData {
  centers: Center[];
  menu: MenuNode[];
  report: ReportConfig;
}
interface RawData {
  centers: unknown;
  menu: unknown;
  report: unknown;
}
interface StoredLogin {
  username: string;
  record: unknown;
}
interface StoredData {
  userId: string;
  raw: RawData;
}
interface StoredMenu {
  userId: string;
  raw: unknown;
}

const EMPTY: SessionData = {
  centers: [],
  menu: [],
  report: EMPTY_REPORT_CONFIG,
};
let data: SessionData = EMPTY;
let loaded = false;
let rawData: RawData | null = null;
let errors: Record<string, string> = {};

export const getCenters = (): Center[] => data.centers;
export const getMenuTree = (): MenuNode[] => data.menu;

const listeners = new Set<() => void>();
export const subscribeMenu = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};


function persist(userId: string, raw: RawData) {
  vaultSave(DATA_KEY, {
    userId,
    raw: { ...raw, menu: null },
  } satisfies StoredData);
  if (raw.menu !== null && raw.menu !== undefined)
    vaultSave(MENU_KEY, { userId, raw: raw.menu } satisfies StoredMenu);
}


export async function refreshMenu(userId: string): Promise<void> {
  try {
    const raw = await getMenu(userId);
    if (!rawData) return;
    rawData = { ...rawData, menu: raw };
    data = { ...data, menu: parseMenu(raw) };
    persist(userId, rawData);
    listeners.forEach((fn) => fn());
  } catch (e) {
    console.warn(
      "[getMenu] refresh failed, saved menu kept:",
      e instanceof Error ? e.message : e,
    );
  }
}


let menuTried = false;
export async function ensureMenu(userId: string): Promise<void> {
  if (
    menuTried ||
    !rawData ||
    (rawData.menu !== null && rawData.menu !== undefined)
  )
    return;
  menuTried = true;
  await refreshMenu(userId);
}
export const getReportConfig = (): ReportConfig => data.report;

export const getSessionErrors = () => errors;
export const getRawSessionData = (): RawData | null => rawData;
export const getSavedLoginRecord = (): unknown =>
  vaultLoad<StoredLogin>(LOGIN_KEY)?.record ?? null;
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
  for (const c of centers) if (c.stationId && c.stationId !== c.id) stationByVlcc[c.id] = c.stationId;
  Object.assign(stationByVlcc, profile.stationByVlcc ?? {});
  setSession({
    ...profile,
    vlccIds: centers.length ? centers.map((c) => c.id) : profile.vlccIds,
    vlccNames: names,
    stationByVlcc,
  });
  Object.assign(GLOBALS, {
    centerdata: centers,
    userid: profile.userId ?? null,
    stationid: profile.centerStationId ?? null,
  });
}

async function loadCenters(profile: LoginProfile): Promise<unknown> {
  const candidates = [
    profile.centerStationId,
    profile.vlccIds?.join(","),
    profile.mccId,
    profile.stationId,
  ]
    .map((x) => (x ?? "").trim())
    .filter((x, i, all) => x && all.indexOf(x) === i);
  if (!candidates.length) throw new Error("no station id in the login record");
  let answeredEmpty: unknown = null;
  let lastError: unknown;
  for (const id of candidates) {
    try {
      const reply = await getCenter(id);
      if (parseCenters(reply).length > 0) {
        return reply;
      }
      answeredEmpty = reply;
    } catch (e) {
      lastError = e;
    }
  }
  if (answeredEmpty !== null) return answeredEmpty;
  throw lastError ?? new Error("the portal returned no centres");
}

export async function loadSessionData(profile: LoginProfile): Promise<void> {
  const { userId, centerStationId } = profile;
  errors = {};
  const missing = (what: string) =>
    Promise.reject(new Error(`no ${what} in the login record`));
  const [c, m, r] = await Promise.allSettled([
    centerStationId || profile.vlccIds?.length
      ? loadCenters(profile)
      : missing("station id"),
    userId ? getMenu(userId) : missing("user id"),
    userId ? getReportAccess(userId) : missing("user id"),
  ]);
  const value = (res: PromiseSettledResult<unknown>, name: string) => {
    if (res.status === "fulfilled") return res.value;
    const why =
      res.reason instanceof Error ? res.reason.message : String(res.reason);
    errors[name] = why;
    return null;
  };
  const raw: RawData = {
    centers: value(c, "getCenter"),
    menu: value(m, "getMenu"),
    report: value(r, "getReportAccess"),
  };
  hydrate(raw);

  loaded = raw.centers !== null || !centerStationId;
  persist(userId ?? "", raw);
  menuTried = false;
}

export function saveLogin(username: string, record: unknown) {
  vaultSave(LOGIN_KEY, { username, record } satisfies StoredLogin);
}

export function restoreSession(): LoginProfile | null {
  const login = vaultLoad<StoredLogin>(LOGIN_KEY);
  if (!login || !("record" in login)) return null;
  let profile: LoginProfile;
  try {
    profile = mapLoginResponse(login.record, login.username || "");
  } catch {
    return null;
  }
  const saved = vaultLoad<StoredData>(DATA_KEY);
  if (saved && saved.userId === (profile.userId ?? "") && saved.raw) {
   
    const menu = vaultLoad<StoredMenu>(MENU_KEY);
    const raw =
      menu && menu.userId === (profile.userId ?? "") && menu.raw
        ? { ...saved.raw, menu: menu.raw }
        : saved.raw;
    hydrate(raw);
    loaded = raw.centers !== null || !profile.centerStationId;
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
  menuTried = false;
  vaultClear();
  Object.assign(GLOBALS, { userid: null, stationid: null });
}

export async function refreshSessionCenters(): Promise<void> {
  const record = getSavedLoginRecord();
  if (!record) return;
  let profile: LoginProfile;
  try {
    profile = mapLoginResponse(
      record,
      vaultLoad<StoredLogin>(LOGIN_KEY)?.username || "",
    );
  } catch {
    return;
  }
  const ids = [
    profile.centerStationId,
    profile.vlccIds?.join(","),
    profile.mccId,
    profile.stationId,
  ]
    .map((x) => (x ?? "").trim())
    .filter((x, i, all) => x && all.indexOf(x) === i);
  for (const id of ids) {
    try {
      const centers = await getDpuCenter(id);
      const parsed = parseCenters(centers);
      if (!parsed.length) continue;
      data = { ...data, centers: parsed };
      rawData = {
        ...(rawData ?? { centers: null, menu: null, report: null }),
        centers,
      };
      persist(profile.userId ?? "", rawData);
      applySession(profile);
      listeners.forEach((fn) => fn());
      return;
    } catch (e) {
      console.debug(
        "[vlc] centre refresh skipped:",
        e instanceof Error ? e.message : e,
      );
    }
  }
}