import { clearRequestMemo, directGet, gatewayGet } from "../http/client";
import {
  dpuGet,
  dpuSaveAttempts,
  encryptedShapes,
  openDpuReply,
  type SaveAttempt,
} from "../http/dpu";
import { BASE_URL } from "../config";
import { DPU } from "../http/dpuEndpoints";
import { ApiError } from "../http/errors";
import { encryptXorPayload } from "../../lib/crypto";
import { isObj, norm, pick, type Obj } from "../utils/loose";
import { vlccName } from "../vlcc/names";

export const MILK_TYPES = [
  { code: "C", label: "Cow" },
  { code: "B", label: "Buffalo" },
  { code: "M", label: "Mix" },
] as const;
export type MilkCode = (typeof MILK_TYPES)[number]["code"];
export const milkLabel = (code: string) =>
  MILK_TYPES.find((m) => m.code === code.toUpperCase())?.label ?? code;

const q = encodeURIComponent;

const asJson = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!/^[[{]/.test(t)) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
};

export function rowsOf(json: unknown): Obj[] {
  const v = asJson(json);
  if (Array.isArray(v)) return v.filter(isObj);
  if (!isObj(v)) return [];
  const ok = v.Success ?? v.success;
  const message = String(v.Message ?? v.message ?? "").trim();
  if (ok === false) {
    if (!message || /no\s*(record|data|rate)/i.test(message)) return [];
    throw new ApiError(message, "server");
  }
  for (const key of [
    "Message",
    "message",
    "Data",
    "data",
    "Result",
    "result",
  ]) {
    const inner = asJson(v[key]);
    if (Array.isArray(inner)) return inner.filter(isObj);
    if (isObj(inner)) {
      const deeper = rowsOf(inner);
      if (deeper.length) return deeper;
    }
  }
  return [];
}

export interface SavedRate {
  vlcId: string;
  rangeType: string;
  date: string;
  time: string;
  milkType: string;
  active: boolean;
  label: string;
}

const timeText = (t: string) => t.replace(/-/g, ":");

export function toIsoDate(d: string): string {
  const t = d.trim();
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(t);
  if (dmy)
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return ymd ? `${ymd[1]}-${ymd[2]}-${ymd[3]}` : t;
}

export function toShownDate(d: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim());
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : d.trim();
}

export async function getSavedRateList(
  vlcId: string,
  status: string,
): Promise<SavedRate[]> {
  // DPU API: GET https://dpu.shivinfotech.co.in/api/Login/getSavedRateList?rateid=&status=
  const json = await dpuGet(
    `/Login/getSavedRateList?rateid=${q(vlcId)}&status=${q(status)}`,
    0,
  );
  return rowsOf(json)
    .map((r): SavedRate => {
      const date = pick(r, ["date", "ratedate", "effectivedate", "edate"]);
      const time = timeText(pick(r, ["time", "ratetime"]));
      return {
        vlcId: pick(r, ["rateid"]) || vlcId,
        rangeType: pick(r, ["rangetype"]),
        date,
        time,
        milkType: (
          pick(r, ["milktype", "mtype", "type", "milk"]) || "C"
        ).toUpperCase(),
        active: pick(r, ["isactive", "status"]) !== "0",
        label: [date, time].filter(Boolean).join("  "),
      };
    })
    .filter((r) => r.rangeType);
}

export interface RateGrid {
  snfs: number[];
  rows: Array<{ fat: number; rates: Array<number | null> }>;
}

export const emptyGrid = (): RateGrid => ({ snfs: [], rows: [] });
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const FAT_KEYS = [
  "fat",
  "fatvalue",
  "fatstart",
  "fatrange",
  "startfat",
  "startvalue",
];
const SNF_KEYS = [
  "snf",
  "snfvalue",
  "snfstart",
  "snfrange",
  "endsnf",
  "endvalue",
  "end",
];
const RATE_KEYS = [
  "srate",
  "rate",
  "ratevalue",
  "amount",
  "rateamount",
  "price",
  "value",
];

const firstNum = (r: Obj, keys: string[]): number | null => {
  const names = Object.keys(r);
  for (const k of keys) {
    const real = names.find((n) => norm(n) === k);
    if (real === undefined) continue;
    const n = num(r[real]);
    if (n !== null) return n;
  }
  return null;
};

