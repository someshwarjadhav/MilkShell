import { BASE_URL } from "../config";
import { getSession } from "../session";
import { ApiError } from "../http/errors";
import { gatewayText, parseGatewayText } from "../http/client";
import { getMenu } from "../menu/menu.api";
import { asFlag } from "../report/report.api";
import {
  isObj,
  norm,
  pick,
  pickLike,
  pickValue,
  rowsFrom,
  type Obj,
} from "../utils/loose";

const HOST = BASE_URL || "https://smartx.shivinfotech.co.in";
const GET_USER_URL = `${HOST}/home/getuser`;

const ADD_USER_ACCESS_PATH = "/dairy/dairy/addUserAccessMS";

export interface AccessUser {
  id: string;
  name: string;
  email: string;
  label: string;
}

export interface AccessForm {
  key: string;
  formId: string;
  name: string;
  className: string;
  checked: boolean;
}

export interface AccessModule {
  key: string;
  moduleId: string;
  name: string;
  forms: AccessForm[];
}

const authHeader = (): Record<string, string> => {
  const t = getSession()?.token;
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const labelOf = (name: string, email: string) =>
  name && email && name.toLowerCase() !== email.toLowerCase()
    ? `${name} - ${email}`
    : name || email;

export function parseUsers(json: unknown): AccessUser[] {
  const out: AccessUser[] = [];
  const seen = new Set<string>();
  for (const row of rowsFrom(json)) {
    const id =
      pick(row, ["id", "userid", "uid", "loginid"]) ||
      pickLike(row, ["userid"], ["parent"]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const email =
      pick(row, ["email", "emailid", "mail"]) ||
      pickLike(row, ["email", "mail"]);
    const name =
      pick(row, ["username", "name", "fullname", "displayname", "mccname"]) ||
      pickLike(row, ["name"], ["file", "path", "image"]);
    out.push({ id, name, email, label: labelOf(name, email) || `User ${id}` });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export async function getUser(): Promise<AccessUser[]> {
  const text = await gatewayText(
    GET_USER_URL,
    { method: "GET", headers: authHeader() },
    0,
    true,
  );
  return parseUsers(parseGatewayText(text));
}

const FORM_LIST_KEYS = [
  "details",
  "forms",
  "children",
  "submenu",
  "items",
  "child",
  "menus",
];

function checkedOf(row: Obj): boolean {
  const flags: boolean[] = [];
  for (const k of [
    "status",
    "isactive",
    "isenabled",
    "enabled",
    "access",
    "isvisible",
    "visible",
  ]) {
    const key = Object.keys(row).find((x) => norm(x) === k);
    if (key === undefined) continue;
    const f = asFlag(row[key]);
    if (f !== undefined) flags.push(f);
  }
  return flags.length > 0 && flags.every(Boolean);
}

export function parseAccessMenu(json: unknown): AccessModule[] {
  const modules: AccessModule[] = [];
  rowsFrom(json).forEach((m, mi) => {
    const list = pickValue(m, FORM_LIST_KEYS);
    const formRows = Array.isArray(list) ? list.filter(isObj) : [];
    const name =
      pick(m, ["modulename", "menuname", "name", "title"]) ||
      `Module ${mi + 1}`;
    const moduleId = pick(m, ["moduleid", "menuid", "id"]);
    const forms: AccessForm[] = formRows.map((f, fi) => {
      const className = pick(f, ["formclassname", "url", "path", "route"]);
      return {
        key: `${mi}-${fi}`,
        formId: pick(f, ["formid", "id", "menuid"]),
        name:
          pick(f, ["formname", "name", "title", "menuname"]) ||
          className ||
          `Form ${fi + 1}`,
        className,
        checked: checkedOf(f),
      };
    });
    if (forms.length) modules.push({ key: `m${mi}`, moduleId, name, forms });
  });
  return modules;
}

export async function getAccessMenu(userId: string): Promise<AccessModule[]> {
  return parseAccessMenu(await getMenu(userId));
}

const asNum = (v: string): number | string =>
  v !== "" && Number.isFinite(Number(v)) ? Number(v) : v;

const createdStamp = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T05:00:00`;
};

export function buildAccessFormData(
  userId: string,
  modules: AccessModule[],
): FormData {
  const stamp = createdStamp();
  const rows = modules.flatMap((m) =>
    m.forms
      .filter((f) => f.checked)
      .map((f) => ({
        UserID: userId,
        ModuleID: asNum(m.moduleId),
        FormID: asNum(f.formId),
        IsActive: 1,
        CreatedDateTime: stamp,
        CreatedBy: userId,
      })),
  );
  const fd = new FormData();
  fd.append("data", JSON.stringify(rows));
  fd.append("userid", userId);
  return fd;
}


export const checkedKeys = (modules: AccessModule[]): Set<string> =>
  new Set(
    modules.flatMap((m) =>
      m.forms.filter((f) => f.checked).map((f) => `${m.moduleId}:${f.formId}`),
    ),
  );


export const sameAccess = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every((k) => b.has(k));

function assertSaved(text: string) {
  let reply: unknown = text;
  try {
    reply = parseGatewayText(text);
  } catch {
    reply = text;
  }
  if (isObj(reply)) {
    const msg = String(reply.Message ?? reply.message ?? "").trim();
    const failed = (reply.Success ?? reply.success) === false;
    if (
      failed &&
      !/^(done|success|saved|ok|insert|update|record|data saved)/i.test(msg)
    )
      throw new ApiError(
        msg || "The portal did not save the user access.",
        "server",
      );
  } else if (typeof reply === "string" && /^\s*(error|fail)/i.test(reply)) {
    throw new ApiError(reply.trim().slice(0, 200), "server");
  }
}

export async function postData(formData: FormData): Promise<void> {
  if (import.meta.env.DEV)
    console.info(
      "[addUserAccess] sending",
      Object.fromEntries(formData.entries()),
    );
  const text = await gatewayText(
    ADD_USER_ACCESS_PATH,
    { method: "POST", body: formData },
    0,
  );
  assertSaved(text);
}