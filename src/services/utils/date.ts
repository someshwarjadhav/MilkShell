import { DATE_FORMAT } from '../config';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


export function apiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  switch (DATE_FORMAT) {
    case 'dd-MM-yyyy': return `${d}-${m}-${y}`;
    case 'dd/MM/yyyy': return `${d}/${m}/${y}`;
    case 'dd MMM yyyy': return `${d} ${MON[Number(m) - 1]} ${y}`;
    default: return `${y}-${m}-${d}`;
  }
}

export function isoFromTrdate(t: string): string | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(String(t).trim());
  const mi = m ? MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()) : -1;
  return m && mi >= 0 ? `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
