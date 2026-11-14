import { clearRequestMemo } from "../http/client";
import { getSession } from "../session";
import { ApiError } from "../http/errors";
import { GLOBALS } from "../../lib/global";
import { apiDate } from "../utils/date";
import { isObj, norm, type Obj } from "../utils/loose";
import { checkReply } from "../master/farmerMaster.api";
import { readPath, sendPath } from "../account/voucher.http";

export const VENDOR_PATH = "/dairy/dairy/VenderMasterDN/";
export const ITEM_PATH = "/dairy/dairy/getItemMaster";
export const STOCK_PATH = "/dairy/dairy/itemstock";
export const SALES_PATH = "/dairy/dairy/salespurchase";

export type SaleCategory = "S" | "P";
export const CATEGORIES: Array<{ value: SaleCategory; label: string }> = [
  { value: "S", label: "Sale" },
  { value: "P", label: "Purchase" },
];

export const TYPES: Array<{ value: string; label: string }> = [
  { value: "F", label: "Farmer Sale" },
  { value: "V", label: "VLC Sale" },
];
export const typesFor = (
  category: SaleCategory,
): Array<{ value: string; label: string }> =>
  category === "P" ? TYPES : TYPES.filter((t) => t.value === "F");

export const SALE_FLAG = "SA";
export const PURCHASE_FLAG = "PU";
export const wireFlag = (c: SaleCategory): string =>
  c === "P" ? PURCHASE_FLAG : SALE_FLAG;

export const stationOf = (vlcid: string): string =>
  getSession()?.stationByVlcc?.[vlcid] || vlcid;

export interface Option {
  id: string;
  label: string;
}
export interface ItemOption extends Option {
  rate: string;
}

export interface SaleRow {
  key: string;
  id: string;
  date: string;
  stationId: string;
  farmerId: string;
  farmerName: string;
  item: string;
  qty: string;
  rate: string;
  amount: string;
  flag: string;
  raw: Obj;
}

const q = encodeURIComponent;
const log = (...a: unknown[]) => console.log("[SaleEntry]", ...a);
const cut = (v: unknown, n = 600) => {
  let t: string;
  try {
    t = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    t = String(v);
  }
  return t.length > n ? `${t.slice(0, n)}... (${t.length} chars)` : t;
};

export const plantIdOf = (): string => String(GLOBALS.plantid || "1").trim();

const txt = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

function pick(r: Obj, wanted: string[]): string {
  const keys = Object.keys(r);
  for (const w of wanted) {
    const k = keys.find((x) => norm(x) === w);
    if (k === undefined) continue;
    const v = txt(r[k]);
    if (v) return v;
  }
  return "";
}

const LISTY = [
  "data",
  "message",
  "result",
  "results",
  "table",
  "rows",
  "items",
  "list",
  "response",
];

