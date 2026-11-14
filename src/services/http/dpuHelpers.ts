import { clearRequestMemo } from "./client";
import { dpuSaveAttempts, encryptedShapes, type SaveAttempt } from "./dpu";
import { encryptXorPayload } from "../../lib/crypto";
import { ApiError } from "./errors";
import { isObj, norm, type Obj } from "../utils/loose";

export function unwrapObj(
  reply: unknown,
  keys: string[],
  depth = 0,
): Obj | null {
  let v = reply;
  if (typeof v === "string") {
    const t = v.trim();
    if (!/^[[{]/.test(t)) return null;
    try {
      v = JSON.parse(t);
    } catch {
      return null;
    }
  }
  if (!isObj(v) || depth > 4) return null;
  const wanted = keys.map(norm);
  if (Object.keys(v).some((k) => wanted.includes(norm(k)))) return v;
  for (const k of [
    "Message",
    "message",
    "Data",
    "data",
    "Result",
    "result",
    "response",
  ]) {
    if (k in v) {
      const got = unwrapObj(v[k], keys, depth + 1);
      if (got) return got;
    }
  }
  return null;
}

export const replyMessage = (reply: unknown): string =>
  isObj(reply)
    ? String(reply.Message ?? reply.message ?? "").trim()
    : typeof reply === "string"
      ? reply.trim()
      : "";

export const isNoRecord = (reply: unknown): boolean =>
  /no\s*(record|data)/i.test(replyMessage(reply));

const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
export const pascalKeys = (o: Obj): Obj =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [cap(k), v]));

export function payloadLayouts(path: string, obj: Obj): SaveAttempt[] {
  const xor = (v: unknown) => ({ Payload: encryptXorPayload(v) });
  const attempts: SaveAttempt[] = [
    { label: "xor-object", path, body: xor(obj) },
    { label: "xor-data-text", path, body: xor({ data: JSON.stringify(obj) }) },
    { label: "xor-object-pascal", path, body: xor(pascalKeys(obj)) },
    { label: "xor-Data-text", path, body: xor({ Data: JSON.stringify(obj) }) },
  ];
  try {
    attempts.push({ label: "aes-object", path, body: encryptedShapes(obj)[0] });
  } catch {
    /* no AES key: the XOR layouts above are enough */
  }
  return attempts;
}

export async function dpuSaveObject(
  key: string,
  path: string,
  obj: Obj,
  method: "POST" | "PUT" | "DELETE" = "POST",
): Promise<string> {
  const message = await dpuSaveAttempts(key, payloadLayouts(path, obj), method);
  clearRequestMemo();
  return message;
}

export async function dpuSaveQuery(
  key: string,
  path: string,
  params: Record<string, string>,
  method: "POST" | "PUT" | "DELETE",
): Promise<string> {
  const url = `${path}?${new URLSearchParams(params).toString()}`;
  const xor = (v: unknown) => ({ Payload: encryptXorPayload(v) });
  const attempts: SaveAttempt[] = [
    { label: "xor-params", path: url, body: xor(params) },
    { label: "xor-params-pascal", path: url, body: xor(pascalKeys(params)) },
    { label: "xor-empty-object", path: url, body: xor({}) },
    {
      label: "xor-query-text",
      path: url,
      body: xor(new URLSearchParams(params).toString()),
    },
  ];
  const message = await dpuSaveAttempts(key, attempts, method);
  clearRequestMemo();
  return message;
}

const winningShape = new Map<string, { layout: Layout; shape: number }>();

type Layout = "data-text" | "json-text" | "object" | "Data-text";
const LAYOUTS: Layout[] = ["data-text", "json-text", "object", "Data-text"];

const SHAPE_REFUSAL = /error\s+in\s+data|no\s+vlcc/i;
const WRONG_LAYOUT = /error\s+in\s+data/i;

const packLayout = (layout: Layout, shape: Obj): unknown => {
  const text = JSON.stringify(shape);
  const inner =
    layout === "object"
      ? shape
      : layout === "json-text"
        ? { json: text }
        : layout === "Data-text"
          ? { Data: text }
          : { data: text };
  return { Payload: encryptXorPayload(inner) };
};

export async function dpuSaveShapes(
  key: string,
  path: string,
  shapes: Obj[],
): Promise<string> {
  const log: Array<{ attempt: string; server: string }> = [];
  let last: unknown;
  let n = 0;
  const max = LAYOUTS.length * shapes.length;
  console.group(
    `[dpu] SAVE ${key}  ->  POST ${path}   (${shapes.length} field-name shapes, up to ${max} tries)`,
  );
  console.log(
    'How it works: the data is packed (layout), encrypted with VITE_ENCRYPTION_KEY and posted as { Payload }. The server answers "Error in data !" for a wrong layout and "No VLCC found !" when it cannot find the centre. Nothing is stored for those answers, so the next try is made.',
  );
  const done = () => console.groupEnd();

  const run = async (
    layout: Layout,
    i: number,
  ): Promise<{ done: true; message: string } | { done: false }> => {
    const label = `${layout} / shape ${i + 1}`;
    n += 1;
    console.log(
      `%c▶ try ${n}/${max}: layout "${layout}", field-name shape ${i + 1}`,
      "font-weight:bold;color:#2563eb",
    );
    console.log(
      '   plain data BEFORE encryption (copy this into Postman "innerJson"):\n' +
        JSON.stringify(shapes[i]),
    );
    try {
      const message = await dpuSaveAttempts(key, [
        { label, path, body: packLayout(layout, shapes[i]!) },
      ]);
      winningShape.set(key, { layout, shape: i });
      clearRequestMemo();
      console.log(
        `%c✔ SAVED with "${label}". Server message: ${message || "(none)"}`,
        "font-weight:bold;color:#16a36e",
      );
      console.info(`[dpu] ${key}: saved with "${label}"`);
      done();
      return { done: true, message };
    } catch (e) {
      last = e;
      const text = e instanceof Error ? e.message : String(e);
      log.push({ attempt: label, server: text });
      if (!(e instanceof ApiError && SHAPE_REFUSAL.test(text))) {
        console.log(
          `%c✖ STOPPED: "${text}" (not a layout problem, so no more tries)`,
          "font-weight:bold;color:#e14250",
        );
        done();
        throw e;
      }
      console.log(
        `%c✖ refused: "${text}"  -> trying the next one`,
        "color:#ea8c14",
      );
      return { done: false };
    }
  };

  const tried = new Set<string>();
  const remembered = winningShape.get(key);
  if (remembered && shapes[remembered.shape]) {
    tried.add(`${remembered.layout}:${remembered.shape}`);
    const r = await run(remembered.layout, remembered.shape);
    if (r.done) return r.message;
  }
  for (const layout of LAYOUTS) {
    for (let i = 0; i < shapes.length; i++) {
      if (tried.has(`${layout}:${i}`)) continue;
      const r = await run(layout, i);
      if (r.done) return r.message;

      if (WRONG_LAYOUT.test(log[log.length - 1]!.server)) break;
    }
  }
  console.warn(`[dpu] ${key}: the server refused every layout / shape`);
  console.table(log);
  done();
  throw last;
}

export const stationKeys = (id: string): Obj => ({
  StationId: id,
  VlccId: id,
  VLCCId: id,
  vlccid: id,
  stationid: id,
});
