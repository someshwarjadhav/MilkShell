import type { Center, Collection, Farmer, Machine, MilkType, Sale, Shift, SyncLog } from '../types';
import { DEFAULT_RATES, rateOf } from './rate';
import { addDays, todayISO } from './format';
import { between, gauss, mulberry32, pick } from './rng';
import type { RateTable } from '../types';

export const DAIRY_NAME = 'Sahyadri Dairy Cooperative';

const VILLAGES = ['Ashta', 'Walwa', 'Islampur', 'Kasegaon', 'Bhilawadi', 'Tasgaon', 'Palus', 'Kadegaon'];
const FIRST = ['Sanjay', 'Ramesh', 'Vilas', 'Sunita', 'Anita', 'Dattatray', 'Pandurang', 'Sharad', 'Mangal', 'Kavita', 'Prakash', 'Suresh', 'Lata', 'Bapu', 'Shivaji', 'Rekha', 'Nanasaheb', 'Savita', 'Ganesh', 'Yuvraj', 'Archana', 'Mohan', 'Jayashree', 'Tanaji'];
const LAST = ['Patil', 'Jadhav', 'Shinde', 'More', 'Pawar', 'Kale', 'Mane', 'Salunkhe', 'Kadam', 'Gaikwad', 'Bhosale', 'Chavan'];

const MILK_PROFILE: Record<MilkType, { fat: [number, number]; snf: [number, number]; liters: [number, number] }> = {
  cow: { fat: [4.1, 0.45], snf: [8.55, 0.25], liters: [6, 34] },
  buffalo: { fat: [7.0, 0.8], snf: [9.2, 0.3], liters: [5, 26] },
  goat: { fat: [4.6, 0.45], snf: [8.35, 0.25], liters: [2, 9] },
};

export function buildCenters(): Center[] {
  const now = Date.now();
  const mk = (code: string, name: string, kind: Center['kind'], village: string, status: Center['status'], minsAgo: number, cap: number): Center => ({
    id: `c-${code}`, code, name, kind, village, status, lastSync: new Date(now - minsAgo * 60000).toISOString(), capacityL: cap,
  });
  return [
    mk('7010101', 'Ashta Main VLC', 'VLC', 'Ashta', 'online', 4, 1500),
    mk('7010102', 'Vishrambag VLC', 'VLC', 'Walwa', 'online', 9, 1200),
    mk('7010103', 'Walwa Demo VLC', 'VLC', 'Islampur', 'syncing', 1, 800),
    mk('7010104', 'Islampur MCC', 'MCC', 'Islampur', 'offline', 190, 3000),
    mk('7010105', 'Sangli BMC', 'BMC', 'Palus', 'online', 15, 5000),
  ];
}

export function buildFarmers(centers: Center[]): Farmer[] {
  const r = mulberry32(2026);
  const out: Farmer[] = [];
  for (let i = 1; i <= 42; i++) {
    const roll = r();
    const types: MilkType[] =
      roll < 0.5 ? ['cow'] : roll < 0.72 ? ['buffalo'] : roll < 0.8 ? ['goat'] : roll < 0.93 ? ['cow', 'buffalo'] : ['cow', 'goat'];
    const center = centers[Math.floor(r() * centers.length)];
    out.push({
      id: `f-${i}`,
      code: String(i).padStart(3, '0'),
      name: `${pick(r, FIRST)} ${pick(r, LAST)}`,
      village: pick(r, VILLAGES),
      centerId: center.id,
      phone: `98${String(Math.floor(r() * 1e8)).padStart(8, '0')}`,
      milkTypes: types,
      joined: addDays(todayISO(), -Math.floor(between(r, 60, 1400))),
      active: r() > 0.07,
      advance: r() > 0.55 ? Math.round(between(r, 1000, 12000) / 100) * 100 : 0,
    });
  }
  return out;
}

export function buildMachines(centers: Center[]): Machine[] {
  const r = mulberry32(77);
  const out: Machine[] = [];
  centers.forEach((c, i) => {
    const kinds: Machine['kind'][] = c.kind === 'VLC' ? ['Analyzer', 'Weighing scale'] : ['Analyzer', 'Weighing scale', 'Display'];
    kinds.forEach((kind, j) => {
      const model = kind === 'Analyzer' ? 'Bond Pro-3 analyzer' : kind === 'Weighing scale' ? 'Digi-W 150 kg scale' : 'LED display 4-line';
      out.push({
        id: `m-${i}-${j}`,
        centerId: c.id,
        model,
        kind,
        serial: `SN${Math.floor(between(r, 100000, 999999))}`,
        firmware: kind === 'Analyzer' ? (r() > 0.7 ? 'v2.4.1' : 'v2.5.0') : 'v1.8.2',
        status: c.status,
        lastPing: c.lastSync,
        calibratedOn: addDays(todayISO(), -Math.floor(between(r, 12, i === 3 ? 140 : 80))),
      });
    });
  });
  return out;
}

