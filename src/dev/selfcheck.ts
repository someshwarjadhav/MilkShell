import { farmerTotals, type FarmerRow } from '../services/mappers/farmer.mapper';
import { totalsOf, type VlccRow } from '../services/mappers/vlcc.mapper';

const SAMPLE_DAY = '16 Oct 2026';
const near = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

export interface CheckLine { name: string; expected: number; actual: number; ok: boolean }

export function sampleDayCheck(vlcc: VlccRow[], farmers: FarmerRow[]): CheckLine[] | null {
  const day = vlcc.filter((r) => r.date === SAMPLE_DAY);
  if (day.length === 0) return null;
  const line = (name: string, expected: number, actual: number): CheckLine => ({ name, expected, actual, ok: near(expected, actual) });
  const full = totalsOf(day);
  const eve = totalsOf(day.filter((r) => r.shift === 'Evening'));
  const eveFarmers = farmerTotals(farmers.filter((r) => r.date === SAMPLE_DAY && r.shift === 'Evening')).farmers;
  return [
    line('Evening liter', 269.0, eve.liter),
    line('Evening amount', 12543.95, eve.amount),
    line('Evening farmers', 18, eveFarmers),
    line('Full day liter', 952.1, full.liter),
    line('Full day fat (weighted)', 4.16, full.avgFat, ),
    line('Full day SNF (weighted)', 8.29, full.avgSnf),
    line('Full day payable', 42485.06, full.amount),
    line('Full day VLC', 3, full.vlcCount),
  ].map((l) => (l.name.includes('fat') || l.name.includes('SNF') ? { ...l, ok: near(l.expected, l.actual, 0.01) } : l));
}
