import { pickLoose } from "../farmer/farmerBook";
import { isoFromTrdate } from "../utils/date";
import type { Obj } from "../utils/loose";

export interface VoucherOption {
  value: string;
  label: string;
  /** Ledger AccountType from the server: 0 = general, 1 = bank, 2 = cash. */
  type?: string;
}

export interface VoucherRow {
  key: string;
  id: string;
  code: string;
  name: string;
  farmerId: string;
  farmerName: string;
  date: string;
  amount: number;
  narration: string;
  /** Raw "Flag" of the row (R = receipt, P = payment) when the server sends it. */
  flag: string;
  /** Raw "TransactionFlag" of the row (C = credit, D = debit) when sent. */
  txn: string;
}

export const PAYMENT_MODES: VoucherOption[] = [
  { value: "Bank", label: "Bank" },
  { value: "Cash", label: "Cash" },
];

export const isIsoDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function normaliseDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  return isoFromTrdate(s) ?? s;
}

export const farmerCode = (id: string): string =>
  /^\d+$/.test(id) ? id.padStart(4, "0") : id;

export const cleanAccount = (v: string): string =>
  /^\d[\d\s-]*$/.test(v.trim()) ? v.replace(/\D/g, "") : "";

export const toNumber = (v: string): number => {
  const n = parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const plainValues = (r: Obj): string[] =>
  Object.values(r)
    .filter((v) => typeof v === "string" || typeof v === "number")
    .map((v) => String(v).trim())
    .filter(Boolean);

export function toOption(
  r: Obj,
  idKeys: string[],
  nameKeys: string[],
): VoucherOption | null {
  const values = plainValues(r);
  const value = pickLoose(r, idKeys) || values[0] || "";
  if (!value) return null;
  const label =
    pickLoose(r, nameKeys) || values.find((v) => v !== value) || value;
  return { value, label };
}

export const unique = (list: VoucherOption[]): VoucherOption[] => {
  const seen = new Set<string>();
  return list.filter((o) =>
    seen.has(o.value) ? false : (seen.add(o.value), true),
  );
};

export function toRow(r: Obj, i: number): VoucherRow {
  const id = pickLoose(r, [
    "id",
    "voucherid",
    "paymentid",
    "paymentvoucherid",
    "receiptid",
    "receiptno",
    "voucherno",
  ]);
  return {
    key: `${id || "row"}:${i}`,
    id,
    code: pickLoose(r, [
      "code",
      "headcode",
      "deductioncode",
      "deductiontypeid",
      "ledgercode",
    ]),
    name: pickLoose(r, [
      "name",
      "headname",
      "deductionname",
      "ledgername",
      "billheadname",
      "farmername",
    ]),
    farmerId: pickLoose(r, [
      "farmerid",
      "farmer",
      "farmermastercode",
      "farmercode",
    ]),
    farmerName: pickLoose(r, ["farmername", "farmer_name"]),
    date: normaliseDate(
      pickLoose(r, ["entrydate", "date", "trdate", "voucherdate"]),
    ),
    amount: toNumber(pickLoose(r, ["amount", "amt", "total"])),
    narration: pickLoose(r, ["narration", "remarks"]),
    flag: pickLoose(r, ["flag", "vouchertype", "vouchertypeflag"]),
    txn: pickLoose(r, ["transactionflag", "txnflag"]),
  };
}

/**
 * The portal lists receipts and payments from the same endpoint
 * (paymentvoucherlist). Keep only the rows that belong to this page.
 * If the reply carries no recognisable flags, nothing is filtered.
 */
export function onlyVoucherKind(
  rows: VoucherRow[],
  flag: "R" | "P",
): VoucherRow[] {
  const txn = flag === "R" ? "C" : "D";
  const known = (r: VoucherRow) =>
    /^[RP]/i.test(r.flag) || /^[CD]/i.test(r.txn);
  if (!rows.some(known)) return rows;
  return rows.filter((r) => {
    if (/^[RP]/i.test(r.flag)) return r.flag.toUpperCase().startsWith(flag);
    if (/^[CD]/i.test(r.txn)) return r.txn.toUpperCase().startsWith(txn);
    return true;
  });
}

export const ledgerOptions = (rows: Obj[]): VoucherOption[] =>
  unique(
    rows
      .map((r) => {
        const o = toOption(
          r,
          [
            "ledgerid",
            "accountledgerid",
            "accountid",
            "id",
            "ledgercode",
            "code",
          ],
          ["ledgername", "accountledgername", "accountname", "name", "ledger"],
        );
        if (!o) return null;
        const type = pickLoose(r, ["accounttype", "ledgertype", "type"]);
        return type ? { ...o, type } : o;
      })
      .filter((o): o is VoucherOption => !!o),
  );

/**
 * Same rule as the portal: Bank mode lists the bank ledgers (AccountType 1),
 * Cash mode lists the cash ledgers (AccountType 2). General ledgers such as
 * Sale / Purchase / Receipt (AccountType 0) are never offered for a voucher.
 */
export function ledgersForMode(
  all: VoucherOption[],
  mode: string,
): VoucherOption[] {
  const want = mode.trim().toLowerCase() === "cash" ? "2" : "1";
  if (all.some((o) => o.type !== undefined)) {
    const exact = all.filter((o) => o.type === want);
    return exact.length ? exact : all.filter((o) => o.type !== "0");
  }
  const cashy = (o: VoucherOption) => /\bcash\b/i.test(o.label);
  const byName = all.filter((o) => (want === "2" ? cashy(o) : !cashy(o)));
  return byName.length ? byName : all;
}
