import { environment, REQUEST_TIMEOUT_MS } from "../config";
import {
  clearRequestMemo,
  gatewayGet,
  gatewayPostJson,
  listOf,
} from "../http/client";
import { ApiError } from "../http/errors";
import { mapMaster, type MasterFarmer } from "../farmer/farmerBook";
import { norm, rowsFrom } from "../utils/loose";
import type { RawLoose } from "../types/raw";

export const FARMER_MASTER_PATH = "/home/farmermaster";
export const FARMER_RATE_PATH = "/dairy/dairy/getRate";
export const FARMER_MILK_SAVE_PATH = "/dairy/dairy/MilkCollection";

export type RateRow = Record<string, unknown>;

const store = new Map<string, { at: number; value: unknown }>();

async function cached<T>(
  key: string,
  expiryMinutes: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < expiryMinutes * 60_000)
    return hit.value as T;
  const value = await load();
  store.set(key, { at: Date.now(), value });
  return value;
}

export const getFarmers = (vlcid: string): Promise<MasterFarmer[]> =>
  cached(`farmers:${vlcid}`, 60, async () => {
    const rows = listOf<RawLoose>(
      await gatewayPostJson(FARMER_MASTER_PATH, { VillageIds: vlcid }),
    );
    return mapMaster(rows)
      .filter((f) => f.farmerId)
      .sort((a, b) =>
        a.farmerId.localeCompare(b.farmerId, undefined, { numeric: true }),
      );
  });

export const getRateChart = (rateId: string): Promise<RateRow[]> =>
  cached(`rate:${rateId}`, 60, async () =>
    rowsFrom(
      await gatewayGet(
        `${FARMER_RATE_PATH}?rateId=${encodeURIComponent(rateId)}`,
      ),
    ),
  );

const pickText = (r: RateRow, names: string[]): string => {
  const keys = Object.keys(r);
  for (const want of names.map(norm)) {
    const k = keys.find((x) => norm(x) === want);
    if (!k) continue;
    const v = r[k];
    if ((typeof v === "string" && v.trim()) || typeof v === "number")
      return String(v).trim();
  }
  return "";
};

const near = (a: number, b: string | number) => {
  const n = typeof b === "number" ? b : parseFloat(b);
  return Number.isFinite(n) && Math.abs(n - a) < 0.005;
};

const MILK_NAMES: Record<string, string> = {
  C: "cow",
  B: "buffalo",
  M: "mix",
};

const sameMilk = (code: string, text: string) => {
  const x = norm(text);
  if (!x) return true;
  return x === code.toLowerCase() || (MILK_NAMES[code] ?? "").startsWith(x);
};

const isRow = (v: unknown): v is RateRow =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const dayOf = (v: string) => v.slice(0, 10); // 2026-10-13T00:00:00 -> 2026-10-13

