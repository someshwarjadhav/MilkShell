import { clearRequestMemo, gatewayGet } from "../http/client";
import { ApiError } from "../http/errors";
import { apiDate } from "../utils/date";
import { isObj, norm, rowsFrom, type Obj } from "../utils/loose";
import { num } from "../utils/parse";

export const PAY_FARMER_PATH = "/home/MilkBillPaySummma";

export type PayType = "farmer";

export const PAY_TYPES: Array<{ id: PayType; label: string }> = [
  { id: "farmer", label: "Farmer" },
];

export interface PayRow {
  key: string;
  vlcId: string;
  id: string;
  name: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  avgFat: number;
  avgSnf: number;
  avgRate: number;
  totalQty: number;
  totalAmount: number;
  totalIncentive: number;
  deduction: number;
  payable: number;
}

const FIELDS: Record<
  Exclude<keyof PayRow, "key" | "vlcId">,
  string[]
> = {
  id: ["farmerid", "id", "codeno", "farmercode", "vlcid", "vlccid", "villageid", "code", "memberid"],
  name: ["farmername", "name", "vlcname", "vlccname", "villagename", "membername"],
  bankName: ["bankname", "bank", "banknm"],
  accountNo: ["accountno", "accountnumber", "accno", "acno", "bankaccountno", "accountnum"],
  ifsc: ["ifsc", "ifsccode", "ifscno"],
  avgFat: ["avgfat", "averagefat", "fat", "afat"],
  avgSnf: ["avgsnf", "averagesnf", "snf", "asnf"],
  avgRate: ["avgrate", "averagerate", "rate", "arate"],
  totalQty: ["totalqty", "totalquantity", "qty", "weight", "totalweight", "totalliter", "totalliters"],
  totalAmount: ["totalamount", "totalamt", "amount", "amt", "milkamount"],
  totalIncentive: ["totalincentive", "incentive", "incentiveamount", "totalincentiveamount"],
  deduction: ["deductionamount", "deduction", "totaldeduction", "dedamount", "deductionamt"],
  payable: ["payableamount", "payable", "netpayable", "netamount", "netpayment", "payamount"],
};

const lookup = (row: Obj, names: string[]): unknown => {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((x) => norm(x) === n);
    if (k !== undefined && row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== "") return row[k];
  }
  return undefined;
};

const text = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

export function payRowsOf(json: unknown): Obj[] {
  if (typeof json === "string") {
    try {
      return payRowsOf(JSON.parse(json));
    } catch {
      return [];
    }
  }
  const direct = rowsFrom(json);
  if (direct.length) return direct;
  if (isObj(json)) {
    for (const v of Object.values(json)) {
      if (Array.isArray(v)) {
        const rows = v.filter(isObj);
        if (rows.length) return rows;
      }
      if (isObj(v)) {
        const inner = payRowsOf(v);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

export function toPayRow(r: Obj, vlcId: string, index: number): PayRow {
  const f = (k: keyof typeof FIELDS) => lookup(r, FIELDS[k]);
  const id = text(f("id"));
  return {
    key: `${vlcId}|${id}|${index}`,
    vlcId,
    id,
    name: text(f("name")),
    bankName: text(f("bankName")),
    accountNo: text(f("accountNo")),
    ifsc: text(f("ifsc")),
    avgFat: num(f("avgFat")),
    avgSnf: num(f("avgSnf")),
    avgRate: num(f("avgRate")),
    totalQty: num(f("totalQty")),
    totalAmount: num(f("totalAmount")),
    totalIncentive: num(f("totalIncentive")),
    deduction: num(f("deduction")),
    payable: num(f("payable")),
  };
}

export interface PayResult {
  rows: PayRow[];
  failed: Array<{ vlcId: string; message: string }>;
  total: number;
}

async function one(type: PayType, from: string, to: string, vlcId: string): Promise<PayRow[]> {
  const path = PAY_FARMER_PATH;
  void type;
  const q =
    `${path}?id=0&fromdate=${encodeURIComponent(apiDate(from))}` +
    `&todate=${encodeURIComponent(apiDate(to))}` +
    `&stationid=${encodeURIComponent(vlcId)}`;
  try {
    const json = await gatewayGet(q, 0);
    return payRowsOf(json).map((r, i) => toPayRow(r, vlcId, i));
  } catch (e) {
    if (e instanceof ApiError && e.kind === "parse" && /empty/i.test(e.message)) return [];
    throw e;
  }
}

export async function getPaymentSummary(
  type: PayType,
  from: string,
  to: string,
  vlcIds: string[],
): Promise<PayResult> {
  clearRequestMemo();
  const settled = await Promise.allSettled(vlcIds.map((id) => one(type, from, to, id)));
  const rows: PayRow[] = [];
  const failed: PayResult["failed"] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") rows.push(...s.value);
    else
      failed.push({
        vlcId: vlcIds[i],
        message: s.reason instanceof Error ? s.reason.message : "The request failed.",
      });
  });
  if (failed.length === vlcIds.length && vlcIds.length > 0) throw new ApiError(failed[0].message, "server");
  return { rows, failed, total: vlcIds.length };
}
