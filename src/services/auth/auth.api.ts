import { decryptPayload, encryptPayload } from "../../lib/crypto";
import {
  resolveStaticLogin,
  staticLoginActive,
} from "../../config/staticLogin";
import { ApiError } from "../http/errors";

export interface LoginProfile {
  name: string;
  email: string;
  role: string;
  dairyName?: string;
  token?: string;
  vlccIds?: string[];
  vlccNames?: Record<string, string>;
  stationId?: string;
  plantId?: string;
  mccId?: string;
  mccName?: string;
  userId?: string;
  centerStationId?: string;
}

type Obj = Record<string, unknown>;

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const LOGIN_PATH = import.meta.env.VITE_LOGIN_PATH || "/home/userlogin";
const TIMEOUT_MS = 20_000;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

function pickIds(rows: Obj[], names: string[]): string[] {
  const wanted = names.map(norm);
  const out: string[] = [];
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!wanted.includes(norm(key))) continue;
      if (typeof value !== "string" && typeof value !== "number") continue;
      for (const part of String(value).split(/[,;\s]+/)) {
        if (part && !out.includes(part)) out.push(part);
      }
    }
  }
  return out;
}

function pickVlccNames(rows: Obj[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const id = pickIds([row], ["vlccid", "vlccode", "vlcid"])[0];
    const name = pickString(row, [
      "villagename",
      "vlccname",
      "vlcname",
      "centername",
      "centrename",
    ]);
    if (id && name) out[id] = name;
  }
  return out;
}

const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "User";

function pickStationId(records: Obj[]): string | undefined {
  const whole = (names: string[]) => {
    for (const w of names) {
      for (const row of records) {
        const key = Object.keys(row).find((k) => norm(k) === w);
        const v = key ? row[key] : undefined;
        if ((typeof v === "string" && v.trim()) || typeof v === "number")
          return String(v).trim();
      }
    }
    return undefined;
  };
  const forced = norm(import.meta.env.VITE_CENTER_ID_FIELD ?? "");
  const exact = whole([
    ...(forced ? [forced] : []),
    "customstationid",
    "stationid",
    "station",
    "stationcode",
    "stationno",
  ]);
  if (exact) return exact;
  for (const row of records) {
    for (const [key, value] of Object.entries(row)) {
      const k = norm(key);
      if (!k.includes("station") || k.includes("name")) continue;
      if (
        (typeof value === "string" && value.trim()) ||
        typeof value === "number"
      )
        return String(value).trim();
    }
  }
  return undefined;
}

export function mapLoginResponse(
  decoded: unknown,
  username: string,
): LoginProfile {
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

  let user: Obj = outer;
  let records: Obj[] = [outer];
  const dataKey = Object.keys(outer).find((k) => k.toLowerCase() === "data");
  if (dataKey) {
    const inner = outer[dataKey];
    if (Array.isArray(inner) && inner.length === 0)
      throw new ApiError(message || "Incorrect username or password.");
    const first = Array.isArray(inner) ? inner[0] : inner;
    if (isObj(first)) user = first;
    records = (Array.isArray(inner) ? inner : [inner]).filter(isObj);
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

  const resolvedEmail = email ?? username;
  return {
    name: name ?? nameFromEmail(resolvedEmail),
    email: resolvedEmail,
    role: role ?? "Dairy administrator",
    dairyName: pickString(user, [
      "dairyname",
      "plantname",
      "plant",
      "companyname",
      "organizationname",
      "orgname",
      "societyname",
    ]),
    token,

    vlccIds: pickIds(records, [
      "sessionid",
      "vlccid",
      "vlccids",
      "vlccode",
      "vlcid",
    ]),
    vlccNames: pickVlccNames(records),

    stationId: pickIds(records, ["stationid", "station"])[0],
    plantId: pickIds(records, ["plantid"])[0],
    mccId: pickIds(records, ["mccid", "mcc"])[0],
    mccName: pickString(user, ["mccname", "mccName", "mcc_name", "plantname"]),

    userId:
      pickIds(records.slice(0, 1), [
        "userid",
        "uid",
        "loginid",
        "usercode",
      ])[0] ?? pickIds(records.slice(0, 1), ["id"])[0],
    centerStationId: pickStationId(records),
  };
}

export function sanitizeLoginRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeLoginRecord);
  if (isObj(value)) {
    const out: Obj = {};
    for (const [k, v] of Object.entries(value)) {
      if (/pass(word|wd)?|pwd/i.test(k)) continue;
      out[k] = sanitizeLoginRecord(v);
    }
    return out;
  }
  return value;
}

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

export interface LoginResult {
  profile: LoginProfile;

  record: unknown;
}

export async function loginApi(
  username: string,
  password: string,
): Promise<LoginResult> {
  if (staticLoginActive()) {
    const found = await resolveStaticLogin(username, password);
    if (found.kind === "denied") {
      throw new ApiError("Incorrect username or password.");
    }
    if (found.kind === "match") {
      const profile = mapLoginResponse(found.record, username);
      return { profile, record: sanitizeLoginRecord(found.record) };
    }
  }

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
    decoded = json;
  }

  if (import.meta.env.DEV) {
    const rec = isObj(decoded) ? decoded : {};
    const data = Object.keys(rec).find((k) => k.toLowerCase() === "data");
    const first =
      data && Array.isArray(rec[data]) ? (rec[data] as unknown[])[0] : rec;
    console.log(
      "[login] response keys:",
      Object.keys(rec),
      "| user record keys:",
      isObj(first) ? Object.keys(first) : first,
    );
  }

  if (!ok) {
    const message = isObj(decoded)
      ? pickString(decoded, ["message", "msg", "error", "errorMessage"])
      : undefined;
    if (message) throw new ApiError(message);
    if (status === 401 || status === 403)
      throw new ApiError("Incorrect username or password.");
    throw new ApiError(`Sign-in failed (error ${status}). Please try again.`);
  }

  return {
    profile: mapLoginResponse(decoded, username),
    record: sanitizeLoginRecord(decoded),
  };
}
