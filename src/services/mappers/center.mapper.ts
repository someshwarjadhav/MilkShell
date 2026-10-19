import type { VlccRow } from './vlcc.mapper';

/** One VLC / centre of the signed-in user, as shown in the dashboard dropdown. */
export interface Center {
  id: string;
  name: string;
  /** The village name, or the id while the name is unknown. */
  label: string;
  /** The row exactly as getCenter sent it (a form that needs another column reads it here). */
  raw?: Record<string, unknown>;
}

/**
 * Every VLC id of the session, named from the login response first and from loaded VLC rows second.
 * The ids decide the list, so "All" and the dropdown always cover exactly the same centres.
 */
export function buildCenters(ids: string[], loginNames: Record<string, string>, vlccRows: VlccRow[]): Center[] {
  const names = new Map<string, string>(Object.entries(loginNames));
  for (const r of vlccRows) if (r.village && !names.has(r.vlccid)) names.set(r.vlccid, r.village);
  return ids.map((id) => {
    const name = names.get(id) ?? '';
    return { id, name, label: name || id };
  });
}
