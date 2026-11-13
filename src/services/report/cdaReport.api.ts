import { gatewayGet } from "../http/client";
import { ApiError, EmptyReplyError } from "../http/errors";
import { isObj, rowsFrom } from "../utils/loose";

/**
 * CDA report (Composite / Dispatch / Actual), one centre + one milk type + one shift per call:
 *   GET /home/getCDAReport?entrydate=…&enddate=…&vlccid=…&milktype=C&shift=M
 * Every reply row is one day and carries three groups of numbers, written with a suffix:
 *   _v = VLC (vendor) composite   _d = dispatch   _f = farmer total (actual)
 * each with Qty, Fat, Snf, Clr, Rate and Amount (Qty_v, Fat_v, Snf_v, Clr_v, Rate_v, Amount_v, Qty_f, …).
 */
export interface CdaSide {
  qty: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
}

export interface CdaRaw {
  vlccId: string;
  milk: "C" | "B" | "M";
  /** "M" / "E", or CDA_ALL_SHIFT_CODE when both shifts were asked in one call */
  shift: string;
  date: string;
  /** composite (VLC entry) */
  v: CdaSide;
  /** dispatch */
  d: CdaSide;
  /** actual (farmer collection) */
  f: CdaSide;
}

export interface CdaQuery {
  from: string;
  to: string;
  vlccId: string;
  milk: "C" | "B" | "M";
  shift: string;
}

/**
 * Shift value the server understands as "Morning + Evening together".
 * Empty = not known, so the page asks M and E separately (6 calls instead of 3).
 * Set VITE_CDA_ALL_SHIFT_CODE=Z (or whatever your server accepts) in .env.local.
 */
export const CDA_ALL_SHIFT_CODE: string =
  (import.meta.env.VITE_CDA_ALL_SHIFT_CODE as string | undefined)?.trim() || "";

const nk = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function side(row: Record<string, unknown>, suffix: "v" | "d" | "f"): CdaSide {
  const keys = Object.keys(row);
  const read = (base: string) => {
    const want = `${base}${suffix}`;
    const k = keys.find((x) => nk(x) === want);
    return k === undefined ? 0 : num(row[k]);
  };
  return { qty: read("qty"), fat: read("fat"), snf: read("snf"), rate: read("rate"), amount: read("amount") };
}

const dateOf = (row: Record<string, unknown>): string => {
  const k = Object.keys(row).find((x) => ["dtdate", "date", "entrydate", "trdate"].includes(nk(x)));
  return k === undefined ? "" : String(row[k] ?? "").slice(0, 10);
};

export async function getCdaReport(q: CdaQuery): Promise<CdaRaw[]> {
  const qs =
    `entrydate=${encodeURIComponent(q.from)}&enddate=${encodeURIComponent(q.to)}` +
    `&vlccid=${encodeURIComponent(q.vlccId)}&milktype=${q.milk}&shift=${encodeURIComponent(q.shift)}`;
  let json: unknown;
  try {
    json = await gatewayGet(`/home/getCDAReport?${qs}`, 1);
  } catch (e) {
    // an empty reply simply means "no record for this centre"
    if (e instanceof EmptyReplyError) return [];
    throw e;
  }
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    if (ok === false) {
      const message = String(json.Message ?? json.message ?? "").trim();
      if (!message || /no\s*record/i.test(message)) return [];
      throw new ApiError(message, "server");
    }
  }
  return rowsFrom(json).map((row) => ({
    vlccId: String(row.Vlccid ?? row.vlccid ?? q.vlccId),
    milk: q.milk,
    shift: q.shift,
    date: dateOf(row),
    v: side(row, "v"),
    d: side(row, "d"),
    f: side(row, "f"),
  }));
}