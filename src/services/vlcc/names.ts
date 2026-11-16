import { getSession } from '../session';
import { VILLAGE_NAMES } from './villages';

const learnt = new Map<string, string>();

export function rememberVlccName(id: string, name: string) {
  const n = name.trim();
  if (id && n) learnt.set(id, n);
}

export const vlccName = (id: string): string => learnt.get(id) || getSession()?.vlccNames?.[id] || VILLAGE_NAMES[id] || '';



export const vlccCode = (id: string): string => (id && getSession()?.stationByVlcc?.[id]) || id;


export const stationCodeOf = (id: string, rowCode = ''): string =>
  (id && getSession()?.stationByVlcc?.[id]) || rowCode.trim() || id;

export const vlccTitle = (id: string, fallbackName = ''): string => vlccName(id) || fallbackName.trim() || `VLC ${vlccCode(id)}`;


export const vlccLabel = (id: string, fallbackName = ''): string => {
  const n = vlccName(id) || fallbackName.trim();
  const code = vlccCode(id);
  return n ? `${n} | ${code}` : code;
};

export const vlccOption = (id: string): string => {
  const n = vlccName(id);
  const code = getSession()?.stationByVlcc?.[id] || id;
  return n ? `${n} | ${code}` : code;
};