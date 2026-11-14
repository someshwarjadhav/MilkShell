import { gatewayText, parseGatewayText, type Priority } from "./client";
import { getSession } from "../session";
import { ApiError, EmptyReplyError } from "./errors";
import {
  decryptPayload,
  decryptXorPayload,
  encryptPayload,
  hasEncryptionKey,
} from "../../lib/crypto";
import { DPU_HOST } from "./dpuEndpoints";

export const DPU_BASE = (
  import.meta.env.VITE_DPU_BASE_URL || `${DPU_HOST}/api`
).replace(/\/+$/, "");

export const dpuUrl = (path: string): string =>
  `${DPU_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const B64 = /^[A-Za-z0-9+/_-]{16,}={0,2}$/;
const AES_PACKED = /^[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{16,}$/;

const looksJson = (t: string) => /^[[{]/.test(t.trim());

function parseCutOffJson(
  text: string,
): { value: unknown; complete: boolean } | undefined {
  const t = text.trim();
  try {
    return { value: JSON.parse(t), complete: true };
  } catch {
    /* fall through: try to repair */
  }
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let cut: { at: number; open: string[] } | undefined;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      stack.pop();
      cut = { at: i + 1, open: [...stack] };
    }
  }
  if (!cut) return undefined;
  const closers = [...cut.open]
    .reverse()
    .map((o) => (o === "{" ? "}" : "]"))
    .join("");
  try {
    return { value: JSON.parse(t.slice(0, cut.at) + closers), complete: false };
  } catch {
    return undefined;
  }
}

export function openDpuReply(v: unknown, depth = 0, salvage = false): unknown {
  if (depth > 6) return v;
  if (typeof v === "string") {
    if (looksJson(v)) {
      const got = salvage
        ? parseCutOffJson(v)
        : (() => {
            try {
              return { value: JSON.parse(v) as unknown, complete: true };
            } catch {
              return undefined;
            }
          })();
      if (!got) return v;
      if (!got.complete) {
        console.warn(
          `[dpu] the server reply was cut off after ${v.length} characters (invalid JSON). Only the complete entries before the cut are used - the API must return the full JSON.`,
        );
      }
      return openDpuReply(got.value, depth + 1, salvage);
    }
    const t = v.replace(/\s+/g, "");
    let opened: unknown = v;
    try {
      if (AES_PACKED.test(t)) opened = decryptPayload(t);
      else if (B64.test(t)) opened = decryptXorPayload(t);
    } catch {
      return v;
    }
    if (typeof opened === "string")
      return looksJson(opened) ? openDpuReply(opened, depth + 1, salvage) : v;
    return typeof opened === "object" && opened !== null
      ? openDpuReply(opened, depth + 1, salvage)
      : v;
  }
  if (isObj(v)) {
    for (const k of Object.keys(v)) {
      if (!["data", "response", "result", "payload"].includes(k.toLowerCase()))
        continue;
      const inner = v[k];
      if (typeof inner !== "string") continue;
      const opened = openDpuReply(inner, depth + 1, salvage);
      if (opened !== inner) return opened;
    }
  }
  return v;
}

function stillEncrypted(reply: unknown): boolean {
  if (!isObj(reply)) return false;
  return Object.keys(reply).some((k) => {
    if (!["data", "response", "result", "payload"].includes(k.toLowerCase()))
      return false;
    const inner = reply[k];
    if (typeof inner !== "string") return false;
    const t = inner.replace(/\s+/g, "");
    return AES_PACKED.test(t) || B64.test(t);
  });
}

/**
 * Console note for every DPU reply. Pretty-printing a big decrypted reply (thousands of rows) into the console froze the
 * page for seconds, so only a short summary is printed; the full JSON is printed only if localStorage "smartx:debug" = "1".
 */
function logReply(label: string, reply: unknown): void {
  try {
    if (localStorage.getItem("smartx:debug") === "1") {
      console.log(
        `${label} - decrypted JSON:\n${JSON.stringify(reply, null, 2)}`,
      );
      return;
    }
  } catch {
    /* no localStorage */
  }
  const n = Array.isArray(reply) ? reply.length : undefined;
  console.debug(
    `${label} - reply ready${n === undefined ? "" : ` (${n} rows)`}`,
  );
}

const SHOW = 400;
const cut = (t: string, n = SHOW) =>
  t.length > n ? `${t.slice(0, n)}... (${t.length} chars)` : t;

export function plainBody(body: BodyInit | null | undefined): string {
  if (body === undefined || body === null) return "(no body)";
  if (typeof body !== "string") return "[non-text body]";
  try {
    const j: unknown = JSON.parse(body);
    if (isObj(j)) {
      const k = Object.keys(j).find((x) => x.toLowerCase() === "payload");
      if (k && typeof j[k] === "string") {
        const opened = openDpuReply(j[k]);
        if (opened !== j[k]) return JSON.stringify(opened, null, 2);
      }
    }
    return JSON.stringify(j, null, 2);
  } catch {
    return cut(body);
  }
}

const looksEncryptedText = (t: string) =>
  !/^\s*[[{]/.test(t) ||
  /"(data|response|result|payload)"\s*:\s*"[A-Za-z0-9+/=_:-]{16,}"/i.test(t);

function logRequest(label: string, url: string, init: RequestInit) {
  const sent = typeof init.body === "string" ? cut(init.body, 160) : "(none)";
  console.log(
    `${label} >>> REQUEST\nURL: ${url}\nBody sent (encrypted, first chars): ${sent}\nBody plain (before encryption):\n${plainBody(init.body)}`,
  );
}

function logRaw(label: string, text: string) {
  console.log(
    `${label} <<< RAW REPLY (${looksEncryptedText(text) ? "ENCRYPTED" : "plain JSON"}), ${text.length} chars:\n${cut(text)}`,
  );
}

async function loggedText(
  label: string,
  path: string,
  init: RequestInit,
  priority: Priority,
  timeoutMs?: number,
): Promise<string> {
  const url = dpuUrl(path);
  logRequest(label, url, init);
  try {
    const text = await gatewayText(url, init, priority, true, timeoutMs ? { timeoutMs } : {});
    logRaw(label, text);
    return text;
  } catch (e) {
    console.error(
      `${label} !!! FAILED before a reply could be read: ${e instanceof Error ? e.message : String(e)}`,
      e,
    );
    throw e;
  }
}

async function dpuSend(
  path: string,
  init: RequestInit,
  priority: Priority,
  timeoutMs?: number,
): Promise<unknown> {
  const label = `[dpu] ${init.method ?? "GET"} ${path}`;
  const text = await loggedText(label, path, init, priority, timeoutMs);
  const reply = openDpuReply(parseGatewayText(text), 0, true);
  if (stillEncrypted(reply)) {
    console.error(
      `${label} - reply could not be decrypted (check VITE_ENCRYPTION_KEY). Raw reply:`,
      text.slice(0, 500),
    );
    throw new ApiError(
      "The DPU reply is encrypted and could not be decrypted. Check VITE_ENCRYPTION_KEY in .env.local.",
      "parse",
    );
  }
  logReply(label, reply);
  return reply;
}

export const dpuGet = (
  path: string,
  priority: Priority = 1,
  /** shorter timeout than the default (a slow request then frees its slot early) */
  timeoutMs?: number,
): Promise<unknown> => dpuSend(path, { method: "GET" }, priority, timeoutMs);

export const dpuPostJson = (
  path: string,
  body: Record<string, unknown>,
  priority: Priority = 1,
): Promise<unknown> =>
  dpuSend(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    priority,
  );

async function dpuWrite(
  path: string,
  init: RequestInit,
  priority: Priority,
): Promise<unknown> {
  const label = `[dpu] ${init.method ?? "POST"} ${path}`;
  const text = await loggedText(label, path, init, priority);
  let reply: unknown;
  try {
    reply = openDpuReply(parseGatewayText(text), 0, true);
  } catch (e) {
    if (e instanceof EmptyReplyError) throw e;
    if (
      e instanceof ApiError &&
      e.kind === "parse" &&
      text.trim() &&
      !text.trim().startsWith("<")
    ) {
      console.log(`${label} <<< TEXT REPLY (not JSON): ${text.slice(0, 500)}`);
      return text.trim();
    }
    throw e;
  }
  if (stillEncrypted(reply)) {
    console.error(
      `${label} - reply could not be decrypted (check VITE_ENCRYPTION_KEY). Raw reply:`,
      text.slice(0, 500),
    );
    throw new ApiError(
      "The DPU reply is encrypted and could not be decrypted. Check VITE_ENCRYPTION_KEY in .env.local.",
      "parse",
    );
  }
  logReply(label, reply);
  return reply;
}

export const dpuPost = (
  path: string,
  body?: BodyInit,
  priority: Priority = 1,
): Promise<unknown> =>
  dpuWrite(
    path,
    body === undefined ? { method: "POST" } : { method: "POST", body },
    priority,
  );

export const dpuPut = (
  path: string,
  body?: BodyInit,
  priority: Priority = 1,
): Promise<unknown> =>
  dpuWrite(
    path,
    body === undefined ? { method: "PUT" } : { method: "PUT", body },
    priority,
  );

export async function dpuSave(
  path: string,
  body?: BodyInit,
  method: "POST" | "PUT" | "DELETE" = "POST",
  headers?: Record<string, string>,
): Promise<string> {
  let reply: unknown;
  try {
    const init: RequestInit = { method };
    if (body !== undefined) init.body = body;
    if (headers) init.headers = headers;
    reply = await dpuWrite(path, init, 1);
  } catch (e) {
    if (e instanceof EmptyReplyError) return "";
    throw e;
  }
  if (typeof reply === "string") {
    if (/^(error|fail|exception)/i.test(reply.trim()))
      throw new ApiError(reply.trim(), "server");
    return reply.trim();
  }
  if (typeof reply === "number") return String(reply); // e.g. updateMilkEntry answers with just the new rate
  if (!isObj(reply)) return "";
  const inner = reply.data ?? reply.Data;
  const message = String(
    reply.Message ??
      reply.message ??
      (typeof inner === "string" ? inner : "") ??
      "",
  ).trim();
  const flag = reply.Success ?? reply.success ?? reply.status ?? reply.Status;
  if (
    flag === false &&
    !/^(done|success|saved|ok|insert|record)/i.test(message)
  ) {
    throw new ApiError(
      message || "The portal did not save this entry.",
      "server",
    );
  }
  return message;
}

export async function dpuSaveJson(
  path: string,
  variants: unknown[],
  method: "POST" | "PUT" = "POST",
): Promise<string> {
  let last: unknown;
  for (let i = 0; i < variants.length; i++) {
    try {
      return await dpuSave(path, JSON.stringify(variants[i]), method, {
        "Content-Type": "application/json",
      });
    } catch (e) {
      last = e;
      const refused =
        e instanceof ApiError &&
        /error (400|415|422)\b|^no\s*data\b/i.test(e.message.trim());
      console.warn(
        `[dpu] ${method} ${path} - body shape ${i + 1}/${variants.length} refused:`,
        e instanceof Error ? e.message : e,
      );
      if (!refused) throw e;
    }
  }
  throw last;
}

export const withNumbers = (
  rows: Array<Record<string, unknown>>,
  names: string[],
): Array<Record<string, unknown>> =>
  rows.map((r) => {
    const o: Record<string, unknown> = { ...r };
    for (const n of names) {
      const v = o[n];
      if (
        typeof v === "string" &&
        v.trim() !== "" &&
        Number.isFinite(Number(v))
      )
        o[n] = Number(v);
    }
    return o;
  });

export function encryptedShapes(...values: unknown[]): unknown[] {
  if (!hasEncryptionKey())
    throw new ApiError(
      "VITE_ENCRYPTION_KEY is missing in .env.local. Add it and restart `npm run dev`.",
      "config",
    );
  return values.map((v) => ({ Payload: encryptPayload(v) }));
}

export interface SaveAttempt {
  label: string;
  path: string;
  body: unknown;
}

const winningLabel = new Map<string, string>();
const REFUSED = /error (400|415|422)\b|^no\s*data\b/i;
const LAYOUT_REFUSAL =
  /error (400|415|422)\b|^no\s*data\b|^error\.?$|could not be converted|json value|json request|base-?64|payload|is required|unsupported media|not a valid|unexpected character|deserializ/i;

export async function dpuSaveAttempts(
  key: string,
  attempts: SaveAttempt[],
  method: "POST" | "PUT" | "DELETE" = "POST",

  alsoRefused?: RegExp,
): Promise<string> {
  const first = winningLabel.get(key);
  const ordered = first
    ? [...attempts].sort(
        (a, b) => Number(b.label === first) - Number(a.label === first),
      )
    : attempts;
  const log: Array<{ attempt: string; server: string }> = [];
  for (let n = 0; n < ordered.length; n++) {
    const a = ordered[n]!;
    console.log(
      `[dpu] ${key}: trying layout ${n + 1}/${ordered.length} "${a.label}"`,
    );
    try {
      const token = getSession()?.token;
      const message = await dpuSave(a.path, JSON.stringify(a.body), method, {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      });
      winningLabel.set(key, a.label);
      console.info(`[dpu] ${key}: saved with layout "${a.label}"`);
      return message;
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      log.push({ attempt: a.label, server: text });

      const refused =
        e instanceof ApiError &&
        e.kind === "server" &&
        (LAYOUT_REFUSAL.test(text.trim()) || !!alsoRefused?.test(text.trim()));
      console.warn(
        `[dpu] ${key}: layout "${a.label}" -> server said: ${text}${refused ? "  (not accepted, trying the next layout)" : "  (stopping here)"}`,
      );
      if (!refused && !(e instanceof ApiError && REFUSED.test(text.trim())))
        throw e;
    }
  }
  console.warn(`[dpu] ${key}: the server refused every layout`);
  console.table(log);

  const distinct = [...new Set(log.map((l) => l.server))];
  throw new ApiError(
    distinct.length === 1
      ? `The server answered "${distinct[0]}" to all ${log.length} request layouts, so nothing was saved.`
      : `The server refused all ${log.length} request layouts, so nothing was saved. Server said: ` +
          distinct.map((m, i) => `(${i + 1}) ${m}`).join(" "),
    "server",
  );
}

export async function dpuReadAttempts<T>(
  key: string,
  attempts: SaveAttempt[],
  parse: (reply: unknown) => T,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  const memoKey = `read:${key}`;
  const first = winningLabel.get(memoKey);
  const ordered = first
    ? [...attempts].sort(
        (a, b) => Number(b.label === first) - Number(a.label === first),
      )
    : attempts;
  const log: Array<{ attempt: string; server: string }> = [];
  for (const a of ordered) {
    try {
      const token = getSession()?.token;
      const reply = await dpuWrite(
        a.path,
        {
          method,
          body: JSON.stringify(a.body),
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        1,
      );
      const out = parse(reply);
      winningLabel.set(memoKey, a.label);
      return out;
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      log.push({ attempt: a.label, server: text });
      const refused =
        e instanceof ApiError &&
        (e.kind === "server" || e.kind === "parse") &&
        !/error 5\d\d\b/.test(text);
      if (!refused) throw e;
    }
  }
  console.warn(`[dpu] ${key}: the server refused every layout`);
  console.table(log);
  const distinct = [...new Set(log.map((l) => l.server))];
  throw new ApiError(
    distinct.length === 1
      ? distinct[0]!
      : `The server refused all ${log.length} request layouts. Server said: ` +
          distinct.map((m, i) => `(${i + 1}) ${m}`).join(" "),
    "server",
  );
}