import { EXCEL_COLUMNS, type ExcelColumn } from './farmerMaster.rules';
import type { MasterRecord } from './farmerMaster.api';

const loadXlsx = () => import('xlsx');

function save(XLSX: Awaited<ReturnType<typeof loadXlsx>>, wb: import('xlsx').WorkBook, name: string) {
  XLSX.writeFile(wb, name, { compression: true });
}

const widths = [10, 20, 20, 22, 14, 28, 14, 20, 12, 12, 16];

function sheetOf(XLSX: Awaited<ReturnType<typeof loadXlsx>>, rows: Array<Array<string | number>>) {
  const ws = XLSX.utils.aoa_to_sheet([[...EXCEL_COLUMNS], ...rows]);
  ws['!cols'] = widths.map((wch) => ({ wch }));
 
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (const col of [4, 7, 10]) {
    for (let r = 1; r <= range.e.r; r++) {
      const c = ws[XLSX.utils.encode_cell({ r, c: col })];
      if (!c) continue;
      c.t = 's'; c.v = String(c.v ?? ''); c.z = '@';
    }
  }
  return ws;
}

export interface SampleCentre { id: string; code: string; name: string }


export async function downloadSample(centres: SampleCentre[], firstFarmerId: number) {
  const XLSX = await loadXlsx();
  const v = centres[0]?.id ?? '';
  const num = (s: string) => (s && /^\d+$/.test(s) ? Number(s) : s);
  const rows: Array<Array<string | number>> = [
    [firstFarmerId, 'Ravi Patil', 'Ravi Patil', 'Sangli', '9370950000', 'State Bank of India Sangli', 'SBIN0001234', '122110400008311', 1, num(v), ''],
    [firstFarmerId + 1, 'Raj Patil', 'Raj Patil', 'Sangli', '9370950001', 'State Bank of India Sangli', 'SBIN0001234', '122110400008312', 1, num(v), ''],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetOf(XLSX, rows), 'Sheet1');
  const ref = XLSX.utils.aoa_to_sheet([['villageid', 'center name', 'custom station id'], ...centres.map((c) => [num(c.id), c.name, c.code])]);
  ref['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ref, 'VillageIds');
  save(XLSX, wb, 'FarmerAccount_Sample.xlsx');
}


export async function exportRecords(records: MasterRecord[], name: string) {
  const XLSX = await loadXlsx();
  const rows = records.map((r): Array<string | number> => {
    const cells: Record<ExcelColumn, string | number> = {
      farmerid: Number(r.farmerId) || r.farmerId,
      farmername: r.name,
      nameinbank: r.nameInBank,
      farmeraddress: r.address,
      farmercontact: r.mobile,
      farmerbank: r.bank,
      bankifsccode: r.ifsc,
      farmerbankac: r.account,
      farmerstatus: r.active ? 1 : 0,
      villageid: Number(r.vlccid) || r.vlccid,
      farmeraadhaar: r.aadhaar,
    };
    return EXCEL_COLUMNS.map((c) => cells[c]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetOf(XLSX, rows), 'Sheet1');
  save(XLSX, wb, `${name}.xlsx`);
}

export async function readImportFile(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
}
