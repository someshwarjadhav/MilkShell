import { ApiError } from "../http/errors";
import { openDpuReply } from "../http/dpu";
import { BASE_URL } from "../config";
import { decodeEkoText, ekoRowsFrom, type EkoField, type EkoRow } from "./ekoShared";


const SMARTX_URL = "https://smartx.shivinfotech.co.in";
const PATH = "/home/GetEkoCorrectionRecords";

async function send(url: string): Promise<Response> {
  return fetch(url, { method: "GET", headers: { Accept: "application/json, text/plain, */*" }, cache: "no-store" });
}

export async function getEkoCorrectionData(stationId: string): Promise<EkoRow[]> {
  if (!stationId) return [];
  const query = `?stationid=${encodeURIComponent(stationId)}`;
  let response: Response;
  try {
    response = await send(`${SMARTX_URL}${PATH}${query}`);
  } catch {
    try {
      response = await send(`${BASE_URL || SMARTX_URL}${PATH}${query}`);
    } catch {
      throw new ApiError("Cannot reach the Eko Correction API. Check your connection and try again.", "network");
    }
  }
  const text = await response.text();
  if (!response.ok) {
    const body = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    throw new ApiError(`Eko Correction API error ${response.status}${body ? `: ${body}` : "."}`, "server");
  }
  return ekoRowsFrom(openDpuReply(decodeEkoText(text), 0, true));
}

/** Columns of the live STIPL Eko Correction screen. */
export const EKO_CORRECTION_FIELDS: EkoField[] = [
  { label: "FatCC", aliases: ["FatCC", "CowFat", "FatCow"] },
  { label: "SNFCC", aliases: ["SNFCC", "CowSnf", "SnfCow"] },
  { label: "FATBC", aliases: ["FATBC", "BuffFat", "BuffaloFat", "FatBuff"] },
  { label: "SNFBC", aliases: ["SNFBC", "BuffSnf", "BuffaloSnf", "SnfBuff"] },
  { label: "FATMC", aliases: ["FATMC", "MixFat", "FatMix"] },
  { label: "SNFMC", aliases: ["SNFMC", "MixSnf", "SnfMix"] },
  { label: "Status", aliases: ["Status", "Flag", "IsActive"] },
];
