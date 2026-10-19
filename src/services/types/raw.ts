/**
 * RAW response shapes of the SmartX portal, with the EXACT keys and casing the server sends.
 * Never rename a key here. Conversion to UI models happens only in mappers.ts.
 */

/** GET /home/dashboardLinechart  (sparse: only days with data; Liter may be negative) */
export interface RawLinePoint {
  dsdtdate: string; // "15 Oct 2026"
  milktype: string; // code: C | B | M
  Liter: number;
  dtdate: string; // "2026-10-15T00:00:00"
}

/** POST /home/VlccCollection  (ALL values are strings; milktype and shift are full words) */
export interface RawVlccRow {
  villagename: string;
  vlccid: string;
  trdate: string; // "16 Oct 2026"
  qty: string;
  fat: string;
  snf: string;
  clr: string;
  milktype: string; // "Cow" | "Buffalo" | "Mix" ...
  shift: string; // "Morning" | "Evening"
  kg: string;
  rate: string;
  amount: string;
  beneficiaryname: string;
}

/** POST /home/farmercollection  (ALL values are strings; shift is a CODE; note capital Kg and Time) */
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
  Time: string; // "06:48 PM"
  vlccid: string;
  shift: string; // code: M | E
  rtpl: string;
  amount: string;
  farmername: string; // can be ""
  usbflag: string;
  MaxId: string;
  villagename: string; // a CODE or dairy name ("0012000"), NOT the village
  villageagentaddress: string; // the real village
  beneficiaryname: string;
}

/** GET /home/topMilkSupplier  (numbers are real numbers here, key casing differs: Liter, MilkType) */
export interface RawTopSupplier {
  villagename: string;
  farmerid: number;
  farmername: string;
  Liter: number;
  fat: number;
  snf: number;
  MilkType: string;
}

/** Request codes */
export type MilkCode = 'C' | 'B' | 'M' | 'Z'; // Cow, Buffalo, Mix, Z = Both (cow + buffalo)
export type ShiftCode = 'M' | 'E' | 'Z'; // Morning, Evening, Both

/**
 * POST /home/farmermaster  (JSON body { VillageIds: "id1,id2" }) and POST /home/FarmerMilkEntry.
 * The exact keys of these two replies are not documented, so they are read case-insensitively in mappers.ts.
 */
export type RawLoose = Record<string, unknown>;
