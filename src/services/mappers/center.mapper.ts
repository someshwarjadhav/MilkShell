import type { VlccRow } from './vlcc.mapper';


export interface Center {
  id: string;
  name: string;

  label: string;

  raw?: Record<string, unknown>;
}


export function buildCenters(ids: string[], loginNames: Record<string, string>, vlccRows: VlccRow[]): Center[] {
  const names = new Map<string, string>(Object.entries(loginNames));
  for (const r of vlccRows) if (r.village && !names.has(r.vlccid)) names.set(r.vlccid, r.village);
  return ids.map((id) => {
    const name = names.get(id) ?? '';
    return { id, name, label: name || id };
  });
}
