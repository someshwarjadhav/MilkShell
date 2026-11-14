import { dpuGet, dpuSaveAttempts, type SaveAttempt } from "../http/dpu";
import { DPU } from "../http/dpuEndpoints";
import { clearRequestMemo } from "../http/client";
import { decryptXorPayload, encryptXorPayload } from "../../lib/crypto";
import { payloadLayouts, replyMessage } from "../http/dpuHelpers";
import { ApiError } from "../http/errors";
import { isObj, norm, pickLike, type Obj } from "../utils/loose";
import { getSession } from "../session";
import { GLOBALS } from "../../lib/global";



export const HEAD_PATH = DPU.getBillHead;
export const LIST_PATH = DPU.billDeductionDetailsMA;
export const SAVE_PATH = DPU.addBillDeduction;

const log = (m: string) => console.log(`[DeductionEntry] ${m}`);

export interface DeductionType {
  /** RefCode - sent as `reftype` when loading and as `DeductionType` when saving */
  code: string;
  /** HeadName - what the dropdown shows */
  name: string;
}

export interface DeductionRow {
  farmerId: string;
  farmerName: string;
  /** BillAmount: the farmer's bill for the chosen dates (never changes on this screen) */
  billAmount: number;
  /** Deduction: the amount already set for this farmer when the list was loaded */
  deduction: number;
  /** Remaining: what is still left to recover after that deduction */
  remaining: number;
  /** OrgDedAmt = remaining + deduction: the most that can be deducted from this farmer */
  original: number;
}

/* ------------------------------------------------------------------ the calculation (same rules as the old portal) */

export const money = (v: number): number =>
  Math.round((v + Number.EPSILON) * 100) / 100;
export const two = (v: number): string => money(v).toFixed(2);

export const toNum = (v: unknown): number => {
  const x = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};

export interface RowCalc {
  /** what the farmer gets: bill amount - deduction */
  payable: number;
  /** what is still left to recover: original - deduction */
  remaining: number;
  /** null when the typed deduction is allowed, otherwise the reason it is not */
  error: string | null;
}

/**
 *  payable   = BillAmount  - Deduction
 *  remaining = OrgDedAmt   - Deduction      (OrgDedAmt = Remaining + Deduction, as loaded from the server)
 *  The typed Deduction is allowed only when  0 <= Deduction <= OrgDedAmt  and  Deduction <= BillAmount.
 */
export function calcRow(row: DeductionRow, deduction: number): RowCalc {
  const d = money(deduction);
  if (!(d >= 0))
    return {
      payable: money(row.billAmount),
      remaining: money(row.original),
      error: "Deduction cannot be negative.",
    };
  if (d > money(row.original))
    return {
      payable: money(row.billAmount),
      remaining: money(row.original),
      error: `Deduction is more than the remaining amount (${two(row.original)}).`,
    };
  if (d > money(row.billAmount))
    return {
      payable: money(row.billAmount),
      remaining: money(row.original),
      error: `Deduction is more than the bill amount (${two(row.billAmount)}).`,
    };
  return {
    payable: money(row.billAmount - d),
    remaining: money(row.original - d),
    error: null,
  };
}

/* ------------------------------------------------------------------ reading replies */

const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;
const WRAP_KEYS = [
  "message",
  "data",
  "result",
  "response",
  "table",
  "rows",
  "list",
];

/**
 * The list inside a reply. dpu.ts already opens { data: "<encrypted>" }; the old portal's { Success, Message: "<encrypted>" }
 * shape is opened here too (XOR + base64 with VITE_ENCRYPTION_KEY), and JSON that arrives as text is parsed.
 */
