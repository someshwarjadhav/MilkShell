import {
  dpuGet,
  dpuSaveAttempts,
  encryptedShapes,
  type SaveAttempt,
} from "../http/dpu";
import { DPU } from "../http/dpuEndpoints";
import { clearRequestMemo } from "../http/client";
import { encryptXorPayload } from "../../lib/crypto";
import { isNoRecord, unwrapObj } from "../http/dpuHelpers";
import { ApiError } from "../http/errors";
import { isObj, norm } from "../utils/loose";

export const CN_LIST_PATH = DPU.farmerMasterCN;
export const CN_SAVE_PATH = DPU.farmerMasterCNEntry;

export interface CategoryOption {
  id: string;
  label: string;
  flag: string;
}

export const CATEGORIES: CategoryOption[] = [
  { id: "incentive", label: "Incentive", flag: "CM" },
  { id: "transport", label: "Transport", flag: "TN" },
  { id: "milkdeposit", label: "Milk Deposit", flag: "MD" },
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
  console.log(
    `[StdDeduction] LOAD farmers -> GET ${CN_LIST_PATH}?${qs}\n` +
      `   vlcid=${vlcid}  flag=${flag}  effectiveDate=${effectiveDate}`,
  );
  const reply = await dpuGet(`${CN_LIST_PATH}?${qs}`, 0); // already decrypted by dpu.ts
  const json = unwrapObj(reply, ["FarmerList", "CommisionList"]);
  console.log(
    `[StdDeduction] decrypted reply keys: ${
      isObj(reply)
        ? Object.keys(reply).join(", ") || "(empty object)"
        : typeof reply
    }  |  list found: ${json ? "yes" : "NO (unexpected shape)"}`,
  );
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
  const out = { farmers: farmers.filter((f) => !have.has(f.farmerId)), saved };
  console.log(
    `[StdDeduction] parsed: ${farmers.length} farmers in FarmerList, ${saved.length} already saved (CommisionList), ` +
      `${out.farmers.length} shown on the left`,
  );
  if (saved.length) console.table(saved);
  if (out.farmers.length) console.table(out.farmers.slice(0, 15));
  return out;
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

const VLC_NOT_FOUND =
  /no\s*vlcc?\s*found|error\s*in\s*data|vlcc?\s*(id\s*)?(is\s*)?(not\s*found|required|missing)/i;

export function saveLayouts(
  s: CnSave,
  path: string = CN_SAVE_PATH,
): SaveAttempt[] {
  const xor = (v: unknown) => ({ Payload: encryptXorPayload(v) });
  const num = (v: string) =>
    v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v;
  const n0 = (v: string) =>
    v === "" || !Number.isFinite(Number(v)) ? 0 : Number(v);
  const money = (v: string) => n0(v).toFixed(2);

  const portal = (
    o: {
      ids?: "text" | "number";
      rates?: "number" | "money";
      pascalRows?: boolean;
    } = {},
  ) => {
    const idv = (v: string) => (o.ids === "number" ? num(v) : v);
    const rate = (v: string) => (o.rates === "money" ? money(v) : n0(v));
    return {
      StationId: idv(s.vlcid),
      Flag: s.flag,
      EffectiveDate: s.effectiveDate,
      Details: s.rows.map((r) =>
        o.pascalRows
          ? {
              FarmerId: idv(r.farmerId),
              FarmerName: r.farmerName,
              CodeNo: idv(r.farmerId),
              Cow: rate(r.cow),
              Buff: rate(r.buff),
              Mix: rate(r.mix),
            }
          : {
              farmerid: idv(r.farmerId),
              farmername: r.farmerName,
              codeno: idv(r.farmerId),
              Cow: rate(r.cow),
              Buff: rate(r.buff),
              Mix: rate(r.mix),
            },
      ),
    };
  };

  const attempts: SaveAttempt[] = [
    { label: "xor-portal-exact", path, body: xor(portal()) },
    {
      label: "xor-portal-exact-money",
      path,
      body: xor(portal({ rates: "money" })),
    },
    {
      label: "xor-portal-data-text",
      path,
      body: xor({ data: JSON.stringify(portal()) }),
    },
    {
      label: "xor-portal-Data-text",
      path,
      body: xor({ Data: JSON.stringify(portal()) }),
    },
    {
      label: "xor-portal-numeric-ids",
      path,
      body: xor(portal({ ids: "number" })),
    },
    {
      label: "xor-portal-pascal-rows",
      path,
      body: xor(portal({ pascalRows: true })),
    },
    { label: "xor-old-layout", path, body: xor(toPayload(s)) },
  ];
  try {
    attempts.push({
      label: "aes-portal-exact",
      path,
      body: encryptedShapes(portal())[0],
    });
  } catch {
    /* no AES key: the XOR layouts are enough */
  }
  return attempts;
}

export async function saveCommission(s: CnSave): Promise<string> {
  console.log(
    `[StdDeduction] SAVE -> POST ${CN_SAVE_PATH}\n` +
      `   vlcid=${s.vlcid}  flag=${s.flag}  effectiveDate=${s.effectiveDate}  rows=${s.rows.length}`,
  );
  console.table(s.rows);
  if (!s.vlcid)
    console.error(
      "[StdDeduction] SAVE blocked: vlcid is EMPTY - the centre list did not load.",
    );
  const message = await dpuSaveAttempts(
    "FarmerMasterCNEntry",
    saveLayouts(s),
    "POST",
    VLC_NOT_FOUND,
  );
  clearRequestMemo();
  console.log(
    `[StdDeduction] SAVE ok, server message: "${message || "(empty)"}"`,
  );
  return message || "Saved";
}
