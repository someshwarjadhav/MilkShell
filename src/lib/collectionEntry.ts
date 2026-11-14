import type { FarmerRow } from '../services/mappers/farmer.mapper';
import { isoFromTrdate } from '../services/utils/date';
import { vlccCode, vlccName } from '../services/vlcc/names';
import { time24 } from './format';
import { titleCase } from './titleCase';

export type Shift = 'Morning' | 'Evening';
export type MilkKind = 'cow' | 'buffalo' | 'mix';

/**
 * One Farmer Collection row in the shape the SmartX report uses (and the STIPL Old / New Excel + Bansi sheets read).
 * `stationId` = the backend VLC id (used only to group / filter); `stationCode` = the CUSTOM station id that is shown to the user.
 */
export interface CollectionEntry {
  id: string;
  stationId: string;
  date: string; // ISO yyyy-mm-dd
  time: string;
  shift: Shift;
  farmerId: string;
  farmer: string;
  /** name exactly as the server sends it (original case, empty when the server has none) - used by the Excel exports */
  farmerRaw?: string;
  centre: string;
  kind: MilkKind;
  litres: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
  sampleNo?: string;
  kg?: number;
  clr?: number;
  water?: number;
  village?: string;
  /** custom station id as it is shown (falls back to the backend id) */
  stationCode?: string;
  branchId?: string;
}

const toISO = (raw: string): string => {
  const s = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = isoFromTrdate(s);
  if (parsed) return parsed;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const KIND_RANK: Record<string, number> = { cow: 0, buffalo: 1, mix: 2 };

const rowOrder = (r: CollectionEntry): string => {
  const id = /^\d+$/.test(r.farmerId) ? String(Number(r.farmerId)).padStart(8, '0') : r.farmerId;
  return `${r.date}|${r.shift === 'Morning' ? 0 : 1}|${KIND_RANK[r.kind] ?? 3}|${id}|${time24(r.time)}`;
};

/** FarmerRow (portal API) -> CollectionEntry, sorted like the SmartX Farmer Collection table. */
export function toCollectionEntries(rows: FarmerRow[]): CollectionEntry[] {
  const used = new Map<string, number>();
  const titled = new Map<string, string>();
  const title = (v: string): string => {
    let t = titled.get(v);
    if (t === undefined) {
      t = titleCase(v);
      titled.set(v, t);
    }
    return t;
  };
  const list = rows.map((r): CollectionEntry => {
    const date = toISO(r.date);
    const shift: Shift = r.shift === 'Evening' ? 'Evening' : 'Morning';
    const kind: MilkKind = r.milk === 'cow' || r.milk === 'buffalo' ? r.milk : 'mix';
    const base = `${r.vlccid}|${r.farmerId}|${date}|${shift}|${kind}|${r.sampleNo}|${r.time}|${r.liter}|${r.amount}`;
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return {
      id: n ? `${base}#${n}` : base,
      stationId: r.vlccid,
      date,
      time: r.time || '',
      shift,
      farmerId: r.farmerId,
      farmer: title(r.farmerName),
      farmerRaw: r.rawName,
      centre: title(vlccName(r.vlccid) || r.village || r.vlccid),
      kind,
      litres: r.liter,
      fat: r.fat,
      snf: r.snf,
      rate: r.rate,
      amount: r.amount,
      sampleNo: r.sampleNo,
      kg: r.kg,
      clr: r.clr,
      water: r.water,
      village: r.village,
      // the custom station id of the VLC (CustomStationId); the row's own stationcode, then the backend id, only when there is none
      stationCode: vlccCode(r.vlccid) !== r.vlccid ? vlccCode(r.vlccid) : r.stationCode || vlccCode(r.vlccid),
      branchId: r.branchId || undefined,
    };
  });
  const keyed = list.map((r) => [rowOrder(r), r] as const);
  keyed.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return keyed.map((x) => x[1]);
}
