import type { CollectionEntry } from './collectionEntry';
import { excelFileName, exactExcelFileName } from './fileName';
import { GLOBALS } from './global';
import { getSession } from '../services/session';
import { exportPDF, loadXlsx, type ColType, type ExportTable } from './tableExport';

/**
 * Bansi's Farmer Collection sheet (All 11-10-26_20-10-26.xlsx):
 *   row 2  From Date / To Date
 *   row 3  Sr No | Farmer Name | Cow | Buffalo | Mix | Total Liter | FAT | SNF | Rate | Amount | Pay Amount | Degree | Quantity In KG | Kg Fat | Kg SNF
 *   per centre: a "VSP Name" row, its farmers, then the centre's own (bold) total row  "1. 500381 - Barbadi ..."
 *   last row: the bold grand "Total :" row
 * Only the Bansi Dairy Nagpur login (user id 307 on the live STIPL server: userReportConfig?userid=307) gets this layout,
 * on the Farmer Collection page (the table on screen and "New Excel Export"). Every other login keeps the normal report.
 */
// 307 = Bansi on the live STIPL server, 259 = the same Bansi Dairy Nagpur login on the DPU server
export const BANSI_USER_IDS: string[] = ['307', '259'];
const BANSI_MCC_LOGIN_IDS: string[] = ['183'];
/** The Bansi layout is only for these logins. Other logins that share Bansi's user id / MCC (for example the LogicShell
 *  login, which is a copy of the Bansi record) are NOT Bansi and keep the normal layout. */
export const BANSI_LOGIN_EMAILS: string[] = ['bansidairynagpur@gmail.com'];

/**
 * static condition: only the Bansi Dairy Nagpur login.
 *   - user id 307 (live STIPL server) is Bansi's own id
 *   - user id 259 / MCC 183 (DPU server) is shared with copies of the Bansi record, so the login e-mail must be Bansi's
 */
export const isBansiUser = (): boolean => {
  const userId = String(GLOBALS.userid ?? '').trim();
  if (userId === '307') return true;
  const sharedRecord = BANSI_USER_IDS.includes(userId) || BANSI_MCC_LOGIN_IDS.includes(String(GLOBALS.mccLoginId ?? '').trim());
  if (!sharedRecord) return false;
  return BANSI_LOGIN_EMAILS.includes((getSession()?.scope ?? '').trim().toLowerCase());
};

/** kept for older callers: Bansi login + VLC "All" */
export const isBansiAll = (centre: string): boolean => centre === 'all' && isBansiUser();