export function gridFromRecords(records: Obj[]): RateGrid {
  const fats = new Map<number, Map<number, number>>();
  const snfSet = new Set<number>();
  for (const r of records) {
    const fat = firstNum(r, FAT_KEYS);
    const snf = firstNum(r, SNF_KEYS);
    const rate = firstNum(r, RATE_KEYS);
    if (fat === null || snf === null || rate === null) continue;
    const f = r2(fat);
    const s = r2(snf);
    snfSet.add(s);
    const row = fats.get(f) ?? new Map<number, number>();
    row.set(s, rate);
    fats.set(f, row);
  }
  const snfs = [...snfSet].sort((a, b) => a - b);
  const rows = [...fats.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([fat, m]) => ({ fat, rates: snfs.map((s) => m.get(s) ?? null) }));
  return { snfs, rows };
}

export const RATE_SHOW_PATH = "/dairy/dairy/ShowRateWeb";

async function showRateJson(query: string): Promise<unknown> {
  const path = `${RATE_SHOW_PATH}${query}`;
  try {
    return openDpuReply(await gatewayGet(path, 0), 0, true);
  } catch (first) {
    if (first instanceof ApiError && first.kind === "auth") throw first;
    console.warn(
      "[RateMaster] STIPL ShowRateWeb (direct) failed, trying the gateway:",
      first,
    );
    try {
      const root = BASE_URL || "https://smartx.shivinfotech.co.in";
      const base = /^https?:/i.test(root)
        ? root
        : `${window.location.origin}${root}`;
      return openDpuReply(
        await directGet(
          `${base}/gateway/Interceptor?path=${encodeURIComponent(path)}`,
          0,
        ),
        0,
        true,
      );
    } catch (second) {
      console.warn(
        "[RateMaster] STIPL ShowRateWeb (gateway) failed, using the DPU host instead:",
        second,
      );
      return dpuGet(`${DPU.showRateWeb}${query}`, 0);
    }
  }
}

export async function showRate(
  stationId: string,
  isoDate: string,
  milkType: string,
  rangeType: string,
): Promise<RateGrid> {
  const json = await showRateJson(
    `?stationid=${q(stationId)}&edate=${q(isoDate)}&milktype=${q(milkType)}&rateid=${q(rangeType)}`,
  );
  const records = rowsOf(json);
  if (!records.length) return emptyGrid();
  const grid = gridFromRecords(records);
  if (!grid.rows.length) {
    throw new ApiError(
      "The rate chart came back in a shape this page does not know. Open the browser console to see one record.",
      "parse",
    );
  }
  return grid;
}

export interface RateUpload {
  stationid: string;
  json: string;
  milktype: string;
  shift: string;
  effectivedate: string;
  currentrate?: string;
}

// DPU API: POST https://dpu.shivinfotech.co.in/api/Login/RateExcel
// Body { "Payload": "<XOR + base64 text>" }. Layout confirmed with the server: the old portal's form fields inside the Payload.
export async function saveRateExcel(body: RateUpload): Promise<string> {
  let chart: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(body.json);
    if (Array.isArray(parsed)) chart = parsed;
  } catch {
    /* chart stays empty */
  }
  if (!chart.length)
    throw new ApiError("The rate file has no rows to upload.", "parse");

  const current = body.currentrate?.trim() ? body.currentrate : "0";
  const iso = body.effectivedate;
  const endpoint = "/Login/RateExcel";
  const enc = (v: unknown) => encryptedShapes(v)[0];
  const PASCAL: Record<string, string> = {
    json: "Json",
    stationid: "StationId",
    milktype: "MilkType",
    shift: "Shift",
    trdate: "TrDate",
    effectivedate: "EffectiveDate",
    currentrate: "CurrentRate",
  };
  const pascal = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [PASCAL[k] ?? k, v]));

  // Exactly what the old working portal sends (form fields json, stationid, milktype, shift, trdate, ...).
  const portal = {
    json: body.json,
    stationid: body.stationid,
    milktype: body.milktype,
    shift: body.shift,
    trdate: iso,
    effectivedate: iso,
    currentrate: current,
  };

  // The server wants { "Payload": "<XOR + base64>" } (same scheme as its replies); the object inside has the same
  // field names as the old portal's form (json, stationid, milktype, shift, trdate ...). Confirmed working: "xor-portal-exact".
  const xor = (v: unknown) => ({ Payload: encryptXorPayload(v) });
  const attempts: SaveAttempt[] = [
    { label: "xor-portal-exact", path: endpoint, body: xor(portal) },
    {
      label: "xor-portal-exact-pascal",
      path: endpoint,
      body: xor(pascal(portal)),
    },
    { label: "xor-chart-only", path: endpoint, body: xor(chart) },
    { label: "portal-exact", path: endpoint, body: enc(portal) },
  ];

  const message = await dpuSaveAttempts("RateExcel", attempts);
  clearRequestMemo();
  return message || "Done";
}

