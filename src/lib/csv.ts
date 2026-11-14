
const BOM = '\uFEFF';

const field = (v: string | number | undefined | null): string => {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const t = String(v).replace(/[\r\n]+/g, ' ');
  if (/^0\d+$/.test(t) || /^\d{12,}$/.test(t)) return `="${t}"`;
  return /[",;\t]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function toCsv(head: string[], rows: Array<Array<string | number>>): string {
  const lines = [head, ...rows].map((r) => r.map(field).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}