function lookupNested(
  charts: RateRow[],
  p: { fat: number; snf: number; milk: string; date: string },
): number | null {
  const listOfChart = (r: RateRow): RateRow[] => {
    const k = Object.keys(r).find((x) => norm(x) === "ratelist");
    const v = k ? r[k] : null;
    return Array.isArray(v) ? v.filter(isRow) : [];
  };
  const eligible = charts
    .filter((r) => {
      const type = pickText(r, ["type", "milktype", "reftype"]);
      if (!type || !sameMilk(p.milk, type)) return false;
      const eff = dayOf(pickText(r, ["rateeffectivedate", "effectivedate"]));
      return !eff || !p.date || eff <= p.date;
    })
    .sort((a, b) =>
      dayOf(pickText(b, ["rateeffectivedate", "effectivedate"])).localeCompare(
        dayOf(pickText(a, ["rateeffectivedate", "effectivedate"])),
      ),
    );
  const chart = eligible[0];
  if (!chart) return null;
  for (const item of listOfChart(chart)) {
    if (!near(p.fat, pickText(item, ["fat"]))) continue;
    if (!near(p.snf, pickText(item, ["snf"]))) continue;
    const n = parseFloat(pickText(item, ["rate", "rtpl"]));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function lookupRate(
  rows: RateRow[],
  p: { fat: number; snf: number; clr: number; milk: string; date: string },
): number | null {
  const nested = rows.filter((r) =>
    Object.keys(r).some((k) => norm(k) === "ratelist"),
  );
  if (nested.length) return lookupNested(nested, p);
  return lookupFlat(rows, p);
}

function lookupFlat(
  rows: RateRow[],
  p: { fat: number; snf: number; clr: number; milk: string },
): number | null {
  for (const r of rows) {
    const fatV = pickText(r, ["fat", "fatpercent", "fatper"]);
    if (!fatV || !near(p.fat, fatV)) continue;
    if (!sameMilk(p.milk, pickText(r, ["milktype", "milk"]))) continue;

    const snfV = pickText(r, ["snf", "snfpercent", "snfper"]);
    const clrV = pickText(r, ["clr"]);
    const rateV = pickText(r, [
      "rate",
      "rtpl",
      "rateperltr",
      "rateperliter",
      "rates",
    ]);

    if (snfV || clrV) {
      const ok = snfV ? near(p.snf, snfV) : near(p.clr, clrV);
      if (!ok || !rateV) continue;
      const n = parseFloat(rateV);
      if (Number.isFinite(n)) return n;
      continue;
    }

    for (const key of Object.keys(r)) {
      if (!near(p.snf, key)) continue;
      const n = parseFloat(String(r[key]));
      if (Number.isFinite(n)) return n;
    }

    if (rateV) {
      const n = parseFloat(rateV);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export interface FarmerMilkEntry {
  vlccid: string;
  farmerid: string;
  shift: string;
  milktype: string;
  entrydate: string;
  rateid: string;
  qty: string;
  fat: string;
  snf: string;
  clr: string;
  rate: string;
  amount: string;
}

const PORTAL_CONST = {
  kgltrconst: "1.030",
  ltrkgconst: "0.987",
  qtymode: "Ltr",
  qtydecimals: "DOUBLE",
  qltydecimals: "DOUBLE",
  createdby: "SMARTX",
  modifiedby: "SMARTX",
  syncdirection: "1",
  usbflag: "1",
  paymentid: "1",
};

export const buildFarmerMilkPayload = (e: FarmerMilkEntry) => {
  const now = new Date().toISOString();
  return {
    farmerid: e.farmerid,
    vlccid: e.vlccid,
    routeid: e.vlccid.slice(0, 5),
    bmcid: e.vlccid.slice(0, 3),
    sampleno: "0",
    qty: e.qty,
    fat: e.fat,
    snf: e.snf,
    water: "0",
    clr: e.clr,
    rtpl: e.rate,
    amount: e.amount,
    rateid: e.rateid,
    dtdate: e.entrydate,
    shift: e.shift,
    qtyauto: "0",
    qltyauto: "0",
    qtytime: now,
    qltytime: now,
    kgltrconst: PORTAL_CONST.kgltrconst,
    ltrkgconst: PORTAL_CONST.ltrkgconst,
    qtymode: PORTAL_CONST.qtymode,
    qtydecimals: PORTAL_CONST.qtydecimals,
    qltydecimals: PORTAL_CONST.qltydecimals,
    milktype: e.milktype,
    milkqtype: "",
    createddate: now,
    createdby: PORTAL_CONST.createdby,
    modifieddate: now,
    modifiedby: PORTAL_CONST.modifiedby,
    lastsynchronized: now,
    syncdirection: PORTAL_CONST.syncdirection,
    usbflag: PORTAL_CONST.usbflag,
    paymentid: PORTAL_CONST.paymentid,
  };
};

export async function postFarmerMilk(entry: FarmerMilkEntry): Promise<string> {
  const formData = new FormData();

  formData.append("id", JSON.stringify([buildFarmerMilkPayload(entry)]));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let text = "";
  try {
    const res = await fetch(`${environment.staticIP}${FARMER_MILK_SAVE_PATH}`, {
      method: "POST",
      body: formData,
      cache: "no-store",
      headers: { Accept: "application/json, text/plain, */*" },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403)
      throw new ApiError(
        "Your session was rejected by the server. Please sign in again.",
        "auth",
      );
    text = await res.text();
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

  clearRequestMemo();
  return readSaveReply(text.replace(/[\r\n]+/g, " ").trim());
}

function readSaveReply(text: string): string {
  let message = "";
  try {
    let parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        message = parsed as string;
      }
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>;
      message = String(o.Message ?? o.message ?? message ?? "").trim();
      const refused =
        (o.Success ?? o.success ?? o.status) === false &&
        !/^(done|success|saved|ok|insert|record)/i.test(message);
      if (refused)
        throw new ApiError(
          message || "The portal did not save this entry.",
          "server",
        );
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    message = text.slice(0, 160);
  }
  return message;
}
