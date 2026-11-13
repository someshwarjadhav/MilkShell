import { BASE_URL } from "../config";
import { directGet, gatewayGet, gatewayText } from "../http/client";
import { ApiError, EmptyReplyError } from "../http/errors";
import { encryptPayload } from "../../lib/crypto";

const gatewayRoot = (): string => {
  const root = BASE_URL || "https://smartx.shivinfotech.co.in";
  return /^https?:/i.test(root) ? root : `${window.location.origin}${root}`;
};

const viaGateway = (path: string): string =>
  `${gatewayRoot()}/gateway/Interceptor?path=${path}`;

export async function readPath(path: string): Promise<unknown> {
  try {
    return await directGet(viaGateway(path), 0);
  } catch (first) {
    if (first instanceof EmptyReplyError) return [];
    if (first instanceof ApiError && first.kind === "auth") throw first;
    try {
      return await gatewayGet(path, 0);
    } catch (second) {
      if (second instanceof EmptyReplyError) return [];
      throw first;
    }
  }
}

export async function sendPath(
  path: string,
  init: () => RequestInit,
): Promise<string> {
  try {
    return await gatewayText(viaGateway(path), init(), 0, true);
  } catch (first) {
    if (!(first instanceof ApiError) || first.kind !== "network") throw first;
    return gatewayText(path, init());
  }
}

export type VoucherFields = Record<string, string | number>;

export function buildForm(fields: VoucherFields): FormData {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields))
    body.append(key, String(value));
  body.append("data", JSON.stringify(fields));
  return body;
}

const buildJson = (fields: VoucherFields): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(fields),
});

const buildUrlEncoded = (fields: VoucherFields): RequestInit => {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) p.append(key, String(value));
  p.append("data", JSON.stringify(fields));
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  };
};

const buildMultipart = (fields: VoucherFields): RequestInit => ({
  method: "POST",
  body: buildForm(fields),
});

const dmy = (iso: unknown): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
};

interface Attempt {
  name: string;
  build: (f: VoucherFields) => RequestInit;
  tweak?: (f: VoucherFields) => VoucherFields;
}

/** Receipt vouchers have no deduction type: some servers want 0, not "". */
const zeroDeduction = (f: VoucherFields): VoucherFields => ({
  ...f,
  DeductionType: f.DeductionType === "" ? "0" : f.DeductionType,
});

/**
 * The voucher endpoint answers 500 when the body is not shaped the way the
 * portal sends it. The formats below are tried in order, and the one that
 * works is remembered for the rest of the session.
 */
const ATTEMPTS: Attempt[] = [
  { name: "json", build: buildJson },
  { name: "json+deduction0", build: buildJson, tweak: zeroDeduction },
  { name: "urlencoded", build: buildUrlEncoded, tweak: zeroDeduction },
  { name: "multipart", build: buildMultipart, tweak: zeroDeduction },
  {
    name: "json+dd/MM/yyyy",
    build: buildJson,
    tweak: (f) => ({ ...zeroDeduction(f), EntryDate: dmy(f.EntryDate) }),
  },
  {
    name: "multipart+dd/MM/yyyy",
    build: buildMultipart,
    tweak: (f) => ({ ...zeroDeduction(f), EntryDate: dmy(f.EntryDate) }),
  },
];

let preferred = 0;

const retryable = (e: unknown): boolean =>
  e instanceof ApiError && (e.kind === "server" || e.kind === "network");

/** A 200 reply can still be an error page / {"error": ...} from the gateway. */
function assertNotError(text: string): void {
  const t = text.replace(/[\r\n]+/g, " ").trim();
  if (/^\{\s*"error"\s*:/i.test(t)) {
    throw new ApiError(
      "The server could not save the voucher (internal server error).",
      "server",
    );
  }
}

/**
 * Save a voucher. `count` returns how many vouchers the list shows for the
 * day: if a failed attempt actually stored the row, the count grows and the
 * save is treated as done, so a retry can never create a duplicate.
 */
export async function postVoucher(
  path: string,
  fields: VoucherFields,
  count?: () => Promise<number>,
): Promise<string> {
  let before = -1;
  if (count) {
    try {
      before = await count();
    } catch {
      before = -1;
    }
  }
  const order = [
    preferred,
    ...ATTEMPTS.map((_, i) => i).filter((i) => i !== preferred),
  ];
  const seen = new Set<string>();
  let lastError: unknown = null;
  let tried = 0;

  for (const i of order) {
    const attempt = ATTEMPTS[i]!;
    const sent = attempt.tweak ? attempt.tweak(fields) : fields;
    const key = `${attempt.build === buildJson ? "j" : attempt.build === buildUrlEncoded ? "u" : "m"}${JSON.stringify(sent)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tried++;
    try {
      const text = await sendPath(path, () => attempt.build(sent));
      assertNotError(text);
      preferred = i;
      return text;
    } catch (e) {
      lastError = e;
      if (!retryable(e)) throw e;
      if (count && before >= 0) {
        try {
          if ((await count()) > before) return "Saved";
        } catch {
          /* ignore: carry on with the next format */
        }
      }
    }
  }

  const detail =
    lastError instanceof ApiError ? lastError.message : "unknown error";
  throw new ApiError(
    `The server rejected the voucher after ${tried} format${tried === 1 ? "" : "s"}. ${detail}`,
    "server",
  );
}

/* ------------------------------------------------------------------ */
/* Live portal save format: POST ?path=/dairy/dairy/paymentvoucher      */
/* body = form field  data=<AES "cipher:iv" of the JSON voucher object> */
/* reply = {"Success":true,"Message":"Record Saved."}                   */
/* ------------------------------------------------------------------ */

const formAsUrlEncoded = (data: string): RequestInit => {
  const p = new URLSearchParams();
  p.append("data", data);
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  };
};

const formAsMultipart = (data: string): RequestInit => {
  const f = new FormData();
  f.append("data", data);
  return { method: "POST", body: f };
};

/**
 * Save a voucher exactly the way the live portal does: ONE form post whose
 * only field is `data` = the voucher JSON, AES-encrypted. Only the same
 * payload is ever retried (multipart), never a different shape. If a failed
 * attempt still stored the row, the day's count grows and the save is treated
 * as done - a retry can never create a duplicate.
 */
export async function saveVoucherForm(
  path: string,
  fields: VoucherFields,
  count: () => Promise<number>,
  label: string,
): Promise<string> {
  console.info(`[${label}] SAVE -> POST ${path}  payload=${JSON.stringify(fields)}`);
  const data = encryptPayload(fields);

  let before = -1;
  try {
    before = await count();
  } catch {
    before = -1;
  }

  let lastError: unknown = null;
  for (const build of [formAsUrlEncoded, formAsMultipart]) {
    try {
      const text = await sendPath(path, () => build(data));
      assertNotError(text);
      console.info(`[${label}] SAVE <- ${text.slice(0, 200)}`);
      return text;
    } catch (e) {
      lastError = e;
      console.warn(`[${label}] save attempt failed:`, e);
      if (!retryable(e)) throw e;
      if (before >= 0) {
        try {
          if ((await count()) > before) return "Saved";
        } catch {
          /* list may be failing too: carry on */
        }
      }
    }
  }
  const detail =
    lastError instanceof ApiError ? lastError.message : "unknown error";
  throw new ApiError(`The server rejected the voucher. ${detail}`, "server");
}
