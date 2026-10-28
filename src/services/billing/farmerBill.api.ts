import { clearRequestMemo, gatewayGet, gatewayText } from '../http/client';
import { ApiError } from '../http/errors';
import { apiDate } from '../utils/date';
import { isObj, pickValue, type Obj } from '../utils/loose';
import { num } from '../utils/parse';


export interface BillFreeze {
  AutoRowNum: number;
  VillageId: string;
  EntryDate: string;
  StartDate: string;
  EndDate: string;
  flag: number;
  json: string;
}

export async function getPrintTableData(from: string, to: string, stationId: string): Promise<unknown> {
  const q = `/home/MilkBillProcessma?id=0&fromdate=${encodeURIComponent(apiDate(from))}&todate=${encodeURIComponent(apiDate(to))}&stationid=${encodeURIComponent(stationId)}`;
  clearRequestMemo();
  try {
    return await gatewayGet(q, 0);
  } catch (e) {
    if (e instanceof ApiError && e.kind === 'parse' && /empty/i.test(e.message)) return {};
    throw e;
  }
}

export async function postBillFreeze(data: BillFreeze): Promise<string> {
  return gatewayText('/dairy/dairy/getMilkBillFreeze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, 0);
}


export interface BillShift { wt: string; fat: string; snf: string; rate: string; amt: string }
export interface BillLine { label: string; milk: string; total: boolean; m: BillShift; e: BillShift }
export interface BillPair { label: string; value: string }
export interface FarmerBillData {
  id: string;
  name: string;
  range: string;
  lines: BillLine[];
  summary: BillPair[][];
  net: string;
}

const BILL_KNOWN: Record<string, string> = { cowmilk: 'Cow', buffalomilk: 'Buff', mixmilk: 'Mix' };
const BILL_ORDER = ['cowmilk', 'buffalomilk', 'mixmilk'];
const f2 = (x: number) => x.toFixed(2);
const billKey = (d: string) => {
  const [dd, mm, yy] = d.split('/');
  return `${yy}${(mm ?? '').padStart(2, '0')}${(dd ?? '').padStart(2, '0')}`;
};
const billDmy = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim().split('-').reverse().join('-') : s.trim());

function billHeading(key: string): { id: string; name: string; range: string } {
  const parts = key.split(' : ');
  const range = (parts.length > 1 ? parts[parts.length - 1] : '').split(/\s+To\s+/i).map(billDmy).join(' To ');
  const pieces = parts.slice(1, -1).join(' : ').split(',').map((s) => s.trim());
  const id = pieces[0] || (parts[0] ?? '').replace(/^farmerid:/i, '').trim();
  const name = pieces.length >= 3 ? pieces.slice(1, -1).filter(Boolean).join(', ') : '';
  return { id, name, range };
}

interface BillRaw { date: string; mw: number; mf: number; ms: number; mr: number; ma: number; ew: number; ef: number; es: number; er: number; ea: number }
const bv = (o: Obj, ...keys: string[]) => pickValue(o, keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '')));
const billRaw = (o: Obj): BillRaw => ({
  date: String(bv(o, 'dtdate') ?? ''),
  mw: num(bv(o, 'mweight')), mf: num(bv(o, 'mfat')), ms: num(bv(o, 'msnf')), mr: num(bv(o, 'mrate')), ma: num(bv(o, 'mtotal_amount')),
  ew: num(bv(o, 'eweight')), ef: num(bv(o, 'efat')), es: num(bv(o, 'esnf')), er: num(bv(o, 'erate')), ea: num(bv(o, 'etotal_amount')),
});
const billShift = (w: number, f: number, s: number, r: number, a: number): BillShift => ({ wt: f2(w), fat: f2(f), snf: f2(s), rate: f2(r), amt: f2(a) });
const billAvg = (rows: BillRaw[], wt: (r: BillRaw) => number, val: (r: BillRaw) => number): number => {
  const live = rows.filter((r) => wt(r) > 0);
  return live.length ? live.reduce((a, r) => a + val(r), 0) / live.length : 0;
};