export function makeCollection(
  r: () => number,
  farmer: Farmer,
  milk: MilkType,
  date: string,
  shift: Shift,
  rates: RateTable,
  centers: Center[],
  seq: number,
  time?: string,
): Collection {
  const p = MILK_PROFILE[milk];
  const weekly = 1 + 0.06 * Math.sin((new Date(date + 'T00:00:00').getDate() / 30) * Math.PI * 2);
  const base = between(r, p.liters[0], p.liters[1]) * (shift === 'morning' ? 1.1 : 0.9) * weekly;
  const liter = Math.round(base * 2) / 2;
  const adulterated = r() < 0.025;
  const fat = Math.max(2.6, Math.min(9.5, gauss(r, p.fat[0], p.fat[1]) - (adulterated ? 0.8 : 0)));
  const snf = Math.max(6.6, gauss(r, p.snf[0], p.snf[1]) - (adulterated ? 1.3 : 0));
  const f2 = Math.round(fat * 10) / 10;
  const s2 = Math.round(snf * 10) / 10;
  const clr = Math.round(4 * (s2 - 0.25 * f2 - 0.72) * 10) / 10;
  const kg = Math.round(liter * (1 + clr / 1000) * 100) / 100;
  const rate = rateOf(rates, milk, f2, s2);
  const center = centers.find((c) => c.id === farmer.centerId) ?? centers[0];
  const hh = shift === 'morning' ? Math.floor(between(r, 5, 8)) : Math.floor(between(r, 17, 19));
  const mm = Math.floor(between(r, 0, 59));
  return {
    id: `col-${date}-${shift}-${farmer.id}-${milk}-${seq}`,
    date,
    shift,
    farmerId: farmer.id,
    centerId: farmer.centerId,
    milk,
    liter,
    kg,
    fat: f2,
    snf: s2,
    clr,
    temp: Math.round(between(r, 18, r() < 0.04 ? 36 : 28) * 10) / 10,
    rate,
    amount: Math.round(rate * liter * 100) / 100,
    time: time ?? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    machineId: `AN-${center.code.slice(-2)}`,
  };
}

export function buildCollections(farmers: Farmer[], centers: Center[], rates: RateTable = DEFAULT_RATES): Collection[] {
  const r = mulberry32(11);
  const out: Collection[] = [];
  const today = todayISO();
  const hour = new Date().getHours();
  let seq = 0;
  for (let d = 29; d >= 0; d--) {
    const date = addDays(today, -d);
    for (const shift of ['morning', 'evening'] as Shift[]) {
      if (d === 0 && shift === 'evening' && hour < 17) continue;
      for (const f of farmers) {
        if (!f.active) continue;
        for (const milk of f.milkTypes) {
          if (r() < 0.14) continue;
          out.push(makeCollection(r, f, milk, date, shift, rates, centers, seq++));
        }
      }
    }
  }
  return out;
}

export function buildSales(): Sale[] {
  const r = mulberry32(5);
  const customers = ['Warna Cooling Plant', 'Sahyadri Sweets', 'Krishna Curd Works', 'Local retail route'];
  return Array.from({ length: 9 }, (_, i) => {
    const milk = pick(r, ['cow', 'cow', 'buffalo', 'goat'] as MilkType[]);
    return {
      id: `s-${i}`,
      date: addDays(todayISO(), -i),
      customer: pick(r, customers),
      milk,
      liter: Math.round(between(r, 150, 900) / 10) * 10,
      rate: milk === 'cow' ? 42 : milk === 'buffalo' ? 66 : 58,
      paid: i > 1,
    } as Sale;
  });
}

export function buildSyncLogs(centers: Center[]): SyncLog[] {
  const r = mulberry32(31);
  return Array.from({ length: 12 }, (_, i) => {
    const c = pick(r, centers);
    const roll = r();
    return {
      id: `sl-${i}`,
      at: new Date(Date.now() - (i * 17 + 3) * 60000).toISOString(),
      centerId: c.id,
      records: Math.floor(between(r, 6, 58)),
      status: roll > 0.88 ? 'failed' : roll > 0.74 ? 'retry' : 'ok',
      via: r() > 0.3 ? 'Collector app' : 'Direct GPRS',
    } as SyncLog;
  });
}

