import type { FarmerRow } from './farmer.mapper';
import type { VlccRow } from './vlcc.mapper';
import { isoFromTrdate } from '../utils/date';
import type { Kind, ShiftName } from '../utils/milk';

/* ------------------------------------------------------------------ */
/*  Unionwise collection: one line per society (VLC), under its union  */
/* ------------------------------------------------------------------ */

export interface UnionRow {
  key: string;
  union: string;
  society: string;
  vlccid: string;
  farmers: number;
  liter: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
}

export function unionwise(rows: FarmerRow[], unionOf: (vlccid: string) => string, societyOf: (vlccid: string) => string): UnionRow[] {
  const by = new Map<string, { farmers: Set<string>; liter: number; fw: number; sw: number; amount: number }>();
  for (const r of rows) {
    const b = by.get(r.vlccid) ?? { farmers: new Set<string>(), liter: 0, fw: 0, sw: 0, amount: 0 };
    b.farmers.add(r.farmerId);
    b.liter += r.liter;
    b.fw += r.liter * r.fat;
    b.sw += r.liter * r.snf;
    b.amount += r.amount;
    by.set(r.vlccid, b);
  }
  return [...by.entries()]
    .map(([vlccid, b]) => ({
      key: vlccid,
      union: unionOf(vlccid),
      society: societyOf(vlccid),
      vlccid,
      farmers: b.farmers.size,
      liter: b.liter,
      fat: b.liter ? b.fw / b.liter : 0,
      snf: b.liter ? b.sw / b.liter : 0,
      rate: b.liter ? b.amount / b.liter : 0,
      amount: b.amount,
    }))
    .sort((a, b) => a.union.localeCompare(b.union) || a.society.localeCompare(b.society));
}

export function unionTotals(rows: UnionRow[]) {
  let liter = 0, fw = 0, sw = 0, amount = 0, farmers = 0;
  for (const r of rows) {
    liter += r.liter;
    fw += r.liter * r.fat;
    sw += r.liter * r.snf;
    amount += r.amount;
    farmers += r.farmers;
  }
  return { societies: rows.length, farmers, liter, amount, fat: liter ? fw / liter : 0, snf: liter ? sw / liter : 0, rate: liter ? amount / liter : 0 };
}

/* ------------------------------------------------------------------ */
/*  Variance: DOC (vendor) collection against VLC (farmer) collection  */
/* ------------------------------------------------------------------ */

export interface Side { qty: number; fat: number; snf: number; rate: number; amount: number }
export interface VarianceRow {
  key: string;
  vlccid: string;
  village: string;
  date: string;
  iso: string;
  shift: ShiftName | null;
  milk: Kind | null;
  milkLabel: string;
  vendor: Side;
  farmer: Side;
  diff: { qty: number; fat: number; snf: number; amount: number };
}

interface Acc { qty: number; fw: number; sw: number; amount: number; n: number; rate0: number }
const acc = (): Acc => ({ qty: 0, fw: 0, sw: 0, amount: 0, n: 0, rate0: 0 });
const add = (a: Acc, qty: number, fat: number, snf: number, amount: number, rate: number) => {
  a.qty += qty; a.fw += qty * fat; a.sw += qty * snf; a.amount += amount; a.n += 1; a.rate0 = rate;
};
const side = (a: Acc | undefined): Side =>
  !a ? { qty: 0, fat: 0, snf: 0, rate: 0, amount: 0 } : {
    qty: a.qty,
    fat: a.qty ? a.fw / a.qty : 0,
    snf: a.qty ? a.sw / a.qty : 0,
    // One portal row keeps the portal's own rate; several rows get the average rate.
    rate: a.n === 1 ? a.rate0 : a.qty ? a.amount / a.qty : 0,
    amount: a.amount,
  };
const r2 = (n: number) => Math.round(n * 100) / 100;

