import { getSession } from '../session';
import { VILLAGE_NAMES } from './villages';

/**
 * One place that turns a VLC id (7090806) into what a person understands (SINGHOD).
 * Order: names learnt from the portal's own rows > names in the login response > the seeded village list.
 */
const learnt = new Map<string, string>();

/** Called with rows that carry both an id and a village name (VlccCollection), so names stay right without any setup. */
export function rememberVlccName(id: string, name: string) {
  const n = name.trim();
  if (id && n) learnt.set(id, n);
}

export const vlccName = (id: string): string => learnt.get(id) || getSession()?.vlccNames?.[id] || VILLAGE_NAMES[id] || '';

/** Heading for a centre: the name, or "VLC <id>" while the name is unknown. */
export const vlccTitle = (id: string, fallbackName = ''): string => vlccName(id) || fallbackName.trim() || `VLC ${id}`;

/** Text for dropdown options and sub-lines: "SINGHOD · 7090806". */
export const vlccOption = (id: string): string => {
  const n = vlccName(id);
  return n ? `${n} · ${id}` : `VLC ${id}`;
};
