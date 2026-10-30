import {
  gatewayGet,
  gatewayPostJson,
  gatewayText,
  listOf,
  parseGatewayText,
} from "../http/client";
import { ApiError } from "../http/errors";
import { isObj, pickLike, rowsFrom } from "../utils/loose";
import { pickLoose } from "../farmer/farmerBook";
import type { RawLoose } from "../types/raw";
import type { FarmerInput } from "./farmerMaster.rules";

export interface MasterRecord extends FarmerInput {
  key: string;
}

const VLC_KEYS = ["vlccid", "villageid", "vlcid", "vlccode", "centerid"];

const PHONE = /^\+?\d[\d\s-]{8,14}$/;
function mobileOf(r: RawLoose): string {
  const exact = pickLoose(r, [
    "mobileno",
    "farmercontact",
    "mobile",
    "mobilenumber",
    "phone",
  ]);
  if (exact) return PHONE.test(exact) ? exact : "";
  const loose = pickLike(r, ["mobile", "contact"]);
  return PHONE.test(loose) ? loose : "";
}

export function mapRecord(r: RawLoose, vlccid: string, i = 0): MasterRecord {
  const status = pickLoose(r, [
    "farmerstatus",
    "status",
    "isactive",
    "active",
  ]).toLowerCase();
  const farmerId = pickLoose(r, [
    "farmer",
    "farmerid",
    "farmercode",
    "farmer_id",
  ]);
  return {
    key: `${vlccid}:${farmerId}:${i}`,
    vlccid,
    farmerId,
    name: pickLoose(r, ["farmername", "name"]),
    nameInBank: pickLoose(r, [
      "nameinbank",
      "farmernameasperbank",
      "farmernamebank",
    ]),
    address: pickLoose(r, ["farmeraddress", "address"]),
    mobile: mobileOf(r),
    bank: pickLoose(r, ["farmerbank", "bankname"]),
    ifsc: (
      pickLoose(r, ["bankifsccode", "ifsc", "farmerbankbranch", "ifsccode"]) ||
      pickLike(r, ["ifsc"])
    ).toUpperCase(),
    account:
      pickLoose(r, [
        "farmerbankac",
        "accountno",
        "bankaccountno",
        "farmerbankaccount",
        "accno",
        "bankac",
        "accountnumber",
      ]) ||
      pickLike(r, ["bankac", "accountno", "accountnumber", "bankaccount"]),
    aadhaar:
      pickLoose(r, ["farmeraadhaar", "aadhaar", "aadhaarno", "aadharno"]) ||
      pickLike(r, ["aadhaar", "aadhar"]),
    active: !["false", "0", "inactive", "n", "no"].includes(status),
  };
}

export async function getData(
  ids: string[],
  customToReal: Record<string, string> = {},
): Promise<MasterRecord[]> {
  if (ids.length === 0) return [];
  const known = new Set(ids);
  const resolve = (v: string) => (known.has(v) ? v : (customToReal[v] ?? v));

  const one = async (list: string[]): Promise<RawLoose[]> =>
    listOf<RawLoose>(
      await gatewayPostJson(
        "/home/farmermaster",
        { VillageIds: list.join(",") },
        0,
      ),
    );

  const rows = await one(ids);
  const tagged = rows.map((r) => pickLoose(r, VLC_KEYS));
  let out: Array<{ r: RawLoose; v: string }>;
  if (ids.length === 1) out = rows.map((r) => ({ r, v: ids[0] }));
  else if (tagged.every(Boolean))
    out = rows.map((r, i) => ({ r, v: resolve(tagged[i]) }));
  else {
    const parts = await Promise.all(
      ids.map(async (id) => (await one([id])).map((r) => ({ r, v: id }))),
    );
    out = parts.flat();
  }
  return out.map(({ r, v }, i) => mapRecord(r, v, i)).filter((m) => m.farmerId);
}

export async function getMaxId(vlccid: string): Promise<number | null> {
  const json = await gatewayGet(
    `/home/farmercollectiondpu?id=${encodeURIComponent(vlccid)}`,
    0,
  );
  if (typeof json === "number") return json;
  const best: number[] = [];
  const keys = [
    "maxid",
    "maxfarmerid",
    "max",
    "nextid",
    "farmercode",
    "farmerid",
    "farmer",
  ];
  const rows = Array.isArray(json) || isObj(json) ? rowsFrom(json) : [];
  const flat = rows.length ? rows : isObj(json) ? [json] : [];
  for (const r of flat)
    for (const [k, v] of Object.entries(r)) {
      if (!keys.includes(k.toLowerCase().replace(/[^a-z0-9]/g, ""))) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) best.push(n);
    }
  return best.length ? Math.max(...best) : null;
}