function listOf(reply: unknown): Obj[] {
  let v = reply;
  for (let i = 0; i < 5; i++) {
    if (typeof v === "string") {
      const t = v.trim();
      if (!t) return [];
      if (/^[[{]/.test(t)) {
        try {
          v = JSON.parse(t.replace(CONTROL, ""));
          continue;
        } catch {
          return [];
        }
      }
      try {
        const opened = decryptXorPayload(t);
        if (typeof opened === "string") {
          const clean = opened.replace(CONTROL, "").trim();
          if (!/^[[{]/.test(clean)) return [];
          v = JSON.parse(clean);
        } else v = opened;
        continue;
      } catch {
        return []; // plain text such as "No Record Found"
      }
    }
    if (Array.isArray(v)) return v.filter(isObj);
    if (!isObj(v)) return [];
    const obj: Obj = v;
    const keys = Object.keys(obj).filter((k) => WRAP_KEYS.includes(norm(k)));
    // a list / object wins over a text; a text is used only when it looks like JSON or encrypted data (not "Data fetched")
    const key =
      keys.find((k) => typeof obj[k] === "object" && obj[k] !== null) ??
      keys.find((k) => {
        const s = obj[k];
        return (
          typeof s === "string" &&
          (/^\s*[[{]/.test(s) ||
            /^[A-Za-z0-9+/_=-]{16,}$/.test(s.replace(/\s+/g, "")))
        );
      });
    if (!key) return [];
    v = obj[key];
  }
  return [];
}

/** A { Success:false } reply that is not just "no record" becomes an error. */
function failure(reply: unknown): string | null {
  if (!isObj(reply)) return null;
  const ok = reply.Success ?? reply.success ?? reply.status ?? reply.Status;
  if (ok !== false) return null;
  const m = replyMessage(reply);
  return /no\s*(record|data)/i.test(m)
    ? null
    : m || "The server did not return any data.";
}

const text = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

function field(r: Obj, names: string[]): unknown {
  const wanted = names.map(norm);
  for (const k of Object.keys(r)) if (wanted.includes(norm(k))) return r[k];
  return undefined;
}

/** Tries the next query layout only when the server refused the previous one (400 / 404 / 415 / 422). */
async function readWith(path: string, queries: string[]): Promise<unknown> {
  let last: unknown;
  for (let i = 0; i < queries.length; i++) {
    try {
      log(`GET ${path}?${queries[i]}`);
      return await dpuGet(`${path}?${queries[i]}`, 0);
    } catch (e) {
      last = e;
      const refused =
        e instanceof ApiError && /error (400|404|415|422)\b/i.test(e.message);
      console.warn(
        `[DeductionEntry] query layout ${i + 1}/${queries.length} refused:`,
        e instanceof Error ? e.message : e,
      );
      if (!refused) throw e;
    }
  }
  throw last;
}

/* ------------------------------------------------------------------ deduction types */

// The old portal's Deduction Entry asks getbillhead with the fixed station 7010101 (see the rar), not with the VLC:
// the bill heads (Advance, Cattle Feed ...) are kept per union / plant station, so the VLC id alone can answer "nothing".
// Last resort only - the id that worked is printed in the console.
const FALLBACK_HEAD_STATION = "7010101";

function parseTypes(reply: unknown): DeductionType[] {
  const seen = new Set<string>();
  const out: DeductionType[] = [];
  for (const r of listOf(reply)) {
    const code =
      text(
        field(r, [
          "refcode",
          "headid",
          "billheadid",
          "headcode",
          "refid",
          "id",
          "code",
        ]),
      ) || pickLike(r, ["refcode", "headid", "headcode"]);
    const name =
      text(
        field(r, [
          "headname",
          "billheadname",
          "refname",
          "name",
          "description",
        ]),
      ) || pickLike(r, ["headname", "name"]);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: name || code });
  }
  return out;
}

export async function getDeductionTypes(
  vlcid: string,
): Promise<DeductionType[]> {
  const s = getSession();
  const ids = [
    vlcid,
    s?.stationId,
    GLOBALS.stationid,
    s?.mccLoginId,
    s?.mccId,
    FALLBACK_HEAD_STATION,
  ]
    .map((x) => String(x ?? "").trim())
    .filter((x, i, all) => x && !x.includes(",") && all.indexOf(x) === i);
  let last: unknown;
  let answered = false;
  for (const id of ids) {
    try {
      const reply = await readWith(HEAD_PATH, [
        `stationid=${encodeURIComponent(id)}`,
        `id=${encodeURIComponent(id)}`,
      ]);
      answered = true;
      const bad = failure(reply);
      if (bad) throw new ApiError(bad, "server");
      const out = parseTypes(reply);
      if (out.length) {
        log(
          `${out.length} deduction type(s) found with stationid=${id}: ${out.map((o) => `${o.code}=${o.name}`).join(", ")}`,
        );
        return out;
      }
      console.warn(
        `[DeductionEntry] getBillHead stationid=${id} answered but no type could be read` +
          (isObj(reply)
            ? ` (reply keys: ${Object.keys(reply).join(", ") || "none"})`
            : ` (reply is ${Array.isArray(reply) ? "a list" : typeof reply})`),
      );
    } catch (e) {
      if (e instanceof ApiError && e.kind === "auth") throw e;
      last = e;
      console.warn(
        `[DeductionEntry] getBillHead stationid=${id} failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  if (!answered && last) throw last; // every try failed: show the real reason
  return [];
}

/* ------------------------------------------------------------------ farmer list */

export interface ListQuery {
  vlcid: string;
  reftype: string;
  from: string;
  to: string;
}

export async function getDeductions(q: ListQuery): Promise<DeductionRow[]> {
  const base =
    `reftype=${encodeURIComponent(q.reftype)}` +
    `&fromdate=${encodeURIComponent(q.from)}` +
    `&todate=${encodeURIComponent(q.to)}` +
    `&stationid=${encodeURIComponent(q.vlcid)}`;
  const reply = await readWith(LIST_PATH, [base, `id=0&${base}`]);
  const bad = failure(reply);
  if (bad) throw new ApiError(bad, "server");

  const rows: DeductionRow[] = [];
  for (const r of listOf(reply)) {
    const farmerId = text(field(r, ["farmerid", "farmercode", "codeno"]));
    if (!farmerId) continue;
    const billAmount = toNum(field(r, ["billamount"]));
    const deduction = toNum(field(r, ["deduction", "deductionamount"]));
    // old portal: a negative "Remaining" is shown as 0; OrgDedAmt = Remaining + Deduction
    const remaining = Math.max(
      0,
      toNum(field(r, ["remaining", "remainingamount"])),
    );
    rows.push({
      farmerId,
      farmerName: text(field(r, ["farmername", "name"])),
      billAmount,
      deduction,
      remaining,
      original: money(remaining + deduction),
    });
  }
  // old portal: farmers whose bill amount is 0 are not listed
  const shown = rows.filter((r) => r.billAmount > 0);
  log(`${rows.length} row(s) in the reply, ${shown.length} with a bill amount`);
  return shown;
}

/* ------------------------------------------------------------------ save */

export interface SaveInput {
  vlcid: string;
  reftype: string;
  from: string;
  to: string;
  /** every listed farmer with the deduction typed for him */
  rows: Array<{ row: DeductionRow; deduction: number }>;
}

/**
 * Same object the old portal posted (as the form field "data"):
 *  { StationId, DeductionType, FromDate, ToDate,
 *    Details: [{ Farmerid, FarmerName, deductionamount, remainingamount, billamount }] }
 * The DPU endpoint wants it inside { Payload: "<XOR + base64>" }. Several wrappers are tried (a refusal moves to the
 * next one, any other error stops) because the exact wrapper is only visible in Swagger.
 */
export function saveLayouts(
  s: SaveInput,
  path: string = SAVE_PATH,
): SaveAttempt[] {
  const details = (numeric: boolean) =>
    s.rows.map(({ row, deduction }) => {
      const calc = calcRow(row, deduction);
      return {
        Farmerid: numeric ? toNum(row.farmerId) : row.farmerId,
        FarmerName: row.farmerName,
        deductionamount: numeric ? money(deduction) : String(money(deduction)),
        remainingamount: numeric ? calc.remaining : two(calc.remaining),
        billamount: numeric ? money(row.billAmount) : two(row.billAmount),
      };
    });
  const portal = {
    StationId: s.vlcid,
    DeductionType: s.reftype,
    FromDate: s.from,
    ToDate: s.to,
    Details: details(false),
  };
  const numeric = { ...portal, Details: details(true) };
  const attempts = payloadLayouts(path, portal);
  attempts.splice(1, 0, {
    label: "xor-numeric",
    path,
    body: { Payload: encryptXorPayload(numeric) },
  });
  return attempts;
}

export async function saveDeductions(s: SaveInput): Promise<string> {
  const bad = s.rows.find(
    ({ row, deduction }) => calcRow(row, deduction).error,
  );
  if (bad)
    throw new ApiError(
      `Farmer ${bad.row.farmerId}: ${calcRow(bad.row, bad.deduction).error}`,
      "config",
    );
  if (!s.rows.length) throw new ApiError("There is nothing to save.", "config");
  log(
    `SAVE -> POST ${SAVE_PATH}  station=${s.vlcid} type=${s.reftype} ${s.from}..${s.to} rows=${s.rows.length}`,
  );
  const message = await dpuSaveAttempts(
    "deductionEntry",
    saveLayouts(s),
    "POST",
    /no\s*vlcc|error\s*in\s*data/i,
  );
  clearRequestMemo();
  return message || "Record saved";
}
