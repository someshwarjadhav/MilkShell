import { decryptPayload, encryptPayload } from "./crypto";

export class ApiError extends Error {}

export interface LoginProfile {
  name: string;
  email: string;
  role: string;
  token?: string;
}

type Obj = Record<string, unknown>;

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const LOGIN_PATH = import.meta.env.VITE_LOGIN_PATH || "/home/userlogin";
const TIMEOUT_MS = 20_000;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Case-insensitive lookup of the first non-empty string among `keys`, searching the root object and its direct child objects. */
function pickString(root: Obj, keys: string[]): string | undefined {
  const sources = [root, ...Object.values(root).filter(isObj)];
  for (const source of sources) {
    for (const wanted of keys) {
      const actual = Object.keys(source).find(
        (k) => k.toLowerCase() === wanted.toLowerCase(),
      );
      const value = actual ? source[actual] : undefined;
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

/** Looks for an explicit success / failure flag in the server response. */
function readFlag(root: Obj): "ok" | "fail" | undefined {
  for (const key of Object.keys(root)) {
    if (
      !["success", "issuccess", "status", "statuscode"].includes(
        key.toLowerCase(),
      )
    )
      continue;
    const v = root[key];
    if (v === true) return "ok";
    if (v === false) return "fail";
    if (typeof v === "number")
      return v >= 400 ? "fail" : v >= 200 ? "ok" : undefined;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "success", "ok", "succeeded"].includes(s)) return "ok";
      if (
        [
          "false",
          "fail",
          "failed",
          "failure",
          "error",
          "invalid",
          "unauthorized",
        ].includes(s)
      )
        return "fail";
      if (/^[45]\d\d$/.test(s)) return "fail";
      if (/^2\d\d$/.test(s)) return "ok";
    }
  }
  return undefined;
}

const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "User";


function mapLoginResponse(decoded: unknown, username: string): LoginProfile {
  const outer = Array.isArray(decoded) ? decoded[0] : decoded;
  if (!isObj(outer)) {
    throw new ApiError(
      typeof decoded === "string" && decoded
        ? decoded
        : "Login failed. Please check your details and try again.",
    );
  }

  const message = pickString(outer, [
    "message",
    "msg",
    "error",
    "errorMessage",
    "description",
  ]);

  // This server replies { Data: [ { ...user record } ] }. An empty Data array means no matching user.
  let user: Obj = outer;
  const dataKey = Object.keys(outer).find((k) => k.toLowerCase() === "data");
  if (dataKey) {
    const inner = outer[dataKey];
    if (Array.isArray(inner) && inner.length === 0)
      throw new ApiError(message || "Incorrect username or password.");
    const first = Array.isArray(inner) ? inner[0] : inner;
    if (isObj(first)) user = first;
  }

  const token =
    pickString(user, [
      "token",
      "accessToken",
      "access_token",
      "authToken",
      "jwt",
    ]) ??
    pickString(outer, [
      "token",
      "accessToken",
      "access_token",
      "authToken",
      "jwt",
    ]);
  const email = pickString(user, ["email", "emailId", "emailAddress"]);
  const name = pickString(user, [
    "name",
    "fullName",
    "full_name",
    "userName",
    "displayName",
    "firstName",
  ]);
  const role = pickString(user, [
    "role",
    "roleName",
    "userType",
    "designation",
  ]);
  const flag = readFlag(outer);

  if (flag === "fail" || (!flag && !token && !name && !email)) {
    throw new ApiError(message || "Incorrect username or password.");
  }

  // Only safe fields are copied: the server's record also contains the password, which must never be stored.
  const resolvedEmail = email ?? username;
  return {
    name: name ?? nameFromEmail(resolvedEmail),
    email: resolvedEmail,
    role: role ?? "Dairy administrator",
    token,
  };
}

/** The server wraps encrypted replies as { "data": "ciphertext:iv" }. Plain JSON replies are passed through. */
function unwrap(json: unknown): unknown {
  if (isObj(json) && typeof json.data === "string" && json.data.includes(":")) {
    try {
      return decryptPayload(json.data);
    } catch (error) {
      console.error("[api] Could not decrypt the server response:", error);
      throw new ApiError(
        "The server reply could not be read. Please contact support.",
      );
    }
  }
  return json;
}

async function postJson(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    const isHtml = (res.headers.get("content-type") ?? "").includes(
      "text/html",
    );
    if (isHtml) {
     
      console.error(
        `[api] Expected JSON but got HTML from ${res.url}. Check VITE_API_BASE_URL, VITE_LOGIN_PATH and the proxy.`,
      );
      throw new ApiError(
        "The sign-in service is not reachable right now. Please try again later.",
      );
    }

    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text || null;
    }
    return { ok: res.ok, status: res.status, json };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new ApiError(
        "The server took too long to respond. Please try again.",
      );
    throw new ApiError(
      "Cannot reach the server. Check your internet connection and try again.",
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export async function loginApi(
  username: string,
  password: string,
): Promise<LoginProfile> {
  let payload: string;
  try {
    
    payload = encryptPayload({ username, password });
  } catch (error) {
    console.error("[api] Encryption failed:", error);
    throw new ApiError(
      "Sign-in is not configured correctly. Please contact support.",
    );
  }

  const { ok, status, json } = await postJson(LOGIN_PATH, { payload });

  let decoded: unknown;
  try {
    decoded = unwrap(json);
  } catch (error) {
    if (ok) throw error;
    decoded = json; // error replies may be unreadable too; fall back to the status code below
  }

  // Dev-only debug line. Delete it before going live: it prints the whole user record to the console.
  if (import.meta.env.DEV) console.log("[login] decrypted response:", decoded);

  if (!ok) {
    const message = isObj(decoded)
      ? pickString(decoded, ["message", "msg", "error", "errorMessage"])
      : undefined;
    if (message) throw new ApiError(message);
    if (status === 401 || status === 403)
      throw new ApiError("Incorrect username or password.");
    throw new ApiError(`Sign-in failed (error ${status}). Please try again.`);
  }

  return mapLoginResponse(decoded, username);
}
