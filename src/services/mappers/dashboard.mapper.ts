import type { RawLinePoint, RawTopSupplier } from '../types/raw';
import { kindOf, type Kind } from '../utils/milk';
import { num, str } from '../utils/parse';

export interface TopSupplier {
  key: string;
  village: string;
  farmerId: string;
  farmerName: string;
  liter: number;
  fat: number;
  snf: number;
  milk: Kind | null;
  milkLabel: string;
}

export function mapTop(rows: RawTopSupplier[], limit = 10): TopSupplier[] {
  return rows
    .map((r, i) => ({
      key: `${r.villagename}|${r.farmerid}|${r.MilkType}|${i}`,
      village: str(r.villagename),
      farmerId: str(r.farmerid),
      farmerName: str(r.farmername) || `Farmer #${r.farmerid}`,
      liter: num(r.Liter),
      fat: num(r.fat),
      snf: num(r.snf),
      milk: kindOf(r.MilkType),
      milkLabel: str(r.MilkType),
    }))
    .sort((a, b) => b.liter - a.liter)
    .slice(0, limit);
}

export interface TrendDay {
  date: string;
  label: string;
  cow: number;
  buffalo: number;
  mix: number;
  total: number;
}
export interface Trend {
  days: TrendDay[];
  hasNegative: boolean;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const labelOf = (d: Date) => `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}`;

/**
 * Groups the sparse points by dtdate, series C/B/M -> Cow/Buffalo/Mix, and fills missing days with 0.
 * Negative litres stay in the data (the chart clamps its axis at 0 and shows a note).
 */
export function buildTrend(rows: RawLinePoint[], endISO: string, days: number): Trend {
  const byDate = new Map<string, { label: string; cow: number; buffalo: number; mix: number }>();
  let hasNegative = false;
  for (const r of rows) {
    const date = str(r.dtdate).slice(0, 10);
    if (!date) continue;
    const d = byDate.get(date) ?? { label: str(r.dsdtdate), cow: 0, buffalo: 0, mix: 0 };
    const kind = kindOf(r.milktype);
    const v = num(r.Liter);
    if (v < 0) hasNegative = true;
    if (kind === 'cow' || kind === 'buffalo' || kind === 'mix') d[kind] += v;
    byDate.set(date, d);
  }
  const out: TrendDay[] = [];
  const end = new Date(endISO + 'T00:00:00');
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const date = isoOf(d);
    const hit = byDate.get(date);
    const cow = hit?.cow ?? 0, buffalo = hit?.buffalo ?? 0, mix = hit?.mix ?? 0;
    out.push({ date, label: hit?.label || labelOf(d), cow, buffalo, mix, total: cow + buffalo + mix });
  }
  const inWindow = out.some((p) => p.cow < 0 || p.buffalo < 0 || p.mix < 0);
  return { days: out, hasNegative: hasNegative && inWindow };
}
