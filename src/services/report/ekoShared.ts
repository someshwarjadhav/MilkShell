import { ApiError } from "../http/errors";
import { openDpuReply } from "../http/dpu";

type Row = Record<string, unknown>;
export type EkoRow = Row;

const isObject = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Turns a raw reply text (JSON, JSON inside a string, or encrypted text) into a value. */
export function decodeEkoText(raw: string): unknown {
  const text = raw.trim();
  if (!text) return [];
  try {
    let value: unknown = JSON.parse(text);
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch { /* plain text inside an API message */ }
    }
    return value;
  } catch {
    const opened = openDpuReply(text);
    if (opened !== text) return opened;
    throw new ApiError("The Eko API returned data that could not be read.", "parse");
  }
}

/** Finds the list of rows in any of the reply shapes the APIs use. */
export function ekoRowsFrom(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter(isObject);
  if (!isObject(value)) return value == null ? [] : [{ Value: value }];
  // { Success: false, Message: "No Record !" } is an empty report, not a row. Any other refusal is an error.
  const ok = value.Success ?? value.success;
  const note = String(value.Message ?? value.message ?? "").trim();
  if (ok === false) {
    if (!note || /no\s*(record|data)|not\s*found/i.test(note)) return [];
    throw new ApiError(note, "server");
  }
  for (const key of Object.keys(value)) {
    if (!["data", "result", "records", "response", "message"].includes(key.toLowerCase())) continue;
    const inner = value[key];
    if (Array.isArray(inner)) return inner.filter(isObject);
    if (isObject(inner)) return ekoRowsFrom(inner);
    if (typeof inner === "string") {
      try { return ekoRowsFrom(decodeEkoText(inner)); } catch { /* plain success/no-records message */ }
    }
  }
  if (/^no\s*(record|data)/i.test(note)) return [];
  return [value];
}

export const ekoColumns = (rows: Row[]): string[] => {
  const preferred = ["FatCC", "SNFCC", "FATBC", "SNFBC", "FATMC", "SNFMC", "Status"];
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const known = preferred.filter((k) => keys.some((x) => x.toLowerCase() === k.toLowerCase()));
  const rest = keys.filter((k) => !known.some((x) => x.toLowerCase() === k.toLowerCase()));
  return [...known, ...rest];
};

export const ekoCell = (value: unknown): string | number => {
  if (value == null) return "";
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value).trim();
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(text)) return Number(text);
  return text;
};

/** One column of an Eko report: the header shown + the names the API may use for it. */
export interface EkoField {
  label: string;
  aliases: readonly string[];
}

export const ekoNorm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Raw value of the first key of `row` that matches one of the aliases (case / spacing / symbols ignored). */
export function ekoValue(row: EkoRow, aliases: readonly string[]): unknown {
  const key = Object.keys(row).find((k) => aliases.some((a) => ekoNorm(a) === ekoNorm(k)));
  return key === undefined ? undefined : row[key];
}

/** Text shown in a table cell. Numbers that arrive as text ("1.80") are kept exactly as sent. */
export function ekoText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).trim();
}
