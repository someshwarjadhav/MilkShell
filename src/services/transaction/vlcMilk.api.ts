import { clearRequestMemo, listOf } from "../http/client";
import { dpuGet, dpuSaveAttempts, withNumbers } from "../http/dpu";
import { encryptXorPayload } from "../../lib/crypto";

// DPU API: https://dpu.shivinfotech.co.in/api/Login/<endpoint>
export const VLC_MILK_LIST_PATH = "/Login/VlcMilkCollection";
export const VLC_MILK_SAVE_PATH = "/Login/MilkCollectionvlc";

export type VlcMilkRow = Record<string, unknown>;

// GET /api/Login/VlcMilkCollection?vlccid=&shift=&entrydate=
export const getVlcMilk = async (
  vlccid: string,
  shift: string,
  entrydate: string,
): Promise<VlcMilkRow[]> =>
  listOf<VlcMilkRow>(
    await dpuGet(
      `${VLC_MILK_LIST_PATH}?vlccid=${encodeURIComponent(vlccid)}&shift=${encodeURIComponent(shift)}&entrydate=${encodeURIComponent(entrydate)}`,
      1,
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

// POST /api/Login/MilkCollectionvlc
// Body { "Payload": "<XOR + base64>" }. The server decrypts it and reads the ROOT as a list
// (System.Collections.Generic.List<SmartXAccess...>), so the decrypted JSON must be an ARRAY: [ { ...entry } ].
// Wrapping it as { data: "..." } / { id: "..." } makes the server answer
// "The JSON value could not be converted to System.Collections.Generic.List ... Path: $ | BytePositionInLine: 1".
const NUMBER_FIELDS = ["qty", "fat", "snf", "clr", "rtpl", "amount"];
const pascal = (rows: Array<Record<string, unknown>>) =>
  rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v])));

export async function postVlcMilk(entry: VlcMilkEntry): Promise<string> {
  const rows = [buildVlcMilkPayload(entry)] as Array<Record<string, unknown>>;
  const nums = withNumbers(rows, NUMBER_FIELDS);
  const xor = (v: unknown) => ({ Payload: encryptXorPayload(v) });
  const path = VLC_MILK_SAVE_PATH;
  const message = await dpuSaveAttempts("MilkCollectionvlc", [
    { label: "xor-array-numbers", path, body: xor(nums) },
    { label: "xor-array-strings", path, body: xor(rows) },
    { label: "xor-array-pascal-numbers", path, body: xor(pascal(nums)) },
    { label: "xor-array-pascal-strings", path, body: xor(pascal(rows)) },
  ]);
  clearRequestMemo();
  return message;
}
