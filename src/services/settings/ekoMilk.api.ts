import { BASE_URL, REQUEST_TIMEOUT_MS, STIPL_BASE } from "../config";
import { getSession } from "../session";
import { ApiError } from "../http/errors";
import { norm } from "../utils/loose";
import { encryptPayload } from "../../lib/crypto";

const HOST = BASE_URL || "https://smartx.shivinfotech.co.in";

const STATIC = STIPL_BASE;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const authHeader = (): Record<string, string> => {
  const t = getSession()?.token;
  return t ? { Authorization: `Bearer ${t}` } : {};
};

async function request(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json, text/plain, */*",
        ...authHeader(),
        ...((init.headers as Record<string, string>) ?? {}),
      },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403)
      throw new ApiError(
        "Your session was rejected by the server. Please sign in again.",
        "auth",
      );
    const text = (await res.text()).replace(/[\r\n]+/g, " ").trim();
    if (!res.ok) {
      const body = text
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
      throw new ApiError(
        `The server answered with error ${res.status}${body ? `: ${body}` : "."}`,
        "server",
      );
    }
    if (!text) return null;
    if (text.startsWith("<"))
      throw new ApiError(
        "The server returned a web page instead of data.",
        "parse",
      );
    try {
      let json: unknown = JSON.parse(text);
      if (typeof json === "string") {
        try {
          json = JSON.parse(json);
        } catch {}
      }
      return json;
    } catch {
      return text;
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (controller.signal.aborted)
      throw new ApiError(
        `The server took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds to answer.`,
        "timeout",
      );
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      "network",
    );
  } finally {
    clearTimeout(timer);
  }
}

function assertOk(reply: unknown, fallback: string) {
  if (!isObj(reply)) return;
  const message = String(reply.Message ?? reply.message ?? "").trim();
  const refused =
    (reply.Success ?? reply.success) === false &&
    !/^(done|success|saved|ok|insert|record|data saved|update)/i.test(message);
  if (refused) throw new ApiError(message || fallback, "server");
}

const get = (obj: Obj, ...keys: string[]): unknown => {
  const want = keys.map(norm);
  const k = Object.keys(obj).find((x) => want.includes(norm(x)));
  return k === undefined ? undefined : obj[k];
};
const str = (v: unknown) =>
  v === undefined || v === null ? "" : String(v).trim();

function recordsOf(json: unknown): Obj[] {
  if (Array.isArray(json)) return json.filter(isObj);
  if (isObj(json)) {
    for (const k of ["Data", "data", "Result", "result"]) {
      const inner = json[k];
      if (Array.isArray(inner)) return inner.filter(isObj);
      if (isObj(inner)) return [inner];
    }
  }
  return [];
}

const sealed = (data: Obj): string => {
  try {
    return encryptPayload(data);
  } catch (e) {
    throw new ApiError(
      e instanceof Error ? e.message : "The request could not be encrypted.",
      "parse",
    );
  }
};
const postSealed = (url: string, data: Obj) =>
  request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: sealed(data) }),
  });

const n0 = (v: string): number => {
  const n = Number(v);
  return v === "" || Number.isNaN(n) ? 0 : n;
};

const nOrBlank = (v: string): number | "" => {
  const n = Number(v);
  return v === "" || Number.isNaN(n) ? "" : n;
};

export interface Quality6 {
  cowFat: string;
  cowSnf: string;
  buffFat: string;
  buffSnf: string;
  mixFat: string;
  mixSnf: string;
}
export const emptyQuality = (): Quality6 => ({
  cowFat: "",
  cowSnf: "",
  buffFat: "",
  buffSnf: "",
  mixFat: "",
  mixSnf: "",
});
export const QUALITY_FIELDS: Array<[keyof Quality6, string]> = [
  ["cowFat", "Cow Fat"],
  ["cowSnf", "Cow SNF"],
  ["buffFat", "Buff Fat"],
  ["buffSnf", "Buff SNF"],
  ["mixFat", "MIX Fat"],
  ["mixSnf", "MIX SNF"],
];

const num2 = (v: unknown) => {
  const n = Number(str(v));
  return str(v) === "" || Number.isNaN(n) ? "" : n.toFixed(2);
};

const VLC_ARRAY = "collectionvillage";
const DOC_ARRAY = "collectionfarmer";

const NAMES: Record<keyof Quality6, string[]> = {
  cowFat: ["CowFat", "CFat", "FatCow", "FatCC"],
  cowSnf: ["CowSnf", "CSnf", "SnfCow", "SNFCC"],
  buffFat: ["BuffFat", "BuffaloFat", "BFat", "FatBuff", "FATBC"],
  buffSnf: ["BuffSnf", "BuffaloSnf", "BSnf", "SnfBuff", "SNFBC"],
  mixFat: ["MixFat", "MFat", "FatMix", "FATMC"],
  mixSnf: ["MixSnf", "MSnf", "SnfMix", "SNFMC"],
};
const MILK_OF: Record<string, "cow" | "buff" | "mix"> = {
  c: "cow",
  cow: "cow",
  b: "buff",
  buff: "buff",
  buffalo: "buff",
  m: "mix",
  mix: "mix",
  "mix milk": "mix",
};

function qualityFrom(rows: Obj[]): Quality6 {
  const out = emptyQuality();
  const named = rows[0];
  if (named) {
    (Object.keys(NAMES) as Array<keyof Quality6>).forEach((k) => {
      out[k] = num2(get(named, ...NAMES[k]));
    });
  }
  if (QUALITY_FIELDS.every(([k]) => out[k] === "")) {
    for (const r of rows) {
      const kind =
        MILK_OF[
          str(get(r, "MilkType", "Milk", "Type", "MilkCode")).toLowerCase()
        ];
      if (!kind) continue;
      out[`${kind}Fat` as keyof Quality6] = num2(
        get(r, "Fat", "AvgFat", "FatAvg"),
      );
      out[`${kind}Snf` as keyof Quality6] = num2(
        get(r, "Snf", "AvgSnf", "SnfAvg"),
      );
    }
  }
  QUALITY_FIELDS.forEach(([k]) => {
    if (out[k] === "") out[k] = "0.00";
  });
  return out;
}

const listOf = (json: unknown, key: string): Obj[] => {
  if (!isObj(json)) return [];
  const k = Object.keys(json).find((x) => norm(x) === norm(key));
  const v = k === undefined ? undefined : json[k];
  return Array.isArray(v) ? v.filter(isObj) : [];
};

export async function getQualityPair(
  stationId: string,
  shift: string,
): Promise<{ vlc: Quality6; doc: Quality6 }> {
  const json = await request(
    `${STATIC}/home/collectionbulkquality?stationid=${encodeURIComponent(stationId)}&shift=${encodeURIComponent(shift)}`,
  );
  debugFirst("collectionbulkquality", [
    ...listOf(json, VLC_ARRAY),
    ...listOf(json, DOC_ARRAY),
  ]);
  return {
    vlc: qualityFrom(listOf(json, VLC_ARRAY)),
    doc: qualityFrom(listOf(json, DOC_ARRAY)),
  };
}

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

const statusOf = (r: Obj): string =>
  cap(str(get(r, "Flag", "IsActive", "Status"))) || "-";

const clock = (v: string): string => {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v.trim());
  if (!m) return v;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
};

function appliedOf(r: Obj): [string, string] {
  const [d, t] = splitStamp(get(r, "AppliedDateTime"));
  return [
    d || dateOnly(get(r, "ApplyDate", "AppliedDate")),
    clock(t || str(get(r, "ApplyTime", "AppliedTime"))),
  ];
}

const debugFirst = (name: string, rows: Obj[]) => {
  if (import.meta.env.DEV && rows[0])
    console.info(`[eko] ${name} - first record keys:`, rows[0]);
};

export interface CorrectionRow {
  id: string;
  entryDate: string;
  stationId: string;
  cowFat: string;
  cowSnf: string;
  buffFat: string;
  buffSnf: string;
  mixFat: string;
  mixSnf: string;
  status: string;
  appliedDate: string;
  appliedTime: string;
}

const splitStamp = (v: unknown): [string, string] => {
  const t = str(v);
  if (!t) return ["", ""];
  const [d, ...rest] = t.split(/\s+/);
  return [d, rest.join(" ")];
};
const dateOnly = (v: unknown) => str(v).split(/\s+/)[0];

export async function getEkoCorrections(
  stationId: string,
): Promise<CorrectionRow[]> {
  const rows = recordsOf(
    await request(
      `${HOST}/home/GetEkoCorrectionRecords?stationid=${encodeURIComponent(stationId)}`,
    ),
  );
  debugFirst("GetEkoCorrectionRecords", rows);
  return rows.map((r) => {
    const [ad, at] = appliedOf(r);
    return {
      id: str(get(r, "RecordId")),
      entryDate: dateOnly(get(r, "EntryDate")),
      stationId: str(get(r, "StationId")),
      cowFat: str(get(r, "FatCC")),
      cowSnf: str(get(r, "SNFCC")),
      buffFat: str(get(r, "FATBC")),
      buffSnf: str(get(r, "SNFBC")),
      mixFat: str(get(r, "FATMC")),
      mixSnf: str(get(r, "SNFMC")),
      status: statusOf(r),
      appliedDate: ad,
      appliedTime: at,
    };
  });
}

export interface CorrectionInput {
  stationId: string;
  entryDate: string;
  shift: string;
  vlc: Quality6;
  doc: Quality6;
  diff: Quality6;
}

export async function saveEkoCorrection(c: CorrectionInput): Promise<void> {
  const data = {
    entrydate: c.entryDate,
    stationid: c.stationId,
    fatcc: n0(c.diff.cowFat),
    snfcc: n0(c.diff.cowSnf),
    fatbc: n0(c.diff.buffFat),
    snfbc: n0(c.diff.buffSnf),
    fatmc: n0(c.diff.mixFat),
    snfmc: n0(c.diff.mixSnf),
    isactive: 1,
  };
  if (import.meta.env.DEV)
    console.info("[eko] settingscorrection (before encryption):", data);
  assertOk(
    await postSealed(`${HOST}/home/settingscorrection`, data),
    "The portal did not save the Eko calibration.",
  );
}

export async function updateEkoCorrectionFlag(
  stationId: string,
  recordId: string,
  flag: string,
): Promise<void> {
  assertOk(
    await request(
      `${HOST}/api/analyzer/UpdateEkoCorrectionFlag?stationid=${encodeURIComponent(stationId)}&recordid=${encodeURIComponent(recordId)}&flag=${encodeURIComponent(flag)}`,
    ),
    "The record could not be updated.",
  );
}

export interface Sample3 {
  fat: string;
  snf: string;
  clr: string;
}
export interface ControlSampleInput {
  stationId: string;
  entryDate: string;
  cow: Sample3;
  buff: Sample3;
  mix: Sample3;
}
export const emptySample = (): Sample3 => ({ fat: "", snf: "", clr: "" });

export interface ControlRow {
  id: string;
  entryDate: string;
  stationId: string;
  cowFat: string;
  cowSnf: string;
  buffFat: string;
  buffSnf: string;
  mixFat: string;
  mixSnf: string;

  prev: Quality6;
  next: Quality6;
  status: string;
  appliedDate: string;
  appliedTime: string;
}

const lineOf = (r: Obj, prefix: string): Quality6 => {
  const pick = (name: string) =>
    str(get(r, `${prefix}${name}`, `${name}${prefix}`));
  return {
    cowFat: pick("CowFat"),
    cowSnf: pick("CowSnf"),
    buffFat: pick("BuffFat"),
    buffSnf: pick("BuffSnf"),
    mixFat: pick("MixFat"),
    mixSnf: pick("MixSnf"),
  };
};

export async function getControlSamples(
  stationId: string,
): Promise<ControlRow[]> {
  const rows = recordsOf(
    await request(
      `${HOST}/home/GetCorrectorRecords?stationid=${encodeURIComponent(stationId)}`,
    ),
  );
  debugFirst("GetCorrectorRecords", rows);
  return rows.map((r) => {
    const [ad, at] = appliedOf(r);
    return {
      id: str(get(r, "RecordId")),
      entryDate: dateOnly(get(r, "EntryDate")),
      stationId: str(get(r, "StationId")),
      cowFat: str(get(r, "CowFat")),
      cowSnf: str(get(r, "CowSnf")),
      buffFat: str(get(r, "BuffFat", "BuffaloFat")),
      buffSnf: str(get(r, "BuffSnf", "BuffaloSnf")),
      mixFat: str(get(r, "MixFat")),
      mixSnf: str(get(r, "MixSnf")),
      prev: lineOf(r, "Prev"),
      next: lineOf(r, "New"),
      status: statusOf(r),
      appliedDate: ad,
      appliedTime: at,
    };
  });
}

const stamp = (day: string) => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${day} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const clrFromFatSnf = (fat: string, snf: string): string => {
  const f = Number(fat),
    s = Number(snf);
  if (fat === "" || snf === "" || Number.isNaN(f) || Number.isNaN(s)) return "";
  const v = 4 * s - 0.9 * f - 1;
  return v > 0 ? v.toFixed(1) : "";
};

export async function saveControlSample(c: ControlSampleInput): Promise<void> {
  const data = {
    entrydate: stamp(c.entryDate),
    stationid: c.stationId,
    cowfat: nOrBlank(c.cow.fat),
    cowsnf: nOrBlank(c.cow.snf),
    cowclr: nOrBlank(c.cow.clr),
    bufffat: nOrBlank(c.buff.fat),
    buffsnf: nOrBlank(c.buff.snf),
    buffclr: nOrBlank(c.buff.clr),
    mixfat: nOrBlank(c.mix.fat),
    mixsnf: nOrBlank(c.mix.snf),
    mixclr: nOrBlank(c.mix.clr),
  };
  if (import.meta.env.DEV)
    console.info("[eko] correctorsample (before encryption):", data);
  assertOk(
    await postSealed(`${HOST}/home/correctorsample`, data),
    "The portal did not save the control sample.",
  );
}

export async function updateCorrectorFlag(
  stationId: string,
  recordId: string,
  flag: string,
): Promise<void> {
  assertOk(
    await request(
      `${HOST}/api/analyzer/UpdateCorrectorFlag?stationid=${encodeURIComponent(stationId)}&recordid=${encodeURIComponent(recordId)}&flag=${encodeURIComponent(flag)}`,
      { method: "POST" },
    ),
    "The record could not be updated.",
  );
}

export interface EkoCredentials {
  villageId: string;
  contact: string;
  pcbSerial: string;
  currentPass: string;
  newPass: string;
  passFlag: string;
  name: string;
}
export const emptyCredentials = (): EkoCredentials => ({
  villageId: "",
  contact: "",
  pcbSerial: "",
  currentPass: "",
  newPass: "",
  passFlag: "0",
  name: "",
});

export async function getEkoCredentials(
  villageId: string,
): Promise<EkoCredentials> {
  const rec = recordsOf(
    await request(
      `${STATIC}/home/getVillageId?villageid=${encodeURIComponent(villageId)}`,
    ),
  )[0];
  if (!rec) return { ...emptyCredentials(), villageId };
  return {
    villageId,
    name: str(get(rec, "villagename")),
    contact: str(get(rec, "villageagentcontact")),
    pcbSerial: str(get(rec, "ekopcbno", "pcbsrno")),
    currentPass: str(get(rec, "ekopass", "euppass")),
    newPass: str(get(rec, "ekonewpass")),
    passFlag: str(get(rec, "ekopassflag")) || "0",
  };
}

export async function updateEkoPassword(
  c: EkoCredentials,
  apply: boolean,
): Promise<void> {
  assertOk(
    await request(`${STATIC}/home/updateEkoPassword`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        villageid: c.villageId,
        villageagentcontact: c.contact,
        ekopcbno: c.pcbSerial,
        ekopass: c.currentPass,
        ekonewpass: c.newPass,
        ekopassflag: apply ? "1" : "0",
      }),
    }),
    "The Eko password could not be updated.",
  );
}
