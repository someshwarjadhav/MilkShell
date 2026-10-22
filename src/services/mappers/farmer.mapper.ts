import type { RawFarmerRow } from '../types/raw';
import { kindOf, shiftOf, type Kind, type ShiftName } from '../utils/milk';
import { num, str } from '../utils/parse';

export interface FarmerRow {
  key: string;
  
  farmerKey: string;
  farmerId: string;
  farmerName: string;
  vlccid: string;
  sampleNo: string;
  date: string;
  time: string;
  milk: Kind | null;
  milkLabel: string;
  shift: ShiftName | null;
  liter: number;
  kg: number;
  fat: number;
  snf: number;
  clr: number;
  water: number;
  rate: number;
  amount: number;
 
  village: string;
}

export function mapFarmers(rows: RawFarmerRow[]): FarmerRow[] {
  return rows.map((r, i) => {
    const farmerId = str(r.farmerid);
    const vlccid = str(r.vlccid);
    return {
      key: `${vlccid}|${farmerId}|${r.sampleno}|${r.MaxId}|${i}`,
      farmerKey: `${vlccid}:${farmerId}`,
      farmerId,
      farmerName: str(r.farmername) || `Farmer #${farmerId}`,
      vlccid,
      sampleNo: str(r.sampleno),
      date: str(r.trdate),
      time: str(r.Time),
      milk: kindOf(r.milktype),
      milkLabel: str(r.milktype),
      shift: shiftOf(r.shift),
      liter: num(r.qty),
      kg: num(r.Kg),
      fat: num(r.fat),
      snf: num(r.snf),
      clr: num(r.clr),
      water: num(r.water),
      rate: num(r.rtpl),
      amount: num(r.amount),
      village: str(r.villageagentaddress),
    };
  });
}

export interface FarmerTotals {
  count: number;
  liter: number;
  kg: number;
  amount: number;
  avgFat: number;
  avgSnf: number;
  farmers: number;
}

export function farmerTotals(rows: FarmerRow[]): FarmerTotals {
  let liter = 0, kg = 0, amount = 0, fw = 0, sw = 0;
  const f = new Set<string>();
  for (const r of rows) {
    liter += r.liter; kg += r.kg; amount += r.amount;
    fw += r.liter * r.fat; sw += r.liter * r.snf;
    f.add(r.farmerKey);
  }
  return { count: rows.length, liter, kg, amount, avgFat: liter ? fw / liter : 0, avgSnf: liter ? sw / liter : 0, farmers: f.size };
}
