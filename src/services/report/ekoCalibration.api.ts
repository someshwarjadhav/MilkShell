import { ApiError } from "../http/errors";
import { DPU_BASE, openDpuReply } from "../http/dpu";
import { parseGatewayText } from "../http/client";
import { getSession } from "../session";
import { ekoRowsFrom, type EkoField, type EkoRow } from "./ekoShared";

type Row = EkoRow;


let ekoParam = "";
const PARAM_GUESSES = ["vlccid", "request", "vlcid", "id", "villageid", "stationid"];

async function callCleaning(param: string, stationId: string): Promise<{ ok: boolean; status: number; text: string }> {
  const token = getSession()?.token;
  let response: Response;
  try {
    response = await fetch(`${DPU_BASE}/Login/GetEkoCleaningData?${param}=${encodeURIComponent(stationId)}`, {
      method: "GET",
      headers: { Accept: "application/json, text/plain, */*", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Cannot reach the Eko Calibration API. Check network access and API CORS settings.", "network");
  }
  if (response.status === 401 || response.status === 403) throw new ApiError("Your session was rejected by the server. Please sign in again.", "auth");
  return { ok: response.ok, status: response.status, text: await response.text() };
}

/** Parameter names the server complained about, e.g. {"errors":{"request":["The request field is required."]}}. */
function paramsFromError(text: string): string[] {
  try {
    const body = JSON.parse(text) as { errors?: Record<string, unknown> };
    return Object.keys(body.errors ?? {}).map((k) => k.replace(/^\$\./, "")).filter((k) => /^[A-Za-z_][\w]*$/.test(k));
  } catch {
    return [];
  }
}

export async function getEkoCleaningData(stationId: string): Promise<Row[]> {
  if (!stationId) return [];
  const tried = new Set<string>();
  const queue = [ekoParam || PARAM_GUESSES[0]!];
  let last = { status: 0, text: "" };
  while (queue.length && tried.size < 8) {
    const param = queue.shift()!;
    if (tried.has(param.toLowerCase())) continue;
    tried.add(param.toLowerCase());
    const res = await callCleaning(param, stationId);
    if (res.ok) {
      ekoParam = param;
      return ekoRowsFrom(openDpuReply(parseGatewayText(res.text), 0, true));
    }
    last = res;
    if (res.status !== 400) break;
    console.warn(`[eko] GetEkoCleaningData?${param}= refused (400):`, res.text.slice(0, 400));
    queue.unshift(...paramsFromError(res.text));
    queue.push(...PARAM_GUESSES);
  }
  const body = last.text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  throw new ApiError(`Eko Calibration API error ${last.status}${body ? `: ${body}` : "."}`, "server");
}


/** Columns of the live STIPL Eko Calibration screen (Time / Cycle / Sample Count). */
export const EKO_CALIBRATION_FIELDS: EkoField[] = [
  { label: "Time", aliases: ["Time", "EntryTime", "CleaningTime", "DateTime", "CleaningDateTime", "EntryDate", "CleaningDate", "Date", "CreatedDate"] },
  { label: "Cycle", aliases: ["Cycle", "CycleNo", "Cycles", "CleaningCycle", "NoOfCycle"] },
  { label: "Sample Count", aliases: ["SampleCount", "Samples", "SamplesCount", "NoOfSamples", "SampleNo", "Count"] },
];
