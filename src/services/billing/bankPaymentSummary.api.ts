import { clearRequestMemo } from "../http/client";
import { dpuGet } from "../http/dpu";
import { ApiError } from "../http/errors";
import { apiDate } from "../utils/date";
import { isObj, norm, rowsFrom, type Obj } from "../utils/loose";
import { num } from "../utils/parse";
import { getCashSummary } from "./cashPaymentSummary.api";

export const PAY_FARMER_PATH = "/Login/MilkBillPaySummMA";

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

/**
 * Names the summary may use for the parts of a figure (the Cash Payment Summary API sends the same data split by milk type:
 * cowqty / buffaloqty, cowcomm / buffcomm, cowtrans / bufftrans, cowdeposit / buffdeposit ...).
 */
const PARTS = {
  qty: [["cowqty", "cowliter", "cowltr"], ["buffaloqty", "buffqty", "buffliter", "buffaloliter"], ["mixqty", "mixliter"]],
  incentive: [["cowcomm", "cowcommission", "cowincentive"], ["buffcomm", "buffcommission", "buffincentive", "buffalocomm"], ["mixcomm"]],
  transport: [["cowtrans", "cowtransport"], ["bufftrans", "bufftransport", "buffalotrans"], ["mixtrans"]],
  deposit: [["cowdeposit", "milkdeposit"], ["buffdeposit", "buffalodeposit"], ["mixdeposit"]],
};
const SINGLE = {
  transport: ["transport", "transportamount", "totaltransport"],
  deposit: ["milkdeposit", "deposit", "totaldeposit"],
  advance: ["advance", "currentadvance", "advanceamount"],
  cattleFeed: ["cattlefeed", "cattlefeedamount"],
};

const found = (row: Obj, names: string[]): number | undefined => {
  const v = lookup(row, names);
  if (v === undefined) return undefined;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
};
/** sum of the parts that exist (undefined when none of them is in the reply) */
const partsSum = (row: Obj, parts: string[][]): number | undefined => {
  const vals = parts.map((p) => found(row, p)).filter((x): x is number => x !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

export function toPayRow(r: Obj, vlcId: string, index: number): PayRow {
  const f = (k: keyof typeof FIELDS) => lookup(r, FIELDS[k]);
  const id = text(f("id"));
  const avgRate = num(f("avgRate"));
  const totalAmount = num(f("totalAmount"));

  // A figure the server leaves at 0 / missing is rebuilt from the same reply instead of being shown as 0.00:
  // quantity from the cow / buffalo parts (or amount / rate), incentive from the commission parts,
  // deduction from deposit + advance + cattle feed, payable = amount + incentive + transport - deductions.
  const qtySent = num(f("totalQty"));
  const totalQty = qtySent || partsSum(r, PARTS.qty) || (avgRate ? r2(totalAmount / avgRate) : 0);
  const incentive = num(f("totalIncentive")) || partsSum(r, PARTS.incentive) || 0;
  const transport = partsSum(r, PARTS.transport) ?? found(r, SINGLE.transport) ?? 0;
  const deposit = partsSum(r, PARTS.deposit) ?? found(r, SINGLE.deposit) ?? 0;
  const advance = found(r, SINGLE.advance) ?? 0;
  const cattleFeed = found(r, SINGLE.cattleFeed) ?? 0;
  const deduction = num(f("deduction")) || r2(deposit + advance + cattleFeed);
  const computed = r2(totalAmount + incentive + transport - deduction);
  // last resort for the name of the field: any field whose name says payable / net payment
  const fuzzyPayable = (() => {
    for (const [k, v] of Object.entries(r)) {
      const n = norm(k);
      if ((n.includes("payable") || n.includes("netpay") || n === "netamt") && !n.includes("avg")) {
        const x = Number(String(v ?? "").replace(/,/g, "").trim());
        if (Number.isFinite(x) && x !== 0) return x;
      }
    }
    return 0;
  })();
  const payable = num(f("payable")) || fuzzyPayable || computed;

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
    avgRate,
    totalQty,
    totalAmount,
    totalIncentive: incentive,
    deduction,
    payable,
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
    const json = await dpuGet(q, 0);
    const list = payRowsOf(json);
    if (import.meta.env.DEV && list[0]) console.info("[payment summary] fields sent by MilkBillPaySummMA:", Object.keys(list[0]));
    return list.map((r, i) => toPayRow(r, vlcId, i));
  } catch (e) {
    if (e instanceof ApiError && e.kind === "parse" && /empty/i.test(e.message)) return [];
    throw e;
  }
}

const idk = (id: string): string => (/^\d+$/.test(id.trim()) ? String(Number(id.trim())) : id.trim().toLowerCase());

/**
 * Qty / incentive / deduction / payable that the payment summary left at 0 are taken from the farmer cash summary
 * (MilkBillPayCashMA) of the same VLC and dates, matched by farmer id - the same figures the Cash Payment Summary shows.
 */
async function fillFromCash(rows: PayRow[], from: string, to: string, vlcIds: string[]): Promise<PayRow[]> {
  if (!rows.some((r) => !r.payable || !r.totalQty)) return rows;
  const by = new Map<string, { qty?: number; inc?: number; ded?: number; pay?: number }>();
  const settled = await Promise.allSettled(vlcIds.map((id) => getCashSummary({ type: "farmer", fromdate: from, todate: to, stationid: id })));
  settled.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    for (const raw of res.value) {
      const m = new Map<string, number>();
      let id = "";
      for (const [k, v] of Object.entries(raw)) {
        const nk = norm(k);
        if (!id && ["farmerid", "codeno", "farmercode"].includes(nk) && String(v ?? "").trim()) id = String(v).trim();
        const x = Number(String(v ?? "").replace(/,/g, "").trim());
        if (String(v ?? "").trim() !== "" && Number.isFinite(x)) m.set(nk, x);
      }
      if (!id) continue;
      const first = (names: string[]) => names.map((n) => m.get(n)).find((x) => x !== undefined);
      const sum = (names: string[]) => {
        const v = names.map((n) => m.get(n)).filter((x): x is number => x !== undefined);
        return v.length ? v.reduce((a, b) => a + b, 0) : undefined;
      };
      const qty = first(["qty", "totalqty", "totalliter", "liter", "ltr"]) ?? sum(["cowqty", "buffaloqty", "buffqty"]);
      const inc = sum(["cowcomm", "buffcomm"]);
      const trans = sum(["cowtrans", "bufftrans"]) ?? 0;
      const dep = sum(["cowdeposit", "buffdeposit"]) ?? 0;
      const adv = m.get("advance") ?? 0;
      const cf = m.get("cattlefeed") ?? 0;
      const amount = first(["amount", "totalamount", "amt"]);
      const sent = first(["payableamount", "payable", "netamount", "netpayable", "netamt"]);
      const ded = r2(dep + adv + cf);
      const pay = sent !== undefined && sent !== 0 ? sent : amount !== undefined ? r2(amount + (inc ?? 0) + trans - ded) : undefined;
      by.set(`${vlcIds[i]}|${idk(id)}`, { qty, inc, ded, pay });
    }
  });
  if (!by.size) return rows;
  return rows.map((r) => {
    const c = by.get(`${r.vlcId}|${idk(r.id)}`);
    if (!c) return r;
    return {
      ...r,
      totalQty: r.totalQty || c.qty || 0,
      totalIncentive: r.totalIncentive || c.inc || 0,
      deduction: r.deduction || c.ded || 0,
      payable: r.payable || c.pay || 0,
    };
  });
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
  return { rows: await fillFromCash(rows, from, to, vlcIds), failed, total: vlcIds.length };
}
