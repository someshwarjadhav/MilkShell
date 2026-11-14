import { EXCEL_COLUMNS, type ExcelColumn } from './farmerMaster.rules';
import type { MasterRecord } from './farmerMaster.api';
import { excelFileName } from '../../lib/fileName';

const loadXlsx = () => import('xlsx');

function save(XLSX: Awaited<ReturnType<typeof loadXlsx>>, wb: import('xlsx').WorkBook, name: string) {
  XLSX.writeFile(wb, name, { compression: true });
}

// column widths of the FarmerAccount.xlsx layout (A ... L)
const widths = [23.55, 36.89, 23.44, 17.33, 21.89, 25, 22.55, 27.33, 27, 25.55, 9, 15.22];

/** a number when the text is plain digits that Excel can hold exactly (no leading zero, max 15 digits), else the text itself */
const numeric = (v: string | number | undefined): string | number => {
  const t = String(v ?? '').trim();
  if (t === '') return '';
  return /^(0|[1-9]\d{0,14})$/.test(t) ? Number(t) : t;
};

/**
 * Same sheet as the SmartX Farmer Master Excel: header on row 1, one row per farmer, Sheet1 + empty Sheet2 / Sheet3.
 * Farmer id, contact, account, status, village id and aadhaar are REAL numbers (selecting a column in Excel shows its Sum),
 * whole numbers are shown as they are (no thousands comma, no 9.37E+09).
 */
function sheetOf(XLSX: Awaited<ReturnType<typeof loadXlsx>>, rows: Array<Array<string | number>>) {
  const aoa = [[...EXCEL_COLUMNS], ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  aoa.forEach((row, r) => {
    if (r === 0) return;
    row.forEach((v, c) => {
      if (typeof v !== 'number') return;
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = '0';
    });
  });
  return ws;
}

function withBlankSheets(XLSX: Awaited<ReturnType<typeof loadXlsx>>, wb: import('xlsx').WorkBook) {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet2');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet3');
}

export interface SampleCentre { id: string; code: string; name: string }


export async function downloadSample(centres: SampleCentre[], firstFarmerId: number) {
  const XLSX = await loadXlsx();
  const v = centres[0]?.id ?? '';
  const num = (s: string) => (s && /^\d+$/.test(s) ? Number(s) : s);
  const rows: Array<Array<string | number>> = [
    [firstFarmerId, 'Ravi Patil', 'Ravi Patil', 'Sangli', 9370950000, 'State Bank of India Sangli', 'SBIN0001234', 122110400008311, 1, num(v), '', 'cow'],
    [firstFarmerId + 1, 'Raj Patil', 'Raj Patil', 'Sangli', 9370950001, 'State Bank of India Sangli', 'SBIN0001234', 122110400008312, 1, num(v), '', 'buff'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetOf(XLSX, rows), 'Sheet1');
  withBlankSheets(XLSX, wb);
  const ref = XLSX.utils.aoa_to_sheet([['villageid', 'center name', 'custom station id'], ...centres.map((c) => [num(c.id), c.name, c.code])]);
  ref['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ref, 'VillageIds');
  save(XLSX, wb, excelFileName('FarmerAccount_Sample'));
}


export async function exportRecords(records: MasterRecord[], name: string) {
  const XLSX = await loadXlsx();
  const rows = records.map((r): Array<string | number> => {
    const cells: Record<ExcelColumn, string | number> = {
      farmerid: numeric(r.farmerId),
      farmername: r.name,
      nameinbank: r.nameInBank,
      farmeraddress: r.address,
      farmercontact: numeric(r.mobile),
      farmerbank: r.bank,
      bankifsccode: r.ifsc,
      farmerbankac: numeric(r.account),
      farmerstatus: r.active ? 1 : 0,
      villageid: numeric(r.vlccid),
      farmeraadhaar: numeric(r.aadhaar),
      farmercow: r.cow ?? '',
    };
    return EXCEL_COLUMNS.map((c) => cells[c]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetOf(XLSX, rows), 'Sheet1');
  withBlankSheets(XLSX, wb);
  save(XLSX, wb, excelFileName(name));
}

export async function readImportFile(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
}
