import { gatewayGet, gatewayText, listOf } from "../http/client";
import { ApiError } from "../http/errors";
import { isObj, pick, pickValue, rowsFrom, type Obj } from "../utils/loose";
import { checkReply } from "./farmerMaster.api";
import { getSession } from "../session";

export interface VlcRoute {
  routeId: string;
  routeName: string;
}

export interface VlcSlots {
  startId: string;
  endId: string;
  allocated: string;
  used: string;
  available: string;
  nextVillageId: string;
}

export interface VlcRecord {
  key: string;

  villageId: string;

  displayId: string;
  villageName: string;
  agentName: string;
  contact: string;
  address: string;
  active: boolean;
  pcbNo: string;
  ekoPass: string;
  type: string;
  routeId: string;
  rateId: string;
  dpuId: string;
}

export interface VlcInput {
  villageId: string;
  villageName: string;
  type: string;
  active: boolean;
  agentName: string;
  contact: string;
  pcbNo: string;
  currentPass: string;
  newPass: string;
  passApply: boolean;
}

export const emptyVlc = (nextId = ""): VlcInput => ({
  villageId: nextId,
  villageName: "",
  type: "Cooperative Society",
  active: true,
  agentName: "",
  contact: "",
  pcbNo: "",
  currentPass: "",
  newPass: "",
  passApply: false,
});

export const VLC_TYPES = ["Cooperative Society", "Private", "Individual"];

const q = encodeURIComponent;

const asObj = (json: unknown): Obj => {
  if (Array.isArray(json)) return (json.find(isObj) as Obj | undefined) ?? {};
  if (isObj(json)) {
    const inner = json.Data ?? json.data;
    if (isObj(inner)) return inner;
    if (Array.isArray(inner))
      return (inner.find(isObj) as Obj | undefined) ?? {};
    return json;
  }
  return {};
};

export async function getMccRoute(
  mccid: string,
  plantid: string,
): Promise<VlcRoute[]> {
  const json = await gatewayGet(
    `/home/getMccRoute?mccid=${q(mccid)}&plantid=${q(plantid)}`,
    0,
  );
  return rowsFrom(json)
    .map((r) => ({
      routeId: pick(r, ["routeid", "id"]),
      routeName: pick(r, ["routename", "name"]),
    }))
    .filter((r) => r.routeId);
}

export async function getMaxVlcc(
  mccid: string,
  plantid: string,
): Promise<VlcSlots | null> {
  const json = await gatewayGet(
    `/home/getMaxVlcc?mccid=${q(mccid)}&plantid=${q(plantid)}`,
    0,
  );
  const o = asObj(json);
  const s = (...k: string[]) => {
    const v = pickValue(o, k);
    return v === undefined || v === null ? "" : String(v).trim();
  };
  const out: VlcSlots = {
    startId: s("startid"),
    endId: s("endid"),
    allocated: s("allocatedslots", "allocated_slots"),
    used: s("usedslots", "used_slots"),
    available: s("availableslots", "available_slots"),
    nextVillageId: s("nextvillageid", "next_villageid"),
  };

  return Object.values(out).some(Boolean) ? out : null;
}

const flag = (v: string) =>
  !["0", "false", "inactive", "n", "no", "closed"].includes(v.toLowerCase());

function mapVillage(r: Obj, i: number, routeId: string): VlcRecord {
  const villageId = pick(r, ["villageid", "vlccid", "vlcid"]);
  const status = pick(r, ["villagestatus", "status", "isactive"]);
  const ses = getSession();

  const displayId =
    pick(r, ["customstationid", "customvillageid", "stationid"]) ||
    ses?.stationByVlcc?.[villageId] ||
    villageId;
  const villageName =
    pick(r, ["villageagentaddress"]) ||
    ses?.vlccNames?.[villageId] ||
    pick(r, ["villagename", "vlcname", "name"]);
  return {
    key: `${villageId || "x"}:${i}`,
    villageId,
    displayId,
    villageName,
    agentName: pick(r, ["villageagentname", "agentname", "beneficiaryname"]),
    contact: pick(r, ["villageagentcontact", "contact", "mobile"]),
    address: pick(r, ["villageagentaddress", "address"]),
    active: status === "" ? true : flag(status),
    pcbNo: pick(r, ["pcbsrno", "ekopcbno", "pcbno", "pcbserialno"]),
    ekoPass: pick(r, ["ekopass", "euppass"]),
    type: pick(r, ["type", "vlctype"]),
    routeId: pick(r, ["routeid"]) || routeId,
    rateId: pick(r, ["villagerateid", "rateid"]),
    dpuId: pick(r, ["dpuid"]),
  };
}

export async function getVillageDetails(
  mccid: string,
  routeid: string,
): Promise<VlcRecord[]> {
  const json = await gatewayGet(
    `/home/getVillageDetails?mccid=${q(mccid)}&routeid=%20${q(routeid)}`,
    0,
  );
  return listOf<Obj>(json).map((r, i) => mapVillage(r, i, routeid));
}

export async function getVillageById(
  villageid: string,
): Promise<VlcRecord | null> {
  const json = await gatewayGet(
    `/home/getVillageId?villageid=${q(villageid)}`,
    0,
  );
  const o = asObj(json);
  return Object.keys(o).length ? mapVillage(o, 0, "") : null;
}

export function toPayload(
  f: VlcInput,
  ctx: { mccid: string; routeid: string; userId: string; rateId?: string },
) {
  return {
    villageid: f.villageId.trim(),
    villagename: f.villageName.trim(),
    villageagentname: f.agentName.trim(),
    villageagentcontact: f.contact.trim(),
    routeid: ctx.routeid,
    mccid: ctx.mccid,
    villagestatus: f.active ? "1" : "0",
    villagerateid: ctx.rateId ?? "",
    createdby: ctx.userId,
    type: f.type,
    ekopcbno: f.pcbNo.trim(),
    ekopass: f.currentPass,
    ekonewpass: f.newPass,
    ekopassflag: f.passApply ? "1" : "0",
  };
}

async function post(path: string, body: unknown, fallback: string) {
  const text = await gatewayText(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return checkReply(text, fallback);
}

export const createVillage = (
  f: VlcInput,
  ctx: Parameters<typeof toPayload>[1],
) =>
  post("/home/createVillage", toPayload(f, ctx), "The VLC could not be saved.");

export const updateVillage = (
  f: VlcInput,
  ctx: Parameters<typeof toPayload>[1],
) =>
  post(
    "/home/updateVillage",
    toPayload(f, ctx),
    "The VLC could not be updated.",
  );

export const assertConfigured = (mccid: string, plantid: string) => {
  if (!mccid || !plantid)
    throw new ApiError(
      "MCC id / Plant id is missing in your login record. Please sign in again.",
      "config",
    );
};
