import { dpuGet } from "../http/dpu";
import { DPU } from "../http/dpuEndpoints";
import {
  dpuSaveShapes,
  isNoRecord,
  stationKeys,
  unwrapObj,
} from "../http/dpuHelpers";
import { ApiError } from "../http/errors";
import { isObj, norm } from "../utils/loose";
import type {
  CategoryOption,
  CnData,
  CnFarmer,
  CnRow,
} from "./standardDeduction.api.ts";

export const VLC_LIST_PATH = DPU.farmerMasterVlccDed;
export const VLC_SAVE_PATH = DPU.villageMasterCNEntry;

export const VLC_CATEGORIES: CategoryOption[] = [
  { id: "incentive", label: "Incentive", flag: "CM" },
  { id: "transport", label: "Transport", flag: "TN" },
  { id: "milkdeposit", label: "Milk Deposit", flag: "MD" }, // TODO confirm
];

const text = (v: unknown) =>
  v === null || v === undefined ? "" : String(v).trim();

function field(r: Record<string, unknown>, names: string[]): string {
  const wanted = names.map(norm);
  for (const k of Object.keys(r))
    if (wanted.includes(norm(k))) return text(r[k]);
  return "";
}

const listAt = (
  o: Record<string, unknown>,
  name: string,
): Record<string, unknown>[] => {
  const key = Object.keys(o).find((k) => norm(k) === norm(name));
  const v = key ? o[key] : undefined;
  return Array.isArray(v) ? v.filter(isObj) : [];
};

const nameOf = (r: Record<string, unknown>) =>
  field(r, ["villageagentname"]) || field(r, ["villagename"]);

export async function getVlcs(
  vlcIds: string[],
  flag: string,
  effectiveDate: string,
): Promise<CnData> {
  const qs =
    `id=${vlcIds.map(encodeURIComponent).join(",")}` +
    `&flag=${encodeURIComponent(flag)}` +
    `&effectivedate=${encodeURIComponent(effectiveDate)}`;
  const reply = await dpuGet(`${VLC_LIST_PATH}?${qs}`, 0);
  const json = unwrapObj(reply, ["AgentList", "CommisionList"]);
  if (!json) {
    if (
      isNoRecord(reply) ||
      (isObj(reply) &&
        (reply.Success ?? reply.success) !== false &&
        !Object.keys(reply).length)
    )
      return { farmers: [], saved: [] };
    throw new ApiError("The server reply has an unexpected shape.", "parse");
  }

  const farmers: CnFarmer[] = listAt(json, "AgentList")
    .map((r) => ({ farmerId: field(r, ["villageid"]), farmerName: nameOf(r) }))
    .filter((f) => f.farmerId);

  const saved: CnRow[] = listAt(json, "CommisionList")
    .map((r) => ({
      farmerId: field(r, ["villageid"]),
      farmerName: nameOf(r),
      cow: field(r, ["cow"]),
      buff: field(r, ["buff"]),
      mix: field(r, ["mix"]),
    }))
    .filter((r) => r.farmerId);

  const have = new Set(saved.map((s) => s.farmerId));
  const left = farmers.filter((f) => !have.has(f.farmerId));
  console.log(
    `[VLC Standard Deduction] LIST loaded -> ${left.length} not yet set (left table), ${saved.length} already saved (right table)`,
    { query: qs, saved },
  );
  return { farmers: left, saved };
}

export interface VlcSave {
  stationId: string;
  flag: string;
  effectiveDate: string;
  rows: CnRow[];
}

const num = (v: string) => (v === "" ? 0 : Number(v));

const head = (s: VlcSave) => ({
  StationId: s.stationId,
  Flag: s.flag,
  EffectiveDate: s.effectiveDate,
});

export const toVlcPayload = (s: VlcSave) => ({
  ...head(s),
  Details: s.rows.map((r) => ({
    farmerid: r.farmerId,
    farmername: r.farmerName,
    Cow: num(r.cow),
    Buff: num(r.buff),
    Mix: num(r.mix),
    Type: s.flag,
  })),
});

const toVillagePayload = (s: VlcSave) => ({
  ...head(s),
  Details: s.rows.map((r) => ({
    villageid: r.farmerId,
    villagename: r.farmerName,
    Cow: num(r.cow),
    Buff: num(r.buff),
    Mix: num(r.mix),
    Type: s.flag,
  })),
});

const toVlcPascalPayload = (s: VlcSave) => ({
  ...head(s),
  Details: s.rows.map((r) => ({
    FarmerId: r.farmerId,
    FarmerName: r.farmerName,
    Cow: num(r.cow),
    Buff: num(r.buff),
    Mix: num(r.mix),
    Type: s.flag,
  })),
});

export async function saveVlcCommission(s: VlcSave): Promise<string> {
  console.group(
    `[VLC Standard Deduction] SUBMIT  station ${s.stationId}, flag ${s.flag}, date ${s.effectiveDate}, ${s.rows.length} row(s)`,
  );
  console.table(s.rows);
  console.groupEnd();
  const message = await dpuSaveShapes("VillageMasterCNEntry", VLC_SAVE_PATH, [
    toVlcPayload(s),
    { ...toVlcPayload(s), ...stationKeys(s.stationId) },
    toVillagePayload(s),
    toVlcPascalPayload(s),
  ]);
  return message || "Saved";
}