const r2 = (n: number): number => Math.round(n * 100) / 100;
const r1 = (n: number): number => Math.round(n * 10) / 10;
export const bansiDmy = (iso: string): string => {
  const [y = '', m = '', d = ''] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
};
const dmyFile = (iso: string): string => bansiDmy(iso).replace(/\//g, '-');

interface Acc { litres: number; cow: number; buf: number; mix: number; kgFat: number; kgSnf: number; amount: number; clr: number; kg: number }
const blank = (): Acc => ({ litres: 0, cow: 0, buf: 0, mix: 0, kgFat: 0, kgSnf: 0, amount: 0, clr: 0, kg: 0 });

function add(a: Acc, r: CollectionEntry): void {
  a.litres += r.litres;
  if (r.kind === 'cow') a.cow += r.litres;
  else if (r.kind === 'buffalo') a.buf += r.litres;
  else a.mix += r.litres;
  a.kgFat += (r.litres * r.fat) / 100;
  a.kgSnf += (r.litres * r.snf) / 100;
  a.amount += r.amount;
  a.clr += r.litres * (r.clr ?? 0);
  // Quantity In KG: the entry's own Kg when the server sends it, else litres x density (1 + CLR / 1000)
  a.kg += r.kg && r.kg > 0 ? r.kg : r.litres * (1 + ((r.clr ?? 0) > 0 ? (r.clr ?? 0) : 30) / 1000);
}

/** the 13 numbers of one sheet row: Cow, Buffalo, Mix, Total Liter, FAT, SNF, Rate, Amount, Pay Amount, Degree, Quantity In KG, Kg Fat, Kg SNF */
function figures(a: Acc): number[] {
  const l = a.litres;
  return [
    r2(a.cow), r2(a.buf), r2(a.mix), r2(l),
    l ? r1((a.kgFat / l) * 100) : 0,
    l ? r1((a.kgSnf / l) * 100) : 0,
    l ? r2(a.amount / l) : 0,
    r2(a.amount), r2(a.amount),
    l ? r1(a.clr / l) : 0,
    r2(a.kg),
    r2(a.kgFat), r2(a.kgSnf),
  ];
}

export const BANSI_HEAD = ['Sr No', 'Farmer Name', 'Cow', 'Buffalo', 'Mix', 'Total Liter', 'FAT', 'SNF', 'Rate', 'Amount', 'Pay Amount', 'Degree', 'Quantity In KG', 'Kg Fat', 'Kg SNF'];
/** decimals shown per figure column (index 0 = Cow ... 12 = Kg SNF): FAT, SNF and Degree show one decimal */
export const BANSI_DECIMALS = [2, 2, 2, 2, 1, 1, 2, 2, 2, 1, 2, 2, 2];

export type BansiLine =
  | { kind: 'vsp'; key: string }
  | { kind: 'farmer'; key: string; sr: number; name: string; v: number[] }
  | { kind: 'centre'; key: string; text: string; v: number[] }
  | { kind: 'total'; key: string; text: string; v: number[] };

export interface BansiSheet {
  from: string;
  to: string;
  lines: BansiLine[];
}

const idNum = (id: string): number => (/^\d+$/.test(id) ? Number(id) : Number.MAX_SAFE_INTEGER);

const codeNum = (code: string | undefined): number => {
  const t = (code ?? '').trim();
  const n = /^\d+$/.test(t) ? Number(t) : NaN;
  // a station code is a small number (0001 ... 0032); a long number is an id, not the running number
  return Number.isFinite(n) && n > 0 && n < 10000 ? n : NaN;
};

/**
 * Same sheet as the STIPL "All" report: centres in station-code order (1, 2, 3 ...), every centre = "VSP Name" row, its farmers,
 * then its own total row "<no>. <station id> - <village>", and one grand "Total :" row at the end.
 * `codeOf` = the centre's station code from the centre API (0001 ...).
 */
export function buildBansiSheet(rows: CollectionEntry[], from: string, to: string, nameOf: (id: string) => string, codeOf: (id: string) => string = () => ''): BansiSheet {
  const byVlc = new Map<string, CollectionEntry[]>();
  for (const r of rows) {
    const list = byVlc.get(r.stationId);
    if (list) list.push(r); else byVlc.set(r.stationId, [r]);
  }
  const serialFor = (vlc: string, mine: CollectionEntry[]): number => {
    const own = codeNum(codeOf(vlc));
    if (Number.isFinite(own)) return own;
    const fromRows = codeNum(mine.find((r) => codeNum(r.stationCode) > 0)?.stationCode);
    return Number.isFinite(fromRows) ? fromRows : Number.MAX_SAFE_INTEGER;
  };
  const order = [...byVlc.keys()].sort((a, b) => serialFor(a, byVlc.get(a)!) - serialFor(b, byVlc.get(b)!) || a.localeCompare(b, undefined, { numeric: true }));
  const grand = blank();
  const lines: BansiLine[] = [];
  order.forEach((vlc, i) => {
    const mine = byVlc.get(vlc)!;
    lines.push({ kind: 'vsp', key: `vsp|${vlc}` });
    const byFarmer = new Map<string, { name: string; acc: Acc }>();
    const total = blank();
    for (const r of mine) {
      const f = byFarmer.get(r.farmerId) ?? { name: r.farmer, acc: blank() };
      if (!f.name && r.farmer) f.name = r.farmer;
      add(f.acc, r);
      add(total, r);
      add(grand, r);
      byFarmer.set(r.farmerId, f);
    }
    [...byFarmer.entries()]
      .sort((a, b) => idNum(a[0]) - idNum(b[0]) || a[0].localeCompare(b[0]))
      .forEach(([id, f], n) => lines.push({ kind: 'farmer', key: `f|${vlc}|${id}`, sr: n + 1, name: f.name, v: figures(f.acc) }));
    const serial = serialFor(vlc, mine);
    const rowCode = mine.find((r) => r.stationCode && r.stationCode.trim())?.stationCode?.trim();
    const station = rowCode || codeOf(vlc) || vlc;
    const place = mine.find((r) => r.village && r.village.trim())?.village?.trim() || nameOf(vlc);
    lines.push({ kind: 'centre', key: `c|${vlc}`, text: `${Number.isFinite(serial) && serial < Number.MAX_SAFE_INTEGER ? serial : i + 1}. ${station}${place && place !== station ? ` - ${place}` : ''}`, v: figures(total) });
  });
  lines.push({ kind: 'total', key: 'total', text: 'Total :', v: figures(grand) });
  return { from, to, lines };
}

/** file name: "All 11-10-26_20-10-26" or "500381 11-10-26_20-10-26" */
export const bansiFileName = (scope: string, from: string, to: string): string => `${scope} ${dmyFile(from)}_${dmyFile(to)}`;

// like the STIPL sheet: the name column has a fixed width (a long centre text is cut by the next cell), the others fit their numbers
const COL_WIDTHS = [6, 36, 11, 11, 11, 13, 7, 7, 9, 13, 13, 8, 16, 11, 11];

/** `exactName` (Old Excel Export): file saved as exactly that name, sheet called Sheet1, no date in the name */
export async function exportBansiSheet(sheet: BansiSheet, fileScope: string, exactName?: string): Promise<void> {
  const XLSX = await loadXlsx();
  const NCOL = BANSI_HEAD.length;
  const pad = (row: Array<string | number>): Array<string | number> => [...row, ...Array.from({ length: Math.max(0, NCOL - row.length) }, () => '')];
  const aoa: Array<Array<string | number>> = [pad([]), pad(['', 'From Date', bansiDmy(sheet.from), 'To Date', bansiDmy(sheet.to)]), BANSI_HEAD];
  const kinds: Array<BansiLine['kind'] | 'head' | 'date' | 'gap'> = ['gap', 'date', 'head'];
  for (const l of sheet.lines) {
    if (l.kind === 'vsp') aoa.push(pad(['VSP Name']));
    else if (l.kind === 'farmer') aoa.push([l.sr, l.name, ...l.v]);
    else if (l.kind === 'centre') aoa.push(['', l.text, ...l.v]);
    else {
      aoa.push(pad([]));
      kinds.push('gap');
      aoa.push(['', l.text, ...l.v]);
    }
    kinds.push(l.kind);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = COL_WIDTHS.map((wch) => ({ wch }));

  const edge = { style: 'thin', color: { rgb: '000000' } };
  const border = { top: edge, bottom: edge, left: edge, right: edge };
  aoa.forEach((row, r) => {
    const kind = kinds[r];
    if (kind === 'gap') return; // the empty first row and the empty row above "Total :" have no lines
    row.forEach((v, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] ?? (ws[addr] = { t: 's', v: '' });
      if (typeof v === 'number' && c >= 2) cell.z = BANSI_DECIMALS[c - 2] === 1 ? '0.0' : '#,##0.00';
      if (typeof v === 'number' && c === 0) cell.z = '0';
      // bold: heading, "VSP Name" rows, every centre's total row, the grand "Total :" row and the From / To Date labels
      const bold = kind === 'head' || kind === 'vsp' || kind === 'centre' || kind === 'total' || (kind === 'date' && c % 2 === 1);
      (cell as unknown as { s?: unknown }).s = {
        font: { bold },
        border,
        alignment: { horizontal: typeof v === 'number' ? 'right' : 'left', vertical: 'center' },
      };
    });
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, exactName ? 'Sheet1' : 'Report');
  XLSX.writeFile(wb, exactName ? exactExcelFileName(exactName) : excelFileName(bansiFileName(fileScope, sheet.from, sheet.to)), { compression: true });
}

/** PDF Export of the Bansi login: the same lines / columns as the table and the Bansi Excel sheet (Cow, Buffalo, Mix ...) */
export async function exportBansiPdf(sheet: BansiSheet, subtitle: string, filename: string): Promise<void> {
  const blanks = (n: number): string[] => Array.from({ length: n }, () => '');
  const rows: ExportTable['rows'] = sheet.lines.map((l) => {
    if (l.kind === 'vsp') return ['', 'VSP Name', ...blanks(BANSI_HEAD.length - 2)];
    if (l.kind === 'farmer') return [l.sr, l.name, ...l.v];
    return ['', l.text, ...l.v];
  });
  const table: ExportTable = {
    filename,
    title: 'Farmer collection',
    subtitle,
    columns: BANSI_HEAD.map((header, i) => ({
      header,
      type: (i === 0 ? 'int' : i === 1 ? 'text' : BANSI_DECIMALS[i - 2] === 1 ? 'dec1' : 'dec2') as ColType,
    })),
    rows,
  };
  await exportPDF(table);
}

/** kept for older callers */
export async function exportBansiAllExcel(rows: CollectionEntry[], from: string, to: string, nameOf: (id: string) => string): Promise<void> {
  await exportBansiSheet(buildBansiSheet(rows, from, to, nameOf), 'All');
}


/* ------------------------------------------------------------------ */
/*  Bansi "Farmer Collection Report" Excel (Date wise, Morning / Evening / Both)  */
/* ------------------------------------------------------------------ */

export interface BansiReportOptions {
  /** ISO dates of the applied filter */
  from: string;
  to: string;
  /** what was selected on the page */
  shift: 'Morning' | 'Evening' | 'both';
  kind: 'cow' | 'buffalo' | 'mix' | 'both';
  /** 'all' / '' = Multiple Centers, else the selected VLC (station id) */
  centre: string;
  nameOf: (id: string) => string;
  codeOf: (id: string) => string;
}

const REPORT_HEAD = ['Date', 'VLC Id', 'Farmer Id', 'Name', 'Liter', 'Kg', 'Fat', 'Snf', 'Clr', 'Milk Type', 'Shift', 'Rate', 'Amount'];
/** minimum width of every column (the real width also follows the longest value) */
const REPORT_MIN = [12, 14, 11, 20, 10, 10, 7, 7, 8, 11, 10, 8, 13];
const dmyLong = (iso: string, sep: string): string => {
  const [y = '', m = '', d = ''] = iso.slice(0, 10).split('-');
  return `${d}${sep}${m}${sep}${y}`;
};
const kindText = (k: string): string => (k === 'cow' ? 'Cow' : k === 'buffalo' ? 'Buffalo' : k === 'mix' ? 'Mix' : k);

/** file name: "02.11.2026 Evening" (one day) or "02.11.2026 to 05.11.2026 Morning" (range); "All" when both shifts */
export const bansiReportFileName = (o: BansiReportOptions): string => {
  const day = o.from.slice(0, 10) === o.to.slice(0, 10) ? dmyLong(o.from, '.') : `${dmyLong(o.from, '.')} to ${dmyLong(o.to, '.')}`;
  const shift = o.shift === 'both' ? 'All' : o.shift;
  return `${day} ${shift}`;
};

export async function exportBansiReport(rows: CollectionEntry[], o: BansiReportOptions): Promise<void> {
  const XLSX = await loadXlsx();

  // station order = centre code order (1, 2, 3 ...), same as the Bansi sheet
  const serialOf = (id: string): number => {
    const own = codeNum(o.codeOf(id));
    if (Number.isFinite(own)) return own;
    const fromRow = codeNum(rows.find((r) => r.stationId === id && codeNum(r.stationCode) > 0)?.stationCode);
    return Number.isFinite(fromRow) ? fromRow : Number.MAX_SAFE_INTEGER;
  };
  const stationText = (id: string): string => {
    const serial = serialOf(id);
    const rowCode = rows.find((r) => r.stationId === id && r.stationCode && r.stationCode.trim())?.stationCode?.trim();
    const station = rowCode || o.codeOf(id) || id;
    return serial < Number.MAX_SAFE_INTEGER ? `${serial}. ${station}` : station;
  };
  const serials = new Map<string, number>();
  const texts = new Map<string, string>();
  for (const id of new Set(rows.map((r) => r.stationId))) {
    serials.set(id, serialOf(id));
    texts.set(id, stationText(id));
  }
  const shiftNo = (s: string): number => (s === 'Morning' ? 0 : 1);

  // Date wise: date, shift (Morning first), centre, farmer id
  const sorted = [...rows].sort(
    (a, b) =>
      a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) ||
      shiftNo(a.shift) - shiftNo(b.shift) ||
      (serials.get(a.stationId) ?? 0) - (serials.get(b.stationId) ?? 0) ||
      a.stationId.localeCompare(b.stationId, undefined, { numeric: true }) ||
      idNum(a.farmerId) - idNum(b.farmerId) ||
      a.farmerId.localeCompare(b.farmerId) ||
      a.time.localeCompare(b.time),
  );

  const body = sorted.map((r) => {
    const kg = r.kg && r.kg > 0 ? r2(r.kg) : r2(r.litres * 1.03);
    return {
      line: [
        dmyLong(r.date, '/'),
        texts.get(r.stationId) ?? r.stationId,
        r.farmerId,
        (r.farmerRaw ?? r.farmer ?? '').trim(),
        r2(r.litres),
        kg,
        r2(r.fat),
        r2(r.snf),
        r2(r.clr ?? 0),
        kindText(r.kind),
        r.shift,
        r2(r.rate),
        r2(r.amount),
      ] as Array<string | number>,
      litres: r.litres,
    };
  });

  // Total row: Liter / Kg / Amount = sum, Fat / Snf / Clr = weighted by Liter, Rate = Amount / Liter
  const sum = (i: number): number => body.reduce((a, b) => a + (b.line[i] as number), 0);
  const litres = sum(4);
  const wavg = (i: number): number => (litres ? body.reduce((a, b) => a + (b.line[i] as number) * b.litres, 0) / litres : 0);
  const amount = sum(12);
  const total: Array<string | number> = [
    'Total', '', `${body.length} entries`, '',
    r2(litres), r2(sum(5)), r2(wavg(6)), r2(wavg(7)), r2(wavg(8)), '', '', litres ? r2(amount / litres) : 0, r2(amount),
  ];

  const shiftLabel = o.shift === 'both' ? 'All' : o.shift;
  const kindLabel = o.kind === 'both' ? 'All' : kindText(o.kind);
  const vlcLabel =
    !o.centre || o.centre === 'all'
      ? 'Multiple Centers'
      : [stationText(o.centre), o.nameOf(o.centre)].filter((t, i) => t && (i === 0 || t !== stationText(o.centre))).join(' - ');
  const aoa: Array<Array<string | number>> = [
    ['Farmer Collection Report'],
    [`VLC: ${vlcLabel}`],
    [`Period: ${dmyLong(o.from, '-')} to ${dmyLong(o.to, '-')} | Shift: ${shiftLabel} | Milk Type: ${kindLabel}`],
    [],
    REPORT_HEAD,
    ...body.map((b) => b.line),
    total,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // column widths follow the longest value of the column (names are never cut)
  ws['!cols'] = REPORT_HEAD.map((h, c) => {
    const longest = Math.max(h.length, ...aoa.slice(4).map((row) => (c === 2 && row === total ? 0 : String(row[c] ?? '').length)));
    return { wch: Math.max(REPORT_MIN[c] ?? 8, longest + 3) };
  });
  const first = 5; // zero based index of the first data row (row 6)
  const last = aoa.length - 1; // the Total row
  ws['!autofilter'] = { ref: `A5:M${last}` };

  const edge = { style: 'thin', color: { rgb: '000000' } };
  const border = { top: edge, bottom: edge, left: edge, right: edge };
  const NUM_COLS = new Set([4, 5, 6, 7, 8, 11, 12]);
  const style = (addr: string, s: unknown): void => {
    const cell = ws[addr] ?? (ws[addr] = { t: 's', v: '' });
    (cell as unknown as { s?: unknown }).s = s;
  };
  style('A1', { font: { bold: true, sz: 14 } });
  style('A2', { font: { bold: true } });
  style('A3', { font: { bold: true } });
  REPORT_HEAD.forEach((_h, c) =>
    style(XLSX.utils.encode_cell({ r: 4, c }), {
      font: { bold: true },
      fill: { patternType: 'solid', fgColor: { rgb: 'D9E1F2' } },
      border,
      alignment: { horizontal: NUM_COLS.has(c) ? 'right' : 'left', vertical: 'center' },
    }),
  );
  for (let r = first; r <= last; r++) {
    const isTotal = r === last;
    REPORT_HEAD.forEach((_h, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] ?? (ws[addr] = { t: 's', v: '' });
      if (NUM_COLS.has(c) && typeof cell.v === 'number') cell.z = '0.00';
      style(addr, {
        font: { bold: isTotal },
        border,
        ...(isTotal ? { fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } } } : {}),
        alignment: { horizontal: NUM_COLS.has(c) ? 'right' : 'left', vertical: 'center' },
      });
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Farmer Collection');
  XLSX.writeFile(wb, excelFileName(bansiReportFileName(o)), { compression: true });
}
