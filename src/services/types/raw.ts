
export interface RawLinePoint {
  dsdtdate: string; 
  milktype: string; 
  Liter: number;
  dtdate: string; 
}


export interface RawVlccRow {
  villagename: string;
  vlccid: string;
  trdate: string;
  qty: string;
  fat: string;
  snf: string;
  clr: string;
  milktype: string; 
  shift: string; 
  kg: string;
  rate: string;
  amount: string;
  beneficiaryname: string;
}


export interface RawFarmerRow {
  farmerid: string;
  sampleno: string;
  trdate: string;
  qty: string;
  Kg: string;
  fat: string;
  snf: string;
  clr: string;
  water: string;
  milktype: string;
  Time: string; 
  vlccid: string;
  shift: string; 
  rtpl: string;
  amount: string;
  farmername: string; 
  usbflag: string;
  MaxId: string;
  villagename: string; 
  villageagentaddress: string; 
  beneficiaryname: string;
}


export interface RawTopSupplier {
  villagename: string;
  farmerid: number;
  farmername: string;
  Liter: number;
  fat: number;
  snf: number;
  MilkType: string;
}

export type MilkCode = 'C' | 'B' | 'M' | 'Z'; 
export type ShiftCode = 'M' | 'E' | 'Z'; 


export type RawLoose = Record<string, unknown>;
