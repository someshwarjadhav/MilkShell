
import { addDays } from '../../lib/format';
import { isoFromTrdate } from '../utils/date';
import type { FarmerRow } from '../mappers/farmer.mapper';
import type { Kind } from '../utils/milk';
import { kindOf } from '../utils/milk';
import type { RawLoose } from '../types/raw';

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

export function pickLoose(r: RawLoose, names: string[]): string {
  const keys = Object.keys(r);
  for (const want of names.map(norm)) {
    const k = keys.find((x) => norm(x) === want);
    const v = k ? text(r[k]) : '';
    if (v) return v;
  }
  return '';
}

export interface MasterFarmer {
  key: string;
  farmerId: string;
  vlccid: string;
  name: string;
  village: string;
  phone: string;
  milk: Kind | null;
  active: boolean | null;
  bank: string;
  account: string;
  ifsc: string;
}

export function mapMaster(rows: RawLoose[]): MasterFarmer[] {
  return rows.map((r, i) => {
    const farmerId = pickLoose(r, ['farmerid', 'farmer', 'farmercode', 'farmer_id', 'fid', 'id']);
    const vlccid = pickLoose(r, ['vlccid', 'villageid', 'vlcid', 'vlccode', 'centerid']);
    const status = pickLoose(r, ['farmerstatus', 'status', 'isactive', 'active']).toLowerCase();
    return {
      key: `${vlccid}:${farmerId}:${i}`,
      farmerId,
      vlccid,
      name: pickLoose(r, ['farmername', 'name', 'farmer_name', 'fname']),
      village: pickLoose(r, ['dcsname', 'villagename', 'village', 'villageagentaddress', 'address']),
      phone: pickLoose(r, ['mobile', 'mobileno', 'mobilenumber', 'phone', 'phoneno', 'contactno', 'contact']),
   
      milk: kindOf(pickLoose(r, ['milktype', 'milk'])) ?? (pickLoose(r, ['farmerbuff']) === '1' ? 'buffalo' : null),
      active: ['false', '0', 'inactive', 'n', 'no'].includes(status) ? false : status ? true : null,
      bank: pickLoose(r, ['farmerbank']),
      account: pickLoose(r, ['farmerbankac']),
      ifsc: pickLoose(r, ['farmerbankbranch']),
    };
  });
}

export interface DayLitres { date: string; cow: number; buffalo: number; mix: number; goat: number }

export interface BookFarmer {
  key: string;
  farmerId: string;
  vlccid: string;
  name: string;
  village: string;
  phone: string;
  milks: Kind[];
  inMaster: boolean;
  active: boolean | null;
  bank: string;
  account: string;
  ifsc: string;
  week: number;
  period: number;
  amount: number;
  avgFat: number;
  avgSnf: number;
  lastDate: string;
  samples: FarmerRow[];
}

export function buildFarmerBook(master: MasterFarmer[], samples: FarmerRow[], today: string): BookFarmer[] {
  const weekStart = addDays(today, -6);
  const book = new Map<string, BookFarmer>();
  const blank = (key: string, farmerId: string, vlccid: string): BookFarmer => ({
    key, farmerId, vlccid, name: '', village: '', phone: '', milks: [], inMaster: false, active: null, bank: '', account: '', ifsc: '',
    week: 0, period: 0, amount: 0, avgFat: 0, avgSnf: 0, lastDate: '', samples: [],
  });
  for (const m of master) {
    if (!m.farmerId) continue;
    const key = `${m.vlccid}:${m.farmerId}`;
    const b = book.get(key) ?? blank(key, m.farmerId, m.vlccid);
    b.inMaster = true;
    b.name = b.name || m.name;
    b.village = b.village || m.village;
    b.phone = b.phone || m.phone;
    b.active = m.active ?? b.active;
    b.bank = b.bank || m.bank;
    b.account = b.account || m.account;
    b.ifsc = b.ifsc || m.ifsc;
    if (m.milk && !b.milks.includes(m.milk)) b.milks.push(m.milk);
    book.set(key, b);
  }
  const fat = new Map<string, number>();
  const snf = new Map<string, number>();
  for (const s of samples) {
    const b = book.get(s.farmerKey) ?? blank(s.farmerKey, s.farmerId, s.vlccid);
    if (!b.name && !s.farmerName.startsWith('Farmer #')) b.name = s.farmerName;
    b.village = b.village || s.village;
    if (s.milk && !b.milks.includes(s.milk)) b.milks.push(s.milk);
    b.samples.push(s);
    b.period += s.liter;
    b.amount += s.amount;
    fat.set(s.farmerKey, (fat.get(s.farmerKey) ?? 0) + s.liter * s.fat);
    snf.set(s.farmerKey, (snf.get(s.farmerKey) ?? 0) + s.liter * s.snf);
    const d = isoFromTrdate(s.date);
    if (d) {
      if (d >= weekStart) b.week += s.liter;
      if (d > b.lastDate) b.lastDate = d;
    }
    book.set(s.farmerKey, b);
  }
  for (const b of book.values()) {
    b.name = b.name || `Farmer #${b.farmerId}`;
    b.avgFat = b.period ? (fat.get(b.key) ?? 0) / b.period : 0;
    b.avgSnf = b.period ? (snf.get(b.key) ?? 0) / b.period : 0;
  }
  return [...book.values()].sort((a, b) => b.week - a.week || a.name.localeCompare(b.name));
}

export function farmerDaily(samples: FarmerRow[], end: string, days: number): DayLitres[] {
  const idx = new Map<string, DayLitres>();
  const out: DayLitres[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const p = { date, cow: 0, buffalo: 0, mix: 0, goat: 0 };
    idx.set(date, p);
    out.push(p);
  }
  for (const s of samples) {
    const d = isoFromTrdate(s.date);
    const p = d ? idx.get(d) : undefined;
    if (p && s.milk) p[s.milk] += s.liter;
  }
  return out;
}

export function minutesOf(t: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(t.trim());
  if (!m) return 0;
  let h = Number(m[1]);
  const ap = (m[3] ?? '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

export const sampleStamp = (r: FarmerRow) => `${isoFromTrdate(r.date) ?? ''} ${String(minutesOf(r.time)).padStart(4, '0')}`;
