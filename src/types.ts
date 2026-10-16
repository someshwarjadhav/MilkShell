export type MilkType = "cow" | "buffalo" | "goat";
export type Shift = "morning" | "evening";
export type DeviceStatus = "online" | "offline" | "syncing";
export type Flag = "low-fat" | "low-snf" | "water" | "high-temp";

export interface Center {
  id: string;
  code: string;
  name: string;
  kind: "VLC" | "MCC" | "BMC";
  village: string;
  status: DeviceStatus;
  lastSync: string;
  capacityL: number;
}

export interface Farmer {
  id: string;
  code: string;
  name: string;
  village: string;
  centerId: string;
  phone: string;
  milkTypes: MilkType[];
  joined: string;
  active: boolean;
  advance: number;
}

export interface Collection {
  id: string;
  date: string;
  shift: Shift;
  farmerId: string;
  centerId: string;
  milk: MilkType;
  liter: number;
  kg: number;
  fat: number;
  snf: number;
  clr: number;
  temp: number;
  rate: number;
  amount: number;
  time: string;
  machineId: string;
}

export interface Machine {
  id: string;
  centerId: string;
  model: string;
  kind: "Analyzer" | "Weighing scale" | "Display";
  serial: string;
  firmware: string;
  status: DeviceStatus;
  lastPing: string;
  calibratedOn: string;
}

export interface Sale {
  id: string;
  date: string;
  customer: string;
  milk: MilkType;
  liter: number;
  rate: number;
  paid: boolean;
}

export interface SyncLog {
  id: string;
  at: string;
  centerId: string;
  records: number;
  status: "ok" | "retry" | "failed";
  via: "Collector app" | "Direct GPRS";
}

export interface RateRule {
  fatRate: number;
  snfRate: number;
  base: number;
  minFat: number;
  minSnf: number;
}
export type RateTable = Record<MilkType, RateRule>;

export interface Thresholds {
  fat: Record<MilkType, number>;
  snf: Record<MilkType, number>;
  temp: number;
}
