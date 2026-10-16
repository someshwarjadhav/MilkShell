import type { Collection, MilkType } from '../types';
import { addDays } from './format';

export interface Summary {
  liter: number;
  kg: number;
  amount: number;
  avgFat: number;
  avgSnf: number;
  farmers: number;
  count: number;
}

export function summarize(rows: Collection[]): Summary {
  let liter = 0, kg = 0, amount = 0, fw = 0, sw = 0;
  const f = new Set<string>();
  for (const r of rows) {
    liter += r.liter;
    kg += r.kg;
    amount += r.amount;
    fw += r.fat * r.liter;
    sw += r.snf * r.liter;
    f.add(r.farmerId);
  }
  return {
    liter,
    kg,
    amount,
    avgFat: liter ? fw / liter : 0,
    avgSnf: liter ? sw / liter : 0,
    farmers: f.size,
    count: rows.length,
  };
}

export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const a = m.get(k);
    if (a) a.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export interface DayPoint {
  date: string;
  cow: number;
  buffalo: number;
  goat: number;
  total: number;
  morning: number;
  evening: number;
}

export function dailySeries(rows: Collection[], end: string, days: number): DayPoint[] {
  const idx = new Map<string, DayPoint>();
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const p: DayPoint = { date, cow: 0, buffalo: 0, goat: 0, total: 0, morning: 0, evening: 0 };
    idx.set(date, p);
    out.push(p);
  }
  for (const r of rows) {
    const p = idx.get(r.date);
    if (!p) continue;
    p[r.milk as MilkType] += r.liter;
    p.total += r.liter;
    p[r.shift] += r.liter;
  }
  for (const p of out) {
    p.cow = Math.round(p.cow);
    p.buffalo = Math.round(p.buffalo);
    p.goat = Math.round(p.goat);
    p.total = Math.round(p.total);
    p.morning = Math.round(p.morning);
    p.evening = Math.round(p.evening);
  }
  return out;
}