function billOf(key: string, value: Obj, extended: boolean): FarmerBillData | null {
  const lines: BillLine[] = [];
  const liters: Record<string, number> = {};
  const amounts: Record<string, number> = {};

  const groups = Object.keys(value)
    .filter((k) => /milk$/i.test(k) && Array.isArray(value[k]))
    .sort((a, b) => {
      const ia = BILL_ORDER.indexOf(a.toLowerCase());
      const ib = BILL_ORDER.indexOf(b.toLowerCase());
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  for (const g of groups) {
    const label = BILL_KNOWN[g.toLowerCase()] ?? g.replace(/milk$/i, '').replace(/^./, (c) => c.toUpperCase());
    const rows = (value[g] as unknown[]).filter(isObj).map(billRaw).sort((a, b) => billKey(a.date).localeCompare(billKey(b.date)));
    if (!rows.length) continue;
    for (const r of rows) lines.push({ label: r.date, milk: label, total: false, m: billShift(r.mw, r.mf, r.ms, r.mr, r.ma), e: billShift(r.ew, r.ef, r.es, r.er, r.ea) });
    const sum = (f: (r: BillRaw) => number) => rows.reduce((a, r) => a + f(r), 0);
    lines.push({
      label,
      milk: 'Total',
      total: true,
      m: billShift(sum((r) => r.mw), billAvg(rows, (r) => r.mw, (r) => r.mf), billAvg(rows, (r) => r.mw, (r) => r.ms), billAvg(rows, (r) => r.mw, (r) => r.mr), sum((r) => r.ma)),
      e: billShift(sum((r) => r.ew), billAvg(rows, (r) => r.ew, (r) => r.ef), billAvg(rows, (r) => r.ew, (r) => r.es), billAvg(rows, (r) => r.ew, (r) => r.er), sum((r) => r.ea)),
    });
    liters[label] = sum((r) => r.mw + r.ew);
    amounts[label] = sum((r) => r.ma + r.ea);
  }
  if (!lines.length) return null;

  const L = (k: string) => liters[k] ?? 0;
  const A = (k: string) => amounts[k] ?? 0;
  const totalLiter = Object.values(liters).reduce((a, b) => a + b, 0);
  const totalAmount = Object.values(amounts).reduce((a, b) => a + b, 0);
  const net = f2(totalAmount);
  const p = (label: string, v: number | string): BillPair => ({ label, value: typeof v === 'number' ? f2(v) : v });

  const summary: BillPair[][] = [
    [p('Cow Liter', L('Cow')), p('Buff Liter', L('Buff')), p('Mix Liter', L('Mix')), p('Cow Amt', A('Cow'))],
    [p('Buff Amount', A('Buff')), p('Mix Amount', A('Mix')), p('Total Liter', totalLiter), p('Total Amount', totalAmount)],
  ];
  if (extended) summary.push([p('Current Advance', 0), p('Over Rate', A('Mix')), p('Milk Deposit', 0), p('Cattle Feed', 0)]);
  summary.push([p('Incentive', 0), p('Transport', 0), p('Total Deduction', 0), p('Net Payment', net)]);

  const h = billHeading(key);
  return { id: h.id, name: `${h.id} ${h.name}`.trim(), range: h.range, lines, summary, net };
}

export function parseFarmerBills(data: unknown, extended = false): FarmerBillData[] {
  let json = data;
  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch { return []; }
  }
  if (!isObj(json)) return [];
  const out: FarmerBillData[] = [];
  for (const [key, value] of Object.entries(json)) {
    if (!isObj(value)) continue;
    const bill = billOf(key, value, extended);
    if (bill) out.push(bill);
  }
  return out;
}

export interface BillExportRow { farmer: string; date: string; milk: string; m: BillShift | null; e: BillShift | null; net?: string }

export function billExportRows(bills: FarmerBillData[]): BillExportRow[] {
  const out: BillExportRow[] = [];
  for (const b of bills) {
    for (const l of b.lines) out.push({ farmer: b.name, date: l.label, milk: l.milk, m: l.m, e: l.e });
    out.push({ farmer: b.name, date: 'Net Payment', milk: '', m: null, e: null, net: b.net });
  }
  return out;
}