// The two PUT endpoints below take their values in the URL, but the server answers 415 (Unsupported Media Type) to a
// PUT that has no JSON body. So they are sent with Content-Type: application/json and a body. Which body the server
// wants is not published, so the bodies are tried in order (only 400 / 415 / 422 moves on to the next one) and the one
// that works is remembered.
const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
const putAttempts = (
  path: string,
  params: Record<string, string>,
): SaveAttempt[] => {
  const xor = (v: unknown) => ({ Payload: encryptXorPayload(v) });
  return [
    // the server answered "The Payload field is required" to an empty body and "not a valid Base-64 string" to AES text,
    // so Payload must be XOR + base64 text. The values also stay in the URL.
    { label: "xor-params", path, body: xor(params) },
    {
      label: "xor-params-pascal",
      path,
      body: xor(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [cap(k), v])),
      ),
    },
    { label: "xor-empty-object", path, body: xor({}) },
    {
      label: "xor-query-text",
      path,
      body: xor(new URLSearchParams(params).toString()),
    },
  ];
};

// DPU API: PUT https://dpu.shivinfotech.co.in/api/Login/updateCollectionRate?vlccid=&rateDate=&type=&rateid=&fromdate=&todate=
export async function updateRate(p: {
  vlccid: string;
  rateDate: string;
  type: string;
  rateid: string;
  fromdate: string;
  todate: string;
}): Promise<string> {
  const message = await dpuSaveAttempts(
    "updateCollectionRate",
    putAttempts(
      `/Login/updateCollectionRate?vlccid=${q(p.vlccid)}&rateDate=${q(p.rateDate)}&type=${q(p.type)}&rateid=${q(p.rateid)}&fromdate=${q(p.fromdate)}&todate=${q(p.todate)}`,
      { ...p },
    ),
    "PUT",
  );
  clearRequestMemo();
  return message || "Done";
}

// DPU API: PUT https://dpu.shivinfotech.co.in/api/Login/dpuSyncAsync?status=&villageid=&rateid=&type=
export async function syncAsyncRate(p: {
  status: string;
  villageid: string;
  rateid: string;
  type: string;
}): Promise<string> {
  const message = await dpuSaveAttempts(
    "dpuSyncAsync",
    putAttempts(
      `/Login/dpuSyncAsync?status=${q(p.status)}&villageid=${q(p.villageid)}&rateid=${q(p.rateid)}&type=${q(p.type)}`,
      { ...p },
    ),
    "PUT",
  );
  clearRequestMemo();
  return message || "Done";
}

export interface RateStatusRow {
  villageId: string;
  villageName: string;
  effectiveDate: string;
  entryDate: string;
  currentRate: string;
  downloadDate: string;
  downloadTime: string;
  rateId: string;
  status: string;
}

const dayOnly = (d: string) =>
  /^(\d{4}-\d{2}-\d{2})/.exec(d.trim())?.[1] ?? d.trim();

export async function getRateStatus(
  mccid: string,
  plantid: string,
  type: string,
): Promise<RateStatusRow[]> {
  // DPU API: GET https://dpu.shivinfotech.co.in/api/Login/GetRateStatus?mccid=&plantid=&type=
  const json = await dpuGet(
    `${DPU.getRateStatus}?mccid=${q(mccid)}&plantid=${q(plantid)}&type=${q(type)}`,
    0,
  );
  return rowsOf(json).map((r): RateStatusRow => {
    const vid = pick(r, ["vid", "villageid", "vlccid", "vlcid", "stationid"]);
    const code =
      pick(r, ["beneficiaryname", "centercode", "customstationid"]) || vid;
    return {
      villageId: code,
      villageName:
        pick(r, [
          "villageagentaddress",
          "villagename",
          "vlcname",
          "vlccname",
          "centername",
          "name",
        ]) || vlccName(vid),
      effectiveDate: dayOnly(
        pick(r, [
          "rateeffectivedate",
          "effectivedate",
          "effectdate",
          "ratedate",
        ]),
      ),
      entryDate: dayOnly(pick(r, ["entrydate", "entereddate"])),
      currentRate: pick(r, ["currentrate", "rate"]),
      downloadDate: pick(r, ["downloaddate", "dwldate"]),
      downloadTime: timeText(pick(r, ["downloadtime", "dwltime"])),
      rateId: pick(r, ["rateid", "rangetype"]),
      status: pick(r, ["status", "ratestatus"]),
    };
  });
}
