import { dpuGet } from "../http/dpu";
import { ApiError, EmptyReplyError } from "../http/errors";
import { isObj, rowsFrom, type Obj } from "../utils/loose";

/**
 * VLC milk bill from the DPU API:
 *   GET https://dpu.shivinfotech.co.in/api/Login/MilkBillPaySummVLCC?id=0&fromdate=…&todate=…&stationid=<vlc id>
 * The API takes one VLC id per call, so the user's centres are asked in parallel and joined.
 */
export const VLC_MILK_BILL_PATH = "/Login/MilkBillPaySummVLCC";

export interface VlcMilkBillQuery {
  fromdate: string;
  todate: string;
  /** Every VLC / centre id the signed-in user can see. */
  stationIds: string[];
}

export interface VlcMilkBillResult {
  /** Table rows (when the API answers with JSON rows). */
  rows: Obj[];
  /** Ready-made bill markup (when the API answers with an HTML bill). Not cleaned yet. */
  markup: string;
  /** Centres whose call failed while others worked. */
  failed: number;
}

interface One {
  rows: Obj[];
  markup: string;
}

const NO_RECORD = /no\s*record/i;

function readReply(json: unknown): One {
  if (typeof json === "string") {
    const t = json.trim();
    if (!t || t === "null") return { rows: [], markup: "" };
    if (t.startsWith("<")) return { rows: [], markup: t };
    return { rows: [], markup: "" };
  }
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    if (ok === false) {
      const message = String(json.Message ?? json.message ?? "").trim();
      if (!message || NO_RECORD.test(message)) return { rows: [], markup: "" };
      throw new ApiError(message, "server");
    }
  }
  return { rows: rowsFrom(json), markup: "" };
}

async function one(q: VlcMilkBillQuery, stationId: string): Promise<One> {
  const qs =
    `id=0&fromdate=${encodeURIComponent(q.fromdate)}` +
    `&todate=${encodeURIComponent(q.todate)}` +
    `&stationid=${encodeURIComponent(stationId)}`;
  try {
    return readReply(await dpuGet(`${VLC_MILK_BILL_PATH}?${qs}`, 1));
  } catch (e) {
    // an empty reply simply means "no record for this centre"
    if (e instanceof EmptyReplyError) return { rows: [], markup: "" };
    throw e;
  }
}

export async function getVlcMilkBill(q: VlcMilkBillQuery): Promise<VlcMilkBillResult> {
  const settled = await Promise.allSettled(q.stationIds.map((id) => one(q, id)));
  const out: VlcMilkBillResult = { rows: [], markup: "", failed: 0 };
  let firstError: unknown;
  for (const s of settled) {
    if (s.status === "fulfilled") {
      out.rows.push(...s.value.rows);
      out.markup += s.value.markup;
    } else {
      out.failed += 1;
      firstError ??= s.reason;
    }
  }
  if (q.stationIds.length > 0 && out.failed === q.stationIds.length) {
    throw firstError instanceof ApiError
      ? firstError
      : new ApiError("The milk bill could not be loaded.", "server");
  }
  return out;
}