export async function getDataById(
  farmerId: string,
  vlccid: string,
): Promise<MasterRecord | null> {
  const json = await gatewayGet(
    `/home/getfarmer?farmerid=${encodeURIComponent(farmerId)}&vlccid=${encodeURIComponent(vlccid)}`,
    0,
  );
  const row =
    rowsFrom(json)[0] ??
    (isObj(json) && !("success" in json) && !("Success" in json) ? json : null);
  if (!row) return null;
  const rec = mapRecord(row, vlccid);
  return { ...rec, farmerId: rec.farmerId || farmerId };
}

export function toPayload(f: FarmerInput, isEdit = false) {
  return {
    farmer: String(f.farmerId).trim(),
    farmername: f.name.trim(),
    address: f.address.trim(),
    mobileno: f.mobile,
    vlccid: String(f.vlccid),
    rfid: null,
    bankcode: f.bank.trim(),
    bnkaccno: f.account,
    bnkifsc: f.ifsc.trim().toUpperCase(),
    nameinbank: f.nameInBank.trim(),
    farmeraadhaar: f.aadhaar,
    farmerstatus: f.active ? "1" : "0",
    action: isEdit ? "update" : "insert",
  };
}

export function toExcelPayload(f: FarmerInput) {
  return {
    farmerid: Number(f.farmerId),
    farmername: f.name.trim(),
    nameinbank: f.nameInBank.trim(),
    farmeraddress: f.address.trim(),
    farmercontact: f.mobile,
    farmerbank: f.bank.trim(),
    bankifsccode: f.ifsc.trim().toUpperCase(),
    farmerbankac: f.account,
    farmerstatus: f.active ? 1 : 0,
    villageid: Number(f.vlccid),
    farmeraadhaar: f.aadhaar,
  };
}

const BAD_LENIENT = /(fail|error|exception|invalid|not\s+(saved|updated))/i;
const BAD_TEXT =
  /(fail|error|exception|invalid|not\s+(saved|deleted|updated|found)|already|duplicate|exist)/i;

export function checkReply(
  text: string,
  fallback: string,
  lenient = false,
): string {
  const t = text.replace(/[\r\n]+/g, " ").trim();
  if (t.startsWith("<"))
    throw new ApiError(
      "The server returned a web page instead of data.",
      "parse",
    );
  let parsed: unknown = t;
  try {
    parsed = parseGatewayText(t);
  } catch {
    parsed = t;
  }
  if (isObj(parsed)) {
    const ok = parsed.Success ?? parsed.success;
    const msg = String(
      parsed.Message ?? parsed.message ?? parsed.msg ?? "",
    ).trim();
    if (ok === false || String(ok).toLowerCase() === "false")
      throw new ApiError(msg || fallback, "server");
    return msg;
  }
  if (
    typeof parsed === "string" &&
    parsed &&
    (lenient ? BAD_LENIENT : BAD_TEXT).test(parsed) &&
    !/^(data\s+)?(saved|updated|deleted|success)/i.test(parsed)
  ) {
    throw new ApiError(parsed.slice(0, 200), "server");
  }
  return typeof parsed === "string" ? parsed : "";
}

export async function postData(
  f: FarmerInput,
  isEdit = false,
): Promise<string> {
  const json = JSON.stringify([toPayload(f, isEdit)]);
  const text = await gatewayText(
    `/home/farmersave?json=${encodeURIComponent(json)}`,
    { method: "POST" },
  );
  return checkReply(
    text,
    isEdit
      ? "The farmer could not be updated."
      : "The farmer could not be saved.",
    isEdit,
  );
}

export async function postExcel(list: FarmerInput[]): Promise<string> {
  const body = new FormData();
  body.append("json", JSON.stringify(list.map(toExcelPayload)));
  const text = await gatewayText("/home/farmersavelist/", {
    method: "POST",
    body,
  });
  return checkReply(text, "The farmers could not be imported.");
}

export interface StatusChange {
  vlccid: string;
  farmerId: string;
  active: boolean;
}

export async function updateFarmerStatus(all: StatusChange[]): Promise<string> {
  const byVillage = new Map<string, { off: string[]; on: string[] }>();
  for (const c of all) {
    const g = byVillage.get(c.vlccid) ?? { off: [], on: [] };
    (c.active ? g.on : g.off).push(String(c.farmerId));
    byVillage.set(c.vlccid, g);
  }
  let last = "";
  for (const [villageid, g] of byVillage) {
    const text = await gatewayText("/dairy/dairy/updateFarmerStatus", {
      method: "POST",
      body: JSON.stringify({
        villageid: String(villageid),
        farmerid0: g.off.join(","),
        farmerid1: g.on.join(","),
      }),
      headers: { "Content-Type": "application/json" },
    });
    last = checkReply(text, "The status could not be updated.");
  }
  return last;
}
