import {
  environment,
  MAX_PARALLEL_REQUESTS,
  REQUEST_TIMEOUT_MS,
} from "../config";
import { getSession } from "../session";
import { decryptPayload } from "../../lib/crypto";
import { ApiError } from "./errors";

export type Priority = 0 | 1 | 2;
let active = 0;
const queues: Array<Array<() => void>> = [[], [], []];
interface Ticket {
  priority: Priority;
  go?: () => void;
}
const acquire = (t: Ticket) =>
  active < MAX_PARALLEL_REQUESTS
    ? (active++, Promise.resolve())
    : new Promise<void>((resolve) => {
        t.go = resolve;
        queues[t.priority].push(resolve);
      });

function bump(t: Ticket, priority: Priority) {
  if (priority >= t.priority) return;
  if (t.go) {
    const from = queues[t.priority];
    const i = from.indexOf(t.go);
    if (i >= 0) {
      from.splice(i, 1);
      queues[priority].push(t.go);
    }
  }
  t.priority = priority;
}
const release = () => {
  const next = queues.find((q) => q.length > 0)?.shift();
  if (next) next();
  else active--;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const ENCRYPTED = /^[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{16,}$/;
const looksEncrypted = (s: string) => ENCRYPTED.test(s.trim());

function decryptReply(v: unknown): unknown {
  const open = (s: string): unknown => {
    try {
      return decryptPayload(s.trim());
    } catch {
      throw new ApiError("The server reply is encrypted and could not be decrypted. Check VITE_ENCRYPTION_KEY in .env.local.", "parse");
    }
  };
  if (typeof v === "string" && looksEncrypted(v)) return decryptReply(open(v));
  if (isObj(v)) {
    for (const k of Object.keys(v)) {
      if (!["data", "response", "result", "payload"].includes(k.toLowerCase())) continue;
      const inner = v[k];
      if (typeof inner === "string" && looksEncrypted(inner)) return decryptReply(open(inner));
    }
  }
  return v;
}

export function parseGatewayText(text: string): unknown {
  const clean = text.replace(/[\r\n]+/g, "").trim();
  if (!clean) throw new ApiError("The server sent an empty reply.", "parse");
  if (looksEncrypted(clean)) return decryptReply(clean);
  if (clean.startsWith("<")) {
    throw new ApiError(
      "The gateway returned a web page instead of data. Check the API base URL / proxy and sign in again.",
      "parse",
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(clean);
  } catch {
    throw new ApiError("The server reply could not be read.", "parse");
  }
 
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch {}
  }
  return decryptReply(json);
}

export function listOf<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    const msg = String(json.Message ?? json.message ?? "").trim();
    if (ok === false) {
      if (/no\s*record/i.test(msg)) return [];
      throw new ApiError(msg || "The server reported a failure.", "server");
    }
    const data = json.Data ?? json.data;
    if (Array.isArray(data)) return data as T[];
  }
  throw new ApiError("The server reply has an unexpected shape.", "parse");
}

function urlFor(endpoint: string) {

  return `${environment.staticIP}${endpoint}`;
}

const retryable = (e: unknown) =>
  e instanceof ApiError &&
  (e.kind === "network" ||
    (e.kind === "server" && /error 50[234]\b/.test(e.message)));

async function send(
  endpoint: string,
  init: RequestInit,
  fields: unknown,
  ticket: Ticket,
  url = urlFor(endpoint),
): Promise<unknown> {
  await acquire(ticket);
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await sendOnce(endpoint, init, fields, url);
      } catch (e) {
        if (attempt === 0 && retryable(e)) {
          await sleep(700);
          continue;
        }
        throw e;
      }
    }
  } finally {
    release();
  }
}

async function sendOnce(
  endpoint: string,
  init: RequestInit,
  fields: unknown,
  url: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
   
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json, text/plain, */*",
        ...((init.headers as Record<string, string>) ?? {}),
      
      },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403)
      throw new ApiError(
        "Your session was rejected by the server. Please sign in again.",
        "auth",
      );
    if (!res.ok) {
      const body = (await res.text().catch(() => ""))
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      if (import.meta.env.DEV)
        console.warn(`[smartx] HTTP ${res.status} on ${endpoint}`, {
          sent: fields ?? "GET",
          response: body,
        });
      throw new ApiError(
        `The server answered with error ${res.status}${body ? `: ${body}` : "."}`,
        "server",
      );
    }
    const text = await res.text();
    if (import.meta.env.DEV)
      console.debug(`[smartx] OK ${endpoint}`, {
        sent: fields ?? "GET",
        reply: text.replace(/[\r\n]+/g, "").slice(0, 160),
      });
    return parseGatewayText(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError(
        `The server took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds to answer.`,
        "timeout",
      );
    }
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      "network",
    );
  } finally {
    clearTimeout(timer);
  }
}

const MEMO_MS = 2 * 60_000;
const memo = new Map<
  string,
  { at: number; p: Promise<unknown>; ticket: Ticket }
>();
const getMemo = (key: string, priority: Priority) => {
  const hit = memo.get(key);
  if (!hit || Date.now() - hit.at >= MEMO_MS) return null;
  bump(hit.ticket, priority);
  return hit.p;
};

export const gatewayGet = (endpoint: string, priority: Priority = 1) => {
  const key = `${getSession()?.scope ?? ""}|GET|${endpoint}`;
  const shared = getMemo(key, priority);
  if (shared) return shared;
  const ticket: Ticket = { priority };
  const p = send(endpoint, { method: "GET" }, undefined, ticket);
  memo.set(key, { at: Date.now(), p, ticket });
  p.catch(() => memo.delete(key));
  return p;
};

export const directGet = (url: string, priority: Priority = 1) => {
  const key = `${getSession()?.scope ?? ""}|GET_DIRECT|${url}`;
  const shared = getMemo(key, priority);
  if (shared) return shared;
  const ticket: Ticket = { priority };
  const p = send(
    new URL(url).pathname,
    { method: "GET" },
    undefined,
    ticket,
    url,
  );
  memo.set(key, { at: Date.now(), p, ticket });
  p.catch(() => memo.delete(key));
  return p;
};

export const clearRequestMemo = () => memo.clear();

export function gatewayPost(
  endpoint: string,
  fields: Record<string, string>,
  priority: Priority = 1,
) {
  const key = `${getSession()?.scope ?? ""}|${endpoint}|${JSON.stringify(fields)}`;
  const shared = getMemo(key, priority);
  if (shared) return shared;
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const ticket: Ticket = { priority };
  const p = send(endpoint, { method: "POST", body }, fields, ticket);
  memo.set(key, { at: Date.now(), p, ticket });
  p.catch(() => memo.delete(key));
  return p;
}

export function gatewayPostJson(
  endpoint: string,
  json: Record<string, unknown>,
  priority: Priority = 1,
) {
  const key = `${getSession()?.scope ?? ""}|${endpoint}|json|${JSON.stringify(json)}`;
  const shared = getMemo(key, priority);
  if (shared) return shared;
  const ticket: Ticket = { priority };
  const p = send(
    endpoint,
    {
      method: "POST",
      body: JSON.stringify(json),
      headers: { "Content-Type": "application/json" },
    },
    json,
    ticket,
  );
  memo.set(key, { at: Date.now(), p, ticket });
  p.catch(() => memo.delete(key));
  return p;
}