export function rowsOf(json: unknown, depth = 0): Obj[] {
  if (depth > 5 || json === null || json === undefined) return [];
  if (typeof json === "string") {
    const t = json.trim();
    if (!/^[[{]/.test(t)) return [];
    try {
      return rowsOf(JSON.parse(t), depth + 1);
    } catch {
      return [];
    }
  }
  if (Array.isArray(json)) return json.filter(isObj);
  if (isObj(json)) {
    for (const k of Object.keys(json)) {
      if (!LISTY.includes(norm(k))) continue;
      const got = rowsOf(json[k], depth + 1);
      if (got.length) return got;
    }
  }
  return [];
}

function assertOk(reply: unknown, what: string) {
  if (!isObj(reply)) return;
  const ok = reply.Success ?? reply.success;
  const msg = txt(reply.Message ?? reply.message);
  if (
    (ok === false || String(ok).toLowerCase() === "false") &&
    !/no\s*(record|data)/i.test(msg)
  )
    throw new ApiError(msg || `${what} failed.`, "server");
}

async function read(what: string, path: string): Promise<unknown> {
  log(`${what} -> GET ${path}`);
  const reply = await readPath(path);
  log(`${what} <- reply:`, cut(reply));
  assertOk(reply, what);
  return reply;
}

export async function getItems(plantId: string): Promise<ItemOption[]> {
  const rows = rowsOf(
    await read("items", `${ITEM_PATH}?plantid=${q(plantId)}`),
  );
  const out = rows
    .map((r) => {
      const id = pick(r, ["itemid", "itemcode", "id", "code"]);
      const name = pick(r, ["itemname", "name", "item", "description"]);
      return {
        id,
        label: name || id,
        rate: pick(r, [
          "salerate",
          "sellingrate",
          "salesrate",
          "rate",
          "price",
          "mrp",
        ]),
      };
    })
    .filter((o) => o.id);
  log(`items parsed: ${out.length}`);
  if (rows.length && !out.length)
    log("items: no id column found in", cut(rows[0]));
  return out;
}

export async function getVendors(vlcid: string): Promise<Option[]> {
  const rows = rowsOf(await read("vendors", `${VENDOR_PATH}?id=${q(vlcid)}`));
  const out = rows
    .map((r) => {
      const id = pick(r, [
        "vendorid",
        "venderid",
        "vendorcode",
        "vendercode",
        "id",
        "code",
      ]);
      const name = pick(r, ["vendorname", "vendername", "name"]);
      return { id, label: name ? `${id} | ${name}` : id };
    })
    .filter((o) => o.id);
  log(`vendors parsed: ${out.length}`);
  return out;
}

export async function getStock(
  plantId: string,
  itemId: string,
  fromIso: string,
  toIso: string,
): Promise<string> {
  const path =
    `${STOCK_PATH}?vlccid=${q(plantId)}&fromdate=${q(apiDate(fromIso))}` +
    `&todate=${q(apiDate(toIso))}&plantid=${q(plantId)}`;
  const reply = await read("stock", path);
  let rows = rowsOf(reply);
  if (!rows.length && isObj(reply)) rows = [reply];
  const mine =
    rows.find((r) => pick(r, ["itemid", "itemcode", "id"]) === itemId) ??
    (rows.length === 1 && !pick(rows[0]!, ["itemid", "itemcode"])
      ? rows[0]
      : undefined);
  if (!mine) {
    log(`stock: no row for item ${itemId} in ${rows.length} row(s)`);
    return "";
  }
  const stock = pick(mine, [
    "curstock",
    "stock",
    "closingstock",
    "balance",
    "balqty",
    "closing",
    "availablestock",
    "qty",
  ]);
  log(
    `stock of item ${itemId}: ${stock || "(no stock column found in " + cut(mine, 200) + ")"}`,
  );
  return stock;
}

export interface SaleQuery {
  vlcid: string;
  date: string; // yyyy-mm-dd
  flag: SaleCategory;
  plantId: string;
}

const listJson = (p: SaleQuery) =>
  JSON.stringify({
    StationId: stationOf(p.vlcid),
    PlantId: p.plantId,
    SalesFlag: wireFlag(p.flag),
    EntryDate: apiDate(p.date),
    FromDate: apiDate(p.date),
    ToDate: apiDate(p.date),
  });

function toRow(r: Obj, i: number): SaleRow {
  const id = pick(r, [
    "id",
    "salesid",
    "salespurchaseid",
    "maxid",
    "transid",
    "apptransid",
  ]);
  return {
    key: id || `row${i}`,
    id,
    date: pick(r, ["entrydate", "date", "saledate", "trdate"]),
    stationId: pick(r, ["stationid", "vlccid", "villageid"]),
    farmerId: pick(r, ["farmerid", "farmermastercode", "vendorid", "codeno"]),
    farmerName: pick(r, ["farmername", "vendorname", "name"]),
    item: pick(r, ["itemname", "item", "itemid"]),
    qty: pick(r, ["qty", "quantity"]),
    rate: pick(r, ["rate"]),
    amount: pick(r, ["amount", "totalamount"]),
    flag: pick(r, ["salesflag", "flag"]),
    raw: r,
  };
}

export async function getSales(p: SaleQuery): Promise<SaleRow[]> {
  const json = listJson(p);
  const reply = await read("list", `${SALES_PATH}?json=${q(json)}&id=2`);
  const rows = rowsOf(reply).map(toRow);
  log(`list parsed: ${rows.length} row(s)`);
  if (rows.length)
    console.table(rows.slice(0, 15).map(({ raw: _raw, ...rest }) => rest));
  return rows;
}

export interface SaleInput {
  vlcid: string;
  category: SaleCategory;
  farmerId: string;
  date: string;
  itemId: string;
  qty: number;
  rate: number;
  paid: number;
  plantId: string;
}

const money = (n: number) => Math.round(n * 100) / 100;
const two = (n: number) => money(n).toFixed(2);
const idValue = (v: string): string | number =>
  /^\d+$/.test(v) ? Number(v) : v;

// The old portal posts this as a *form* (not a JSON body):  json=[{...}]  and  id=5
// (see the Network > Payload screenshot of /dairy/dairy/salespurchase).
const SAVE_ID = "5";
const asUrlEncoded = (json: string): RequestInit => {
  const p = new URLSearchParams();
  p.append("json", json);
  p.append("id", SAVE_ID);
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  };
};
const asMultipart = (json: string): RequestInit => {
  const f = new FormData();
  f.append("json", json);
  f.append("id", SAVE_ID);
  return { method: "POST", body: f };
};

export async function saveSale(s: SaleInput): Promise<string> {
  const fields = {
    farmerId: idValue(s.farmerId),
    farmerMasterCode: idValue(s.farmerId),
    EntryDate: apiDate(s.date),
    ItemId: String(s.itemId),
    Qty: two(s.qty),
    Rate: two(s.rate),
    Amount: two(s.qty * s.rate),
    PaidAmount: String(s.paid),
    SalesFlag: wireFlag(s.category),
    BranchId: s.plantId,
    AppTransID: "0",
    lastsyncdate: apiDate(new Date().toISOString().slice(0, 10)),
    StationId: stationOf(s.vlcid),
    PlantId: s.plantId,
  };
  const json = JSON.stringify([fields]);
  log(`SAVE -> POST ${SALES_PATH}  json=${json}  id=${SAVE_ID}`);

  const query: SaleQuery = {
    vlcid: s.vlcid,
    date: s.date,
    flag: s.category,
    plantId: s.plantId,
  };
  let before = -1;
  try {
    before = (await getSales(query)).length;
  } catch {
    before = -1;
  }

  let text = "";
  let lastError: unknown = null;
  for (const build of [asUrlEncoded, asMultipart]) {
    try {
      text = await sendPath(SALES_PATH, () => build(json));
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      const retry =
        e instanceof ApiError && (e.kind === "server" || e.kind === "network");
      if (!retry) throw e;

      if (before >= 0) {
        try {
          if ((await getSales(query)).length > before) {
            lastError = null;
            text = "Record saved";
            break;
          }
        } catch {
          /* carry on with the next format */
        }
      }
    }
  }
  if (lastError) throw lastError;

  log(`SAVE <- reply: ${cut(text)}`);
  clearRequestMemo();
  return (
    checkReply(text, "The entry could not be saved.", true) || "Record saved"
  );
}

export async function deleteSale(row: SaleRow, p: SaleQuery): Promise<string> {
  const json = JSON.stringify({
    ...row.raw,
    Id: row.id,
    StationId: stationOf(p.vlcid),
    SalesFlag: wireFlag(p.flag),
  });
  log(`DELETE -> ${SALES_PATH}?json=${cut(json, 300)}&id=3`);
  const text = await sendPath(`${SALES_PATH}?json=${q(json)}&id=3`, () => ({
    method: "DELETE",
  }));
  log(`DELETE <- reply: ${cut(text)}`);
  clearRequestMemo();
  return checkReply(text, "The entry could not be deleted.", true) || "Deleted";
}
