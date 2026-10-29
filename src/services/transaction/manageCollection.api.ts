import { environment, REQUEST_TIMEOUT_MS } from "../config";
import {
  clearRequestMemo,
  gatewayPost,
  listOf,
  parseGatewayText,
} from "../http/client";
import { ApiError } from "../http/errors";

export const MANAGE_LIST_PATH = "/home/farmercollection";
export const MANAGE_UPDATE_PATH = "/dairy/dairy/updatemilkentry";
export const MANAGE_DELETE_PATH = "/dairy/dairy/FarmerCollectionDelete";

export type CollectionRow = Record<string, unknown>;

export interface CollectionQuery {
  vlccid: string;
  shift: string; //    M | E
  milktype: string; // C | B | M
  fromdate: string;
  todate: string;
}

export const getCollection = (q: CollectionQuery): Promise<CollectionRow[]> =>
  gatewayPost(MANAGE_LIST_PATH, {
    id: q.vlccid,
    shift: q.shift,
    milktype: q.milktype,
    fromdate: q.fromdate,
    todate: q.todate,

    stationid: q.vlccid,
    mccid: q.vlccid.slice(0, 3),
  }).then((json) => listOf<CollectionRow>(json));

export const forgetCachedLists = () => clearRequestMemo();

async function call(path: string, init: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${environment.staticIP}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json, text/plain, */*",
        ...((init.headers as Record<string, string>) ?? {}),
      },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403)
      throw new ApiError(
        "Your session was rejected by the server. Please sign in again.",
        "auth",
      );
    const text = await res.text();
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
    return text;
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

function readReply(text: string): { message: string; raw: unknown } {
  const clean = text.replace(/[\r\n]+/g, " ").trim();
  let raw: unknown = clean;
  try {
    raw = parseGatewayText(clean);
  } catch {}
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const message = String(o.Message ?? o.message ?? "").trim();
    const flag = o.Success ?? o.success ?? o.status ?? o.Status;
    if (flag === false || String(flag).toLowerCase() === "false")
      throw new ApiError(
        message || "The portal did not accept this change.",
        "server",
      );
    return { message, raw };
  }
  return { message: String(raw ?? "").trim(), raw };
}

export interface UpdateEntry {
  recordId: string;
  vlccid: string;
  date: string; //     yyyy-mm-dd
  qty: string;
  fat: string;
  snf: string;
  clr: string;
  milktype: string; // C | B | M
}

export async function updateEntry(e: UpdateEntry): Promise<number> {
  const qs = new URLSearchParams({
    recordid: e.recordId,
    vlccid: e.vlccid,
    dtdate: e.date,
    qty: e.qty,
    fat: e.fat,
    snf: e.snf,
    clr: e.clr,
    milktype: e.milktype,
  });
  const text = await call(`${MANAGE_UPDATE_PATH}?${qs.toString()}`, {
    method: "GET",
  });
  clearRequestMemo();
  const { message } = readReply(text);
  const rate = parseFloat(message);
  if (!Number.isFinite(rate))
    throw new ApiError(
      message || "The portal did not return a rate for this entry.",
      "server",
    );
  return rate;
}

export const buildDeleteForm = (recordId: string): FormData => {
  const form = new FormData();
  form.append("id", recordId);
  return form;
};

export async function deleteEntry(row: {
  recordId: string;
  vlccid: string;
  date: string;
}): Promise<string> {
  const text = await call(MANAGE_DELETE_PATH, {
    method: "POST",
    body: buildDeleteForm(row.recordId),
  });
  clearRequestMemo();
  return readReply(text).message;
}
