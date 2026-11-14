/**
 * PAYMENT VOUCHER  (money paid to a farmer, Flag = P, TransactionFlag = D)
 * Its own paths, its own payload and its own body formats. Nothing here is
 * shared with the receipt voucher except the low-level transport.
 */
import { checkReply } from "../master/farmerMaster.api";
import { clearRequestMemo } from "../http/client";
import { apiDate } from "../utils/date";
import { norm, rowsFrom, type Obj } from "../utils/loose";
import {
  ledgerOptions,
  toNumber,
  toOption,
  toRow,
  unique,
  type VoucherOption,
  type VoucherRow,
} from "./voucher.common";
import { ApiError } from "../http/errors";
import { readPath, saveVoucherForm, sendPath } from "./voucher.http";
import { getSession } from "../session";

export const PAYMENT_LEDGER_PATH = "/dairy/dairy/getaccountledger";
export const PAYMENT_BILL_HEAD_PATH = "/dairy/dairy/getbillhead";
export const PAYMENT_SAVE_PATH = "/dairy/dairy/paymentvoucher";
export const PAYMENT_LIST_PATH = "/dairy/dairy/paymentvoucherlist";
export const PAYMENT_DELETE_PATH = "/dairy/dairy/paymentvoucherdelete";

/** Fallback only: the real Flag / TransactionFlag are copied from a payment row the live portal already saved. */
const FLAG = "PY";
const TRANSACTION_FLAG = "DR";

const stationOf = (vlcid: string): string =>
  getSession()?.stationByVlcc?.[vlcid] || vlcid;

/** PaymentMode as the portal sends it: 1 = Bank, 2 = Cash (the ledger's AccountType). */
const modeNumber = (mode: string, ledgerType?: string): number =>
  ledgerType === "1" || ledgerType === "2"
    ? Number(ledgerType)
    : mode.trim().toLowerCase() === "cash"
      ? 2
      : 1;

/**
 * Flag / TransactionFlag of a payment: copied from a payment row (DeductionType
 * not 0) that the live portal already saved today, when the list carries them.
 */
function learnFlags(): { flag: string; txn: string } {
  for (const r of RAW_ROWS.values()) {
    if ((deductionOf(r) ?? 0) === 0) continue;
    const get = (name: string): string => {
      const k = Object.keys(r).find((x) => norm(x) === name);
      return k === undefined || r[k] == null ? "" : String(r[k]).trim();
    };
    const flag = get("flag");
    const txn = get("transactionflag");
    if (flag && txn) return { flag, txn };
  }
  return { flag: FLAG, txn: TRANSACTION_FLAG };
}

const SAVE_PATH = PAYMENT_SAVE_PATH;

export interface PaymentVoucherInput {
  vlcid: string;
  farmerId: string;
  date: string;
  amount: string;
  deductionType: string;
  paymentMode: string;
  ledgerId: string;
  narration: string;
  /** Farmer number the portal sends as FarmerMasterCode. */
  farmerCode?: string;
  /** AccountType of the chosen ledger (1 = bank, 2 = cash). */
  ledgerType?: string;
}

export async function getLedgers(): Promise<VoucherOption[]> {
  return ledgerOptions(rowsFrom(await readPath(PAYMENT_LEDGER_PATH)));
}

/** The portal has a single deduction type for payment vouchers: Advance (5000). */
const ADVANCE: VoucherOption = { value: "5000", label: "Advance" };

export async function getDeductionTypes(
  vlcid: string,
): Promise<VoucherOption[]> {
  try {
    const rows = rowsFrom(
      await readPath(
        `${PAYMENT_BILL_HEAD_PATH}?stationid=${encodeURIComponent(vlcid)}`,
      ),
    );
    const all = unique(
      rows
        .map((r) =>
          toOption(
            r,
            [
              "headid",
              "billheadid",
              "deductiontypeid",
              "deductionid",
              "id",
              "code",
            ],
            [
              "headname",
              "billheadname",
              "deductionname",
              "deductiontype",
              "name",
              "description",
            ],
          ),
        )
        .filter((o): o is VoucherOption => !!o),
    );
    const advance = all.find(
      (o) => /advance/i.test(o.label) || o.value === ADVANCE.value,
    );
    return [advance ?? ADVANCE];
  } catch {
    return [ADVANCE];
  }
}

/** DeductionType of a server row (0 for receipts, e.g. 5000 = Advance for payments). */
/** Raw server rows by Id: the portal's delete wants the whole row, like Sale Entry does. */
const RAW_ROWS = new Map<string, Obj>();

const deductionOf = (r: Obj): number | null => {
  const k = Object.keys(r).find((x) => norm(x) === "deductiontype");
  if (k === undefined) return null;
  const n = Number(r[k]);
  return Number.isFinite(n) ? n : null;
};

