import { BASE_URL, REQUEST_TIMEOUT_MS } from "../config";
import { clearRequestMemo, listOf, parseGatewayText } from "../http/client";
import { ApiError } from "../http/errors";
export const VLC_MILK_LIST_PATH = "/home/VlcMilkCollection";
export const VLC_MILK_SAVE_PATH = "/dairy/dairy/MilkCollectionvlc";

export type VlcMilkRow = Record<string, unknown>;

const interceptor = (path: string) =>
  `${BASE_URL || "https://smartx.shivinfotech.co.in"}/gateway/Interceptor?path=${path}`;

async function call(method: "GET" | "POST", path: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(interceptor(path), {
      method,
      cache: "no-store",
      headers: { Accept: "application/json, text/plain, */*" },
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

export const getVlcMilk = async (
  vlccid: string,
  shift: string,
  entrydate: string,
): Promise<VlcMilkRow[]> =>
  listOf<VlcMilkRow>(
    parseGatewayText(
      await call(
        "GET",
        `${VLC_MILK_LIST_PATH}?vlccid=${encodeURIComponent(vlccid)}&shift=${encodeURIComponent(shift)}&entrydate=${encodeURIComponent(entrydate)}`,
      ),
    ),
  );

export interface VlcMilkEntry {
  vlccid: string;
  shift: string;
  milktype: string;
  entrydate: string;
  qty: string;
  fat: string;
  snf: string;
  clr: string;
}

export const buildVlcMilkPayload = (e: VlcMilkEntry) => ({
  vlccid: e.vlccid,
  qty: e.qty,
  fat: e.fat,
  snf: e.snf,
  clr: e.clr,
  rtpl: "0",
  amount: "0",
  dtdate: e.entrydate,
  shift: e.shift,
  milktype: e.milktype,
});

export async function postVlcMilk(entry: VlcMilkEntry): Promise<string> {
  const json = JSON.stringify([buildVlcMilkPayload(entry)]);
  const text = (
    await call("POST", `${VLC_MILK_SAVE_PATH}?data=${encodeURIComponent(json)}`)
  )
    .replace(/[\r\n]+/g, " ")
    .trim();
  clearRequestMemo();
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
        (o.Success ?? o.success) === false &&
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
