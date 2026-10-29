import { clearRequestMemo, gatewayGet } from "../http/client";
import { ApiError } from "../http/errors";
import { GLOBALS } from "../../lib/global";
import { isObj, norm, rowsFrom, type Obj } from "../utils/loose";
import { num } from "../utils/parse";

export const CF_BILL_PATH = "/dairy/dairy/getFarmerBill";

export const plantIdOf = (): string => String(GLOBALS.plantid || "1").trim();

export interface CfLine {
  date: string;
  particulars: string;
  qty: number;
  rate: number;
  sale: number;
  receipt: number;
  mode: string;
  balance: number;
}

export interface CfBill {
  farmerId: string;
  farmerName: string;
  lines: CfLine[];
  totalSale: number;
  totalReceipt: number;
  closing: number;
}

const pick = (r: Obj, names: string[]): unknown => {
  const keys = Object.keys(r);
  for (const n of names) {
    const k = keys.find((x) => norm(x) === n);
    if (k !== undefined && r[k] !== null && r[k] !== undefined) return r[k];
  }
  return undefined;
};
const txt = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

function rowsOf(json: unknown): Obj[] {
  if (typeof json === "string") {
    try {
      return rowsOf(JSON.parse(json));
    } catch {
      return [];
    }
  }
  const direct = rowsFrom(json);
  if (direct.length) return direct;
  if (isObj(json)) for (const v of Object.values(json)) if (Array.isArray(v)) return v.filter(isObj);
  return [];
}

export function parseBills(json: unknown): CfBill[] {
  const bills = new Map<string, CfBill>();
  for (const r of rowsOf(json)) {
    const farmerId = txt(pick(r, ["farmerid", "farmer", "farmercode"]));
    const bill =
      bills.get(farmerId) ??
      ({ farmerId, farmerName: "", lines: [], totalSale: 0, totalReceipt: 0, closing: 0 } as CfBill);
    if (!bill.farmerName) bill.farmerName = txt(pick(r, ["farmername", "name"]));
    const line: CfLine = {
      date: txt(pick(r, ["entrydate", "date"])),
      particulars: txt(pick(r, ["particulars", "particular"])),
      qty: num(pick(r, ["qty", "quantity"])),
      rate: num(pick(r, ["rate"])),
      sale: num(pick(r, ["sale", "sales"])),
      receipt: num(pick(r, ["receipt"])),
      mode: txt(pick(r, ["paymentmode", "mode"])),
      balance: num(pick(r, ["balance"])),
    };
    bill.lines.push(line);
    bill.totalSale += line.sale;
    bill.totalReceipt += line.receipt;
    bill.closing = line.balance;
    bills.set(farmerId, bill);
  }
  return [...bills.values()];
}

export async function getFarmerBills(vlcId: string, from: string, to: string): Promise<CfBill[]> {
  clearRequestMemo();
  const q =
    `${CF_BILL_PATH}?stationid=${encodeURIComponent(vlcId)}` +
    `&fromdate=${encodeURIComponent(from)}&todate=${encodeURIComponent(to)}` +
    `&plantid=${encodeURIComponent(plantIdOf())}`;
  try {
    return parseBills(await gatewayGet(q, 0));
  } catch (e) {
    if (e instanceof ApiError && e.kind === "parse" && /empty/i.test(e.message)) return [];
    throw e;
  }
}