export async function getPaymentVouchers(
  vlcid: string,
  date: string,
): Promise<VoucherRow[]> {
  const qs = `stationid=${encodeURIComponent(vlcid)}&date=${encodeURIComponent(apiDate(date))}`;
  const raw = rowsFrom(await readPath(`${PAYMENT_LIST_PATH}?${qs}`));
  for (const r of raw) {
    const k = Object.keys(r).find((x) => norm(x) === "id");
    if (k !== undefined && r[k] != null) RAW_ROWS.set(String(r[k]), r);
  }
  // Like the live portal: the list shows every voucher of the day, nothing is filtered out.
  const mine = raw;
  const headOf = (r: Obj): string => {
    const k = Object.keys(r).find((x) => norm(x) === "headname");
    return k === undefined || r[k] == null ? "" : String(r[k]).trim();
  };
  // Like the live portal: Code = DeductionType (e.g. 5000), Name = HeadName (e.g. Advance).
  const rows = mine.map((r, i) => ({
    ...toRow(r, i),
    date: toRow(r, i).date || date,
    code: String(deductionOf(r) ?? ""),
    name: headOf(r),
  }));
  return rows;
}

export async function savePaymentVoucher(
  v: PaymentVoucherInput,
): Promise<string> {
  const learned = learnFlags();
  const fields = {
    StationId: stationOf(v.vlcid),
    FarmerId: String(v.farmerId),
    FarmerMasterCode: toNumber(v.farmerCode || v.farmerId),
    EntryDate: apiDate(v.date),
    Amount: toNumber(v.amount),
    DeductionType: String(v.deductionType),
    PaymentMode: modeNumber(v.paymentMode, v.ledgerType),
    Flag: learned.flag,
    TransactionFlag: learned.txn,
    Narration: v.narration.trim() || "0",
  };
  const text = await saveVoucherForm(
    SAVE_PATH,
    fields,
    async () => (await getPaymentVouchers(v.vlcid, v.date)).length,
    "PaymentVoucher",
  );
  clearRequestMemo();
  return checkReply(text, "The payment voucher could not be saved.", true);
}

const DELETE_KEY = "smartx.paymentVoucher.deleteFormat";
const rememberedDelete = (): string => {
  try {
    return localStorage.getItem(DELETE_KEY) ?? "";
  } catch {
    return "";
  }
};
const rememberDelete = (n: string): void => {
  try {
    localStorage.setItem(DELETE_KEY, n);
  } catch {
    /* ignore */
  }
};

interface DeleteTry {
  name: string;
  path: string;
  init: RequestInit;
}

/**
 * Delete, then CHECK the list: the voucher counts as deleted only when the
 * server really stopped returning it. Formats are tried until one works, and
 * the one that worked is remembered.
 */
export async function deletePaymentVoucher(
  id: string,
  vlcid?: string,
  date?: string,
): Promise<string> {
  const num = /^\d+$/.test(id) ? Number(id) : id;
  const row = { ...(RAW_ROWS.get(id) ?? {}), Id: num, StationId: vlcid ?? "" };
  const json = encodeURIComponent(JSON.stringify(row));
  const q = encodeURIComponent(id);
  const tries: DeleteTry[] = [
    { name: "delete-json-id3", path: `${SAVE_PATH}?json=${json}&id=3`, init: { method: "DELETE" } },
    { name: "get-delete-id", path: `${PAYMENT_DELETE_PATH}?id=${q}`, init: { method: "GET" } },
    { name: "delete-delete-id", path: `${PAYMENT_DELETE_PATH}?id=${q}`, init: { method: "DELETE" } },
  ];
  const known = rememberedDelete();
  const order = [
    ...tries.filter((t) => t.name === known),
    ...tries.filter((t) => t.name !== known),
  ];
  const stillThere = async (): Promise<boolean> =>
    !!vlcid && !!date && (await getPaymentVouchers(vlcid, date)).some((r) => r.id === id);

  const failed: string[] = [];
  for (const t of order) {
    try {
      const text = await sendPath(t.path, () => t.init);
      clearRequestMemo();
      if (!vlcid || !date) return checkReply(text, "The payment voucher could not be deleted.", true);
      if (!(await stillThere())) {
        rememberDelete(t.name);
        console.info(`[PaymentVoucher] deleted using: ${t.name}`);
        return "Deleted";
      }
      failed.push(`${t.name} (no effect)`);
    } catch (e) {
      if (e instanceof ApiError && e.kind === "auth") throw e;
      failed.push(t.name);
      console.warn(`[PaymentVoucher] delete failed with ${t.name}:`, e);
    }
  }
  throw new ApiError(
    `The server did not delete voucher ${id} (tried: ${failed.join(", ")}).`,
    "server",
  );
}
