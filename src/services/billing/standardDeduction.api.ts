import { gatewayGet, gatewayText } from "../http/client";
import { ApiError } from "../http/errors";
import { isObj, norm } from "../utils/loose";
import { checkReply } from "../master/farmerMaster.api";

export const CN_LIST_PATH = "/dairy/dairy/FarmerMasterCN";
export const CN_SAVE_PATH = "/dairy/dairy/FarmerMasterCNEntry";

export interface CategoryOption {
  id: string;
  label: string;
  flag: string;
}

export const CATEGORIES: CategoryOption[] = [
  { id: "incentive", label: "Incentive", flag: "CM" },
  { id: "transport", label: "Transport", flag: "TN" }, // TODO verify on the Standard Deduction page
  { id: "milkdeposit", label: "Milk Deposit", flag: "MD" }, // TODO confirm
];

export interface CnFarmer {
  farmerId: string;
  farmerName: string;
}

export interface CnRow extends CnFarmer {
  cow: string;
  buff: string;
  mix: string;
}

export interface CnData {
  farmers: CnFarmer[];
  saved: CnRow[];
}

const text = (v: unknown): string =>
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

export async function getFarmers(
  vlcid: string,
  flag: string,
  effectiveDate: string,
): Promise<CnData> {
  const qs =
    `id=${encodeURIComponent(vlcid)}` +
    `&flag=${encodeURIComponent(flag)}` +
    `&effectivedate=${encodeURIComponent(effectiveDate)}`;
  const json = await gatewayGet(`${CN_LIST_PATH}?${qs}`, 0);
  if (!isObj(json))
    throw new ApiError("The server reply has an unexpected shape.", "parse");

  const farmers: CnFarmer[] = listAt(json, "FarmerList")
    .map((r) => ({
      farmerId: field(r, ["farmerid", "codeno"]),
      farmerName: field(r, ["farmername", "name"]),
    }))
    .filter((f) => f.farmerId);

  const saved: CnRow[] = listAt(json, "CommisionList")
    .map((r) => ({
      farmerId: field(r, ["farmerid", "codeno"]),
      farmerName: field(r, ["farmername", "name"]),
      cow: field(r, ["cow", "cowrate", "cowvalue"]),
      buff: field(r, ["buff", "buffalo", "buffrate", "buffvalue"]),
      mix: field(r, ["mix", "mixrate", "mixvalue"]),
    }))
    .filter((r) => r.farmerId);

  const have = new Set(saved.map((s) => s.farmerId));
  return { farmers: farmers.filter((f) => !have.has(f.farmerId)), saved };
}

export interface CnSave {
  vlcid: string;
  flag: string;
  effectiveDate: string;
  rows: CnRow[];
}

export const toPayload = (s: CnSave) => ({
  StationId: s.vlcid,
  Flag: s.flag,
  EffectiveDate: s.effectiveDate,
  Details: s.rows.map((r) => ({
    FarmerId: r.farmerId,
    FarmerName: r.farmerName,
    Cow: r.cow === "" ? 0 : Number(r.cow),
    Buff: r.buff === "" ? 0 : Number(r.buff),
    Mix: r.mix === "" ? 0 : Number(r.mix),
  })),
});

export async function saveCommission(s: CnSave): Promise<string> {
  const body = new FormData();
  body.append("data", JSON.stringify(toPayload(s)));
  const reply = await gatewayText(CN_SAVE_PATH, { method: "POST", body });
  return checkReply(reply, "The standard deduction could not be saved.", true);
}
