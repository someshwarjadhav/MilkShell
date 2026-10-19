/** Helpers for replies whose exact key names are not fixed: keys are compared ignoring case, spaces, "_" and "-". */
export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
export const norm = (k: unknown) => String(k ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The list inside a reply: the reply itself, or the first array under data / result / table ... */
export function rowsFrom(json: unknown): Obj[] {
  if (Array.isArray(json)) return json.filter(isObj);
  if (!isObj(json)) return [];
  const ok = json.Success ?? json.success;
  if (ok === false) return [];
  for (const key of Object.keys(json)) {
    if (['data', 'result', 'results', 'table', 'rows', 'items', 'menu', 'menus', 'list', 'response'].includes(norm(key))) {
      const inner = json[key];
      if (Array.isArray(inner)) return inner.filter(isObj);
      if (isObj(inner)) return rowsFrom(inner);
    }
  }
  return [];
}

/** First non-empty string/number among `wanted` (in the order of `wanted`, not of the row). */
export function pick(row: Obj, wanted: string[]): string {
  const keys = Object.keys(row);
  for (const w of wanted) {
    const k = keys.find((x) => norm(x) === w);
    if (!k) continue;
    const v = row[k];
    if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return String(v).trim();
  }
  return '';
}

export function pickValue(row: Obj, wanted: string[]): unknown {
  const keys = Object.keys(row);
  for (const w of wanted) {
    const k = keys.find((x) => norm(x) === w);
    if (k !== undefined) return row[k];
  }
  return undefined;
}

/**
 * Fallback when no exact key name matches: the first string/number value whose (normalised) key CONTAINS one of `has`
 * and none of `not`. Used for replies whose key names are not known in advance.
 */
export function pickLike(row: Obj, has: string[], not: string[] = []): string {
  for (const [k, v] of Object.entries(row)) {
    const n = norm(k);
    if (!has.some((h) => n.includes(h)) || not.some((x) => n.includes(x))) continue;
    if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return String(v).trim();
  }
  return '';
}
