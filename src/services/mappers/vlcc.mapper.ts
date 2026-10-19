import type { RawVlccRow } from '../types/raw';
import { kindOf, shiftOf, type Kind, type ShiftName } from '../utils/milk';
import { num, str } from '../utils/parse';
import { rememberVlccName } from '../vlcc/names';

export interface VlccRow {
  key: string;
  vlccid: string;
  village: string;
  date: string;
  liter: number;
  kg: number;
  fat: number;
  snf: number;
  clr: number;
  milk: Kind | null;
  milkLabel: string;
  shift: ShiftName | null;
  shiftLabel: string;
  rate: number;
  amount: number;
}

export function mapVlcc(rows: RawVlccRow[]): VlccRow[] {
  for (const r of rows) rememberVlccName(str(r.vlccid), str(r.villagename));
  return rows.map((r, i) => ({
    key: `${r.vlccid}|${r.trdate}|${r.shift}|${r.milktype}|${i}`,
    vlccid: str(r.vlccid),
    village: str(r.villagename),
    date: str(r.trdate),
    liter: num(r.qty),
    kg: num(r.kg),
    fat: num(r.fat),
    snf: num(r.snf),
    clr: num(r.clr),
    milk: kindOf(r.milktype),
    milkLabel: str(r.milktype),
    shift: shiftOf(r.shift),
    shiftLabel: str(r.shift),
    rate: num(r.rate),
    amount: num(r.amount),
  }));
}

export interface Totals {
  count: number;
  liter: number;
  kg: number;
  amount: number;
  /** weighted by litres: sum(qty*fat)/sum(qty). Never a simple average. */
  avgFat: number;
  avgSnf: number;
  vlcCount: number;
  byKind: Record<Kind, number>;
  byKindFat: Record<Kind, number>;
  byKindSnf: Record<Kind, number>;
}

const zeroKinds = (): Record<Kind, number> => ({ cow: 0, buffalo: 0, goat: 0, mix: 0 });

export function totalsOf(rows: VlccRow[]): Totals {
  let liter = 0, kg = 0, amount = 0, fw = 0, sw = 0;
  const vlcs = new Set<string>();
  const byKind = zeroKinds(), fk = zeroKinds(), sk = zeroKinds();
  for (const r of rows) {
    liter += r.liter;
    kg += r.kg;
    amount += r.amount;
    fw += r.liter * r.fat;
    sw += r.liter * r.snf;
    vlcs.add(r.vlccid);
    if (r.milk) {
      byKind[r.milk] += r.liter;
      fk[r.milk] += r.liter * r.fat;
      sk[r.milk] += r.liter * r.snf;
    }
  }
  const avg = (sum: Record<Kind, number>) => {
    const out = zeroKinds();
    (Object.keys(out) as Kind[]).forEach((k) => (out[k] = byKind[k] ? sum[k] / byKind[k] : 0));
    return out;
  };
  return {
    count: rows.length,
    liter, kg, amount,
    avgFat: liter ? fw / liter : 0,
    avgSnf: liter ? sw / liter : 0,
    vlcCount: vlcs.size,
    byKind,
    byKindFat: avg(fk),
    byKindSnf: avg(sk),
  };
}