export function variance(vlcc: VlccRow[], farmers: FarmerRow[]): VarianceRow[] {
  const keyOf = (vlccid: string, date: string, shift: ShiftName | null, milk: Kind | null, label: string) =>
    `${vlccid}|${isoFromTrdate(date) ?? date}|${shift ?? ''}|${milk ?? label.toLowerCase()}`;
  const meta = new Map<string, { vlccid: string; village: string; date: string; shift: ShiftName | null; milk: Kind | null; label: string }>();
  const vendor = new Map<string, Acc>();
  const farmer = new Map<string, Acc>();

  for (const r of vlcc) {
    const k = keyOf(r.vlccid, r.date, r.shift, r.milk, r.milkLabel);
    meta.set(k, { vlccid: r.vlccid, village: r.village, date: r.date, shift: r.shift, milk: r.milk, label: r.milkLabel });
    add(vendor.get(k) ?? vendor.set(k, acc()).get(k)!, r.liter, r.fat, r.snf, r.amount, r.rate);
  }
  for (const r of farmers) {
    const k = keyOf(r.vlccid, r.date, r.shift, r.milk, r.milkLabel);
    if (!meta.has(k)) meta.set(k, { vlccid: r.vlccid, village: '', date: r.date, shift: r.shift, milk: r.milk, label: r.milkLabel });
    add(farmer.get(k) ?? farmer.set(k, acc()).get(k)!, r.liter, r.fat, r.snf, r.amount, r.rate);
  }

  return [...meta.entries()]
    .map(([key, m]) => {
      const v = side(vendor.get(key));
      const f = side(farmer.get(key));
      return {
        key,
        vlccid: m.vlccid,
        village: m.village,
        date: m.date,
        iso: isoFromTrdate(m.date) ?? m.date,
        shift: m.shift,
        milk: m.milk,
        milkLabel: m.label,
        vendor: v,
        farmer: f,
        diff: { qty: r2(v.qty - f.qty), fat: r2(v.fat - f.fat), snf: r2(v.snf - f.snf), amount: r2(v.amount - f.amount) },
      };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.vlccid.localeCompare(b.vlccid) || String(a.shift).localeCompare(String(b.shift)));
}

export interface SideTotals { cowLit: number; cowAmt: number; buffLit: number; buffAmt: number; totLit: number; totAmt: number }
export interface VarianceTotals { vendor: SideTotals; farmer: SideTotals; diff: SideTotals }

const zero = (): SideTotals => ({ cowLit: 0, cowAmt: 0, buffLit: 0, buffAmt: 0, totLit: 0, totAmt: 0 });
function addTo(t: SideTotals, milk: Kind | null, s: Side) {
  if (milk === 'cow') { t.cowLit += s.qty; t.cowAmt += s.amount; }
  if (milk === 'buffalo') { t.buffLit += s.qty; t.buffAmt += s.amount; }
  t.totLit += s.qty; t.totAmt += s.amount;
}

export function varianceTotals(rows: VarianceRow[]): VarianceTotals {
  const vendor = zero(), farmer = zero();
  for (const r of rows) { addTo(vendor, r.milk, r.vendor); addTo(farmer, r.milk, r.farmer); }
  const diff = zero();
  (Object.keys(diff) as Array<keyof SideTotals>).forEach((k) => { diff[k] = r2(vendor[k] - farmer[k]); });
  return { vendor, farmer, diff };
}

/* ------------------------------------------------------------------ */
/*  VLC status: did the centre send milk in the chosen dates / shift   */
/* ------------------------------------------------------------------ */

export interface StatusRow { vlccid: string; village: string; active: boolean; liter: number; fat: number; snf: number; lastDate: string }

export function vlcStatus(ids: string[], rows: VlccRow[], villageOf: (id: string) => string): StatusRow[] {
  const by = new Map<string, { liter: number; fw: number; sw: number; last: string; lastIso: string }>();
  for (const r of rows) {
    const b = by.get(r.vlccid) ?? { liter: 0, fw: 0, sw: 0, last: '', lastIso: '' };
    b.liter += r.liter;
    b.fw += r.liter * r.fat;
    b.sw += r.liter * r.snf;
    const iso = isoFromTrdate(r.date) ?? r.date;
    if (r.liter > 0 && iso >= b.lastIso) { b.lastIso = iso; b.last = r.date; }
    by.set(r.vlccid, b);
  }
  return ids.map((id) => {
    const b = by.get(id);
    return {
      vlccid: id,
      village: villageOf(id),
      active: !!b && b.liter > 0,
      liter: b?.liter ?? 0,
      fat: b && b.liter ? b.fw / b.liter : 0,
      snf: b && b.liter ? b.sw / b.liter : 0,
      lastDate: b?.last ?? '',
    };
  });
}
