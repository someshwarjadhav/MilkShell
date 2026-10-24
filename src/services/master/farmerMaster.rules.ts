export interface FarmerInput {
  
  vlccid: string;
  farmerId: string;
  name: string;
  nameInBank: string;
  address: string;
  mobile: string;
  bank: string;
  ifsc: string;
  account: string;
  aadhaar: string;
  active: boolean;
}

export type FarmerErrors = Partial<Record<keyof FarmerInput, string>>;

export const emptyFarmer = (vlccid = ''): FarmerInput => ({
  vlccid, farmerId: '', name: '', nameInBank: '', address: '', mobile: '', bank: '', ifsc: '', account: '', aadhaar: '', active: true,
});

export const digits = (v: string, max = 20) => v.replace(/\D/g, '').slice(0, max);

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 .'\-]*$/;
const PERSON_RE = /^[A-Za-z][A-Za-z .'\-]*$/;
const BANK_RE = /^[A-Za-z0-9][A-Za-z0-9 .,&'()\-]*$/;
const ADDRESS_RE = /^[A-Za-z0-9][A-Za-z0-9 .,/#&'()\-]*$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^\d{9,18}$/;
const AADHAAR_RE = /^[2-9]\d{11}$/;


export function validateFarmer(f: FarmerInput, original?: FarmerInput): FarmerErrors {
  const e: FarmerErrors = {};
  const id = f.farmerId.trim();
  const name = f.name.trim();
  const nib = f.nameInBank.trim();
  const addr = f.address.trim();
  const bank = f.bank.trim();
  const ifsc = f.ifsc.trim().toUpperCase();

  if (!f.vlccid) e.vlccid = 'Select a center';

  if (!id) e.farmerId = 'Farmer code is required';
  else if (!/^\d+$/.test(id) || Number(id) < 1) e.farmerId = 'Farmer code must be a number greater than 0';
  else if (id.length > 9) e.farmerId = 'Farmer code can have at most 9 digits';

  if (!name) e.name = 'Farmer name is required';
  else if (name.length > 50) e.name = 'Farmer name can have at most 50 characters';
  else if (!NAME_RE.test(name)) e.name = 'Invalid farmer name (letters, numbers, space . - \' only)';

  if (nib) {
    if (nib.length > 50) e.nameInBank = 'Can have at most 50 characters';
    else if (!PERSON_RE.test(nib)) e.nameInBank = 'Invalid name (letters, space . - \' only)';
  }

  if (addr) {
    if (addr.length > 100) e.address = 'Address can have at most 100 characters';
    else if (!ADDRESS_RE.test(addr)) e.address = 'Invalid address';
  }

  if (f.mobile && !MOBILE_RE.test(f.mobile)) e.mobile = 'Invalid Mobile Number';

  if (bank) {
    if (bank.length > 50) e.bank = 'Can have at most 50 characters';
    else if (!BANK_RE.test(bank)) e.bank = 'Invalid bank name';
  }

  if (ifsc && !IFSC_RE.test(ifsc)) e.ifsc = 'Invalid IFSC (e.g. SBIN0001234)';
  if (f.account && !ACCOUNT_RE.test(f.account)) e.account = 'Invalid account number (9 to 18 digits)';
  if (f.aadhaar && !AADHAAR_RE.test(f.aadhaar)) e.aadhaar = 'Invalid Aadhaar number (12 digits)';


  if (!e.account && !e.ifsc) {
    if (f.account && !ifsc) e.ifsc = 'IFSC is required with an account number';
    if (ifsc && !f.account) e.account = 'Account number is required with an IFSC';
  }
 
  if (original) {
    for (const k of Object.keys(e) as Array<keyof FarmerInput>) {
      if (k === 'farmerId' || k === 'name' || k === 'vlccid') continue;
      if (String(f[k]) === String(original[k])) delete e[k];
    }
  }
  return e;
}

export const hasErrors = (e: FarmerErrors) => Object.keys(e).length > 0;


export const EXCEL_COLUMNS = [
  'farmerid', 'farmername', 'nameinbank', 'farmeraddress', 'farmercontact', 'farmerbank',
  'bankifsccode', 'farmerbankac', 'farmerstatus', 'villageid', 'farmeraadhaar',
] as const;
export type ExcelColumn = (typeof EXCEL_COLUMNS)[number];


const HEADER_ALIASES: Record<ExcelColumn, string[]> = {
  farmerid: ['farmerid', 'farmercode', 'farmer', 'farmerno'],
  farmername: ['farmername', 'name'],
  nameinbank: ['nameinbank', 'farmernameasperbank', 'nameasperbank'],
  farmeraddress: ['farmeraddress', 'address'],
  farmercontact: ['farmercontact', 'mobile', 'mobileno', 'mobilenumber', 'contact'],
  farmerbank: ['farmerbank', 'bankname', 'bank'],
  bankifsccode: ['bankifsccode', 'ifsc', 'ifsccode', 'bankifsc'],
  farmerbankac: ['farmerbankac', 'bankaccountno', 'accountno', 'accountnumber', 'bankac'],
  farmerstatus: ['farmerstatus', 'status', 'active', 'isactive'],
  villageid: ['villageid', 'vlccid', 'vlcid', 'centerid', 'centreid'],
  farmeraadhaar: ['farmeraadhaar', 'aadhaar', 'aadhaarno', 'aadharno', 'aadhar'],
};

const norm = (k: unknown) => String(k ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? (Number.isInteger(v) ? v.toFixed(0) : String(v)) : '';
  return String(v).trim();
};

export const statusOf = (v: unknown): boolean | null => {
  const t = cellText(v).toLowerCase();
  if (t === '') return true;
  if (['1', 'true', 'yes', 'y', 'active'].includes(t)) return true;
  if (['0', 'false', 'no', 'n', 'inactive'].includes(t)) return false;
  return null;
};

export interface CentreRef { id: string; code: string }

export interface ImportResult {
  valid: FarmerInput[];
  errors: string[];
 
  total: number;
}

export const MAX_IMPORT_ROWS = 2000;


export function parseImportRows(raw: Record<string, unknown>[], centres: CentreRef[], defaultVlcc: string): ImportResult {
  const errors: string[] = [];
  const valid: FarmerInput[] = [];
  const seen = new Set<string>();
  const byId = new Map<string, string>();
  for (const c of centres) { byId.set(c.id, c.id); if (c.code) byId.set(c.code, c.id); }

  const rows = raw.filter((r) => Object.values(r).some((v) => cellText(v) !== ''));
  if (rows.length === 0) return { valid, errors: ['The file has no farmer rows.'], total: 0 };
  if (rows.length > MAX_IMPORT_ROWS) return { valid, errors: [`The file has ${rows.length} rows. Import at most ${MAX_IMPORT_ROWS} farmers at a time.`], total: rows.length };

  const present = new Set(Object.keys(rows[0] ?? {}).map(norm));
  const hasCol = (c: ExcelColumn) => HEADER_ALIASES[c].some((a) => present.has(a));
  if (!hasCol('farmerid') || !hasCol('farmername')) {
    return { valid, errors: ['The file must have the columns "farmerid" and "farmername". Download the sample file and use its format.'], total: rows.length };
  }

  rows.forEach((row) => {
    const line = raw.indexOf(row) + 2; 
    const get = (c: ExcelColumn): unknown => {
      for (const [k, v] of Object.entries(row)) if (HEADER_ALIASES[c].includes(norm(k)) && cellText(v) !== '') return v;
      return '';
    };
    const vraw = cellText(get('villageid'));
    const vlccid = vraw ? byId.get(vraw) ?? '' : defaultVlcc;
    const fail = (msg: string) => errors.push(`Row ${line}: ${msg}`);
    if (!vlccid) { fail(vraw ? `village id ${vraw} does not belong to your centers` : 'village id is missing'); return; }

    const active = statusOf(get('farmerstatus'));
    if (active === null) { fail('farmerstatus must be 1 (active) or 0 (inactive)'); return; }

    const f: FarmerInput = {
      vlccid,
      farmerId: cellText(get('farmerid')),
      name: cellText(get('farmername')),
      nameInBank: cellText(get('nameinbank')),
      address: cellText(get('farmeraddress')),
      mobile: cellText(get('farmercontact')),
      bank: cellText(get('farmerbank')),
      ifsc: cellText(get('bankifsccode')).toUpperCase(),
      account: cellText(get('farmerbankac')),
      aadhaar: cellText(get('farmeraadhaar')),
      active,
    };
    const e = validateFarmer(f);
    if (hasErrors(e)) { fail(Object.values(e).join('; ')); return; }
    const key = `${f.vlccid}:${Number(f.farmerId)}`;
    if (seen.has(key)) { fail(`farmer code ${f.farmerId} is repeated for village ${vlccid}`); return; }
    seen.add(key);
    valid.push(f);
  });
  return { valid, errors, total: rows.length };
}
