import { gatewayGet, gatewayText } from "../http/client";
import { ApiError } from "../http/errors";
import { isObj, norm } from "../utils/loose";
import { checkReply } from "../master/farmerMaster.api";
import type {
  CategoryOption,
  CnData,
  CnFarmer,
  CnRow,
} from "./standardDeduction.api";

export const VLC_LIST_PATH = "/dairy/dairy/FarmerMasterVlccDed";
export const VLC_SAVE_PATH = "/dairy/dairy/villagemastercnentry";

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
  const json = await gatewayGet(`${VLC_LIST_PATH}?${qs}`, 0);
  if (!isObj(json))
    throw new ApiError("The server reply has an unexpected shape.", "parse");

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
  return { farmers: farmers.filter((f) => !have.has(f.farmerId)), saved };
}

export interface VlcSave {
  stationId: string;
  flag: string;
  effectiveDate: string;
  rows: CnRow[];
}

export const toVlcPayload = (s: VlcSave) => ({
  StationId: s.stationId,
  Flag: s.flag,
  EffectiveDate: s.effectiveDate,
  Details: s.rows.map((r) => ({
    FarmerId: r.farmerId,
    FarmerName: r.farmerName,
    Cow: r.cow === "" ? 0 : Number(r.cow),
    Buff: r.buff === "" ? 0 : Number(r.buff),
    Mix: r.mix === "" ? 0 : Number(r.mix),
    Type: s.flag,
  })),
});

export async function saveVlcCommission(s: VlcSave): Promise<string> {
  const body = new FormData();
  body.append("data", JSON.stringify(toVlcPayload(s)));
  const reply = await gatewayText(VLC_SAVE_PATH, { method: "POST", body });
  return checkReply(
    reply,
    "The VLC standard deduction could not be saved.",
    true,
  );
}
