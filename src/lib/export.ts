import { excelFileName, exactExcelFileName } from './fileName';

export interface ExportCol<T = unknown> {
  header: string;
  value: (row: T) => string | number;
}

const esc = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const htmlEsc = (value: string | number) => String(value).replace(/[&<>"']/g, (char) => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return entities[char] ?? char;
});

function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportCSV<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const head = cols.map((column) => esc(column.header)).join(',');
  const body = rows.map((row) => cols.map((column) => esc(column.value(row))).join(',')).join('\n');
  download(`${name}.csv`, 'text/csv;charset=utf-8', '\ufeff' + head + '\n' + body);
}

/* ------------------------------------------------------------------ */
/*  Excel  (real .xlsx, same engine rules as the SmartX portal)        */
/* ------------------------------------------------------------------ */

export interface ExcelOptions {
  /** true = the file is saved with exactly `name` (no download date added) */
  exactFileName?: boolean;
  /** worksheet name (default "Sheet1") */
  sheetName?: string;
  /**
   * Per-column Total row override (index = column). Columns without an entry keep the automatic rule by heading.
   *   'sum' = =SUM, { wavg: i } = average weighted by column i, { diff: [a, b] } = Total of column b minus Total of column a, null = no total
   */
  totals?: Array<'sum' | { wavg: number } | { diff: [number, number] } | null | undefined>;
  /** fixed text for cells of the Total row (index = column), e.g. { 1: 'All selected VLCs' } */
  totalText?: Record<number, string>;
}

type XlsxApi = typeof import('xlsx');

/**
 * xlsx-js-style = SheetJS with cell styles (bold Total row). It is used when it is installed (`npm install`);
 * if it cannot be loaded the Excel still downloads with the same data and formulas, just without the bold Total row.
 */
async function loadXlsx(): Promise<XlsxApi> {
  try {
    const mod = (await import('xlsx-js-style')) as unknown as XlsxApi & { default?: XlsxApi };
    const api = mod.default && mod.default.utils ? mod.default : mod;
    if (api.utils) return api;
  } catch {
    /* fall back to the plain build below */
  }
  return import('xlsx');
}

/** columns that look like numbers but are identifiers / codes / phone numbers stay text (leading zeros, long numbers) */
const TEXT_HEADER = /(^|\s)(id|code|mobile|phone|contact|account|a\/c|acc|ifsc|aadhaar|aadhar|pan|pin|sample|no\.?|number|date|time|village|name)(\s|$)|farmer id|village id|station id|bill no|sr\.? ?no/i;
const ID_HEADER = /(^|\s)(id|farmer id|village id|station id|sample no|sr\.? ?no|no\.?)(\s|$)/i;

const NUM_TEXT = /^-?\d+(\.\d+)?$/;
const toNumber = (v: string | number): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '');
  return NUM_TEXT.test(t) ? Number(t) : null;
};

type CellKind = 'text' | 'id' | 'int' | 'dec';
interface Shape {
  kind: CellKind;
  decimals: number;
}

function shapeOf(header: string, values: Array<string | number>): Shape {
  const filled = values.filter((v) => !(v === '' || v === null || v === undefined));
  if (!filled.length) return { kind: 'text', decimals: 0 };
  // numbers that arrive as real numbers are numbers, unless the heading says it is an id (then no thousands comma)
  const allNumeric = filled.every((v) => toNumber(v) !== null);
  if (!allNumeric) return { kind: 'text', decimals: 0 };
  const anyRealNumber = filled.some((v) => typeof v === 'number');
  if (!anyRealNumber && TEXT_HEADER.test(header)) return { kind: 'text', decimals: 0 }; // "0012", mobile numbers ... kept as typed
  if (ID_HEADER.test(header.trim())) return { kind: 'id', decimals: 0 };
  let decimals = 0;
  for (const v of filled) {
    const n = toNumber(v)!;
    const frac = (String(n).split('.')[1] ?? '').length;
    decimals = Math.max(decimals, Math.min(3, frac));
  }
  // text like "12.50" typed with 2 decimals keeps 2 decimals
  for (const v of filled) {
    if (typeof v === 'string') decimals = Math.max(decimals, Math.min(3, (v.replace(/,/g, '').split('.')[1] ?? '').length));
  }
  return { kind: decimals ? 'dec' : 'int', decimals };
}

const SUM_HEADERS = ['liter', 'liters', 'litre', 'litres', 'qty', 'total liter', 'kg', 'amount', 'total amount', 'kg fat', 'kg snf', 'net payment', 'total sale', 'total receipt', 'balance', 'milk amount', 'total'];
const AVG_HEADERS = ['fat', 'snf', 'clr', 'water', 'avg fat', 'avg. fat', 'avg snf', 'avg. snf'];
const RATE_HEADERS = ['rate', 'avg rate', 'avg. rate'];

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One worksheet for every Excel export (same rules as SmartX):
 *  header on row 1, real numbers underneath, Total row with REAL formulas (=SUM, weighted average ...),
 *  so clicking a Total cell in Excel shows its formula in the formula bar and the sheet keeps working when a value is edited.
 */
export async function exportExcel<T>(name: string, cols: ExportCol<T>[], rows: T[], options: ExcelOptions = {}): Promise<void> {
  const XLSX = await loadXlsx();
  const raw = rows.map((row) => cols.map((c) => c.value(row)));
  const shapes = cols.map((c, i) => shapeOf(c.header, raw.map((r) => r[i] as string | number)));
  const n = raw.length;
  const ncol = cols.length;

  // cell values: numbers are written as numbers, everything else as typed
  const body: Array<Array<string | number>> = raw.map((r) =>
    r.map((v, i) => {
      const shape = shapes[i]!;
      if (v === '' || v === null || v === undefined) return '';
      if (shape.kind === 'text') return v;
      return toNumber(v) ?? v;
    }),
  );

  const lower = cols.map((c) => c.header.trim().toLowerCase());
  const numericCol = (i: number) => shapes[i]!.kind === 'dec' || shapes[i]!.kind === 'int';
  const qty = lower.findIndex((h, i) => ['liter', 'liters', 'litre', 'litres', 'qty', 'total liter'].includes(h) && numericCol(i));
  const amount = lower.findIndex((h, i) => ['amount', 'total amount', 'milk amount'].includes(h) && numericCol(i));
  type Total = 'sum' | { wavg: number } | { ratio: [number, number] } | { diff: [number, number] } | undefined;
  const totalKind = (i: number): Total => {
    if (!numericCol(i) || n === 0) return undefined;
    const forced = options.totals?.[i];
    if (forced === null) return undefined;
    if (forced) return forced;
    const h = lower[i]!;
    if (SUM_HEADERS.includes(h)) return 'sum';
    if (AVG_HEADERS.includes(h) && qty >= 0 && i !== qty) return { wavg: qty };
    if (RATE_HEADERS.includes(h) && qty >= 0 && amount >= 0) return { ratio: [amount, qty] };
    return undefined;
  };
  const kinds = cols.map((_, i) => totalKind(i));
  const hasTotals = kinds.some(Boolean);

  const colNum = (i: number): number[] => body.map((r) => Number(r[i]) || 0);
  const sumOf = (i: number) => colNum(i).reduce((a, b) => a + b, 0);
  const totals: Array<string | number> = cols.map((_, i) => {
    const k = kinds[i];
    if (!k) return '';
    if (k === 'sum') return r2(sumOf(i));
    if ('diff' in k) return 0; // filled in below, once the totals of its two columns are known
    if ('wavg' in k) {
      const w = sumOf(k.wavg);
      const v = colNum(i);
      const wt = colNum(k.wavg);
      return w ? r2(v.reduce((a, x, j) => a + x * (wt[j] ?? 0), 0) / w) : 0;
    }
    const d = sumOf(k.ratio[1]);
    return d ? r2(sumOf(k.ratio[0]) / d) : 0;
  });
  kinds.forEach((k, i) => {
    if (k && typeof k === 'object' && 'diff' in k) totals[i] = r2(Number(totals[k.diff[1]]) - Number(totals[k.diff[0]]));
  });
  if (hasTotals && totals[0] === '') totals[0] = 'Total';
  if (hasTotals && options.totalText) for (const [i, t] of Object.entries(options.totalText)) totals[Number(i)] = t;

  const aoa: Array<Array<string | number>> = [cols.map((c) => c.header), ...body];
  if (hasTotals) aoa.push(totals);
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // widths: every column fits its longest value or its heading, so nothing is shown as ####
  const fmt = (v: string | number, s: Shape): string => {
    if (typeof v !== 'number') return String(v ?? '');
    if (s.kind === 'dec') return v.toLocaleString('en-IN', { minimumFractionDigits: s.decimals, maximumFractionDigits: s.decimals });
    if (s.kind === 'int') return v.toLocaleString('en-IN');
    return String(v);
  };
  ws['!cols'] = cols.map((c, i) => {
    let longest = c.header.length + 3;
    for (const r of body) longest = Math.max(longest, fmt(r[i]!, shapes[i]!).length);
    if (hasTotals) longest = Math.max(longest, fmt(totals[i]!, shapes[i]!).length);
    const isName = /name/i.test(c.header);
    return { wch: isName ? 32 : Math.min(70, Math.max(9, longest + 2)) };
  });

  // filter arrows on the header row
  if (n > 0) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: n, c: Math.max(0, ncol - 1) } }) };

  // number formats
  const lastRow = n + (hasTotals ? 1 : 0);
  for (let r = 1; r <= lastRow; r++) {
    shapes.forEach((s, ci) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c: ci })];
      if (!cell || cell.t !== 'n') return;
      if (s.kind === 'dec') cell.z = `#,##0.${'0'.repeat(s.decimals)}`;
      else if (s.kind === 'int') cell.z = '#,##0';
      else if (s.kind === 'id') cell.z = '0';
    });
  }

  // Total row = formulas (cached values stay, so viewers that do not recalculate still show the numbers)
  if (hasTotals) {
    const L = (i: number) => XLSX.utils.encode_col(i);
    const rng = (i: number) => `${L(i)}2:${L(i)}${n + 1}`;
    const totalRow = n + 1; // 0-based row index of the Total row
    cols.forEach((_, ci) => {
      const k = kinds[ci];
      if (!k) return;
      let f: string;
      if (k === 'sum') f = `SUM(${rng(ci)})`;
      else if ('diff' in k) f = `${L(k.diff[1])}${totalRow + 1}-${L(k.diff[0])}${totalRow + 1}`;
      else if ('wavg' in k) f = `IFERROR(SUMPRODUCT(${rng(k.wavg)},${rng(ci)})/SUM(${rng(k.wavg)}),0)`;
      else f = `IFERROR(SUM(${rng(k.ratio[0])})/SUM(${rng(k.ratio[1])}),0)`;
      const s = shapes[ci]!;
      const z = s.kind === 'dec' ? `#,##0.${'0'.repeat(Math.max(2, s.decimals))}` : s.kind === 'int' ? '#,##0.00' : '0.00';
      ws[XLSX.utils.encode_cell({ r: totalRow, c: ci })] = { t: 'n', v: Number(totals[ci]) || 0, f, z };
    });
    // the whole Total row is bold (needs xlsx-js-style, otherwise the style is simply ignored)
    for (let ci = 0; ci < ncol; ci++) {
      const addr = XLSX.utils.encode_cell({ r: totalRow, c: ci });
      const cell = ws[addr] ?? (ws[addr] = { t: 's', v: '' });
      (cell as unknown as { s?: unknown }).s = { font: { bold: true } };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (options.sheetName ?? 'Sheet1').slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  XLSX.writeFile(wb, options.exactFileName ? exactExcelFileName(name) : excelFileName(name), { compression: true });
}


export interface PdfOptions {
 
  subtitle?: string;

  meta?: Array<[string, string]>;
 
  summary?: Array<{ label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }>;

  groups?: Array<{ label: string; span: number }>;
 
  totals?: Array<{ text: string | number; span?: number; align?: 'left' | 'right' | 'center' }>;

  landscape?: boolean;
  
  note?: string;
}

const isNumberText = (v: string | number) => typeof v === 'number' || /^-?[\d,]+(\.\d+)?$/.test(String(v).trim());
const cell = (v: string | number) => htmlEsc(v).replace(/\n/g, '<br>');

function pdfBody<T>(title: string, cols: ExportCol<T>[], rows: T[], o: PdfOptions) {
  const values = rows.map((row) => cols.map((c) => c.value(row)));

  const numeric = cols.map((_, i) => values.length > 0 && values.every((r) => String(r[i]).trim() === '' || isNumberText(r[i])));
  const grouped = !!o.groups?.some((g) => g.label);

  let head = '';
  if (grouped) {
    let at = 0;
    let top = '';
    let bottom = '';
    for (const g of o.groups!) {
      if (!g.label) {
        for (let k = 0; k < g.span; k++) top += `<th rowspan="2" class="${numeric[at + k] ? 'r' : ''}">${htmlEsc(cols[at + k].header)}</th>`;
      } else {
        top += `<th colspan="${g.span}" class="grp">${htmlEsc(g.label)}</th>`;
        for (let k = 0; k < g.span; k++) bottom += `<th class="${numeric[at + k] ? 'r' : ''}">${htmlEsc(cols[at + k].header)}</th>`;
      }
      at += g.span;
    }
    head = `<tr>${top}</tr><tr class="sub">${bottom}</tr>`;
  } else {
    head = `<tr>${cols.map((c, i) => `<th class="${numeric[i] ? 'r' : ''}">${htmlEsc(c.header)}</th>`).join('')}</tr>`;
  }

  const body = values.map((r) => `<tr>${r.map((v, i) => `<td class="${numeric[i] ? 'r' : ''}">${cell(v)}</td>`).join('')}</tr>`).join('');
  const foot = o.totals
    ? `<tr class="total">${o.totals.map((t) => `<td colspan="${t.span ?? 1}" class="${t.align === 'right' || (t.align === undefined && isNumberText(t.text)) ? 'r' : t.align === 'center' ? 'c' : ''}">${cell(t.text)}</td>`).join('')}</tr>`
    : '';
  const empty = `<tr><td colspan="${cols.length}" class="empty">No records in this report.</td></tr>`;

  const chips = (o.meta ?? []).filter(([, v]) => v).map(([k, v]) => `<span class="chip"><b>${htmlEsc(k)}</b>${htmlEsc(v)}</span>`).join('');
  const cards = (o.summary ?? []).map((s) => `<div class="card ${s.tone ?? ''}"><p>${htmlEsc(s.label)}</p><strong>${htmlEsc(s.value)}</strong></div>`).join('');
  const generated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return `
    <header class="top">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2.5c3.4 4.3 6 7.4 6 10.9A6 6 0 0 1 6 13.4C6 9.9 8.6 6.8 12 2.5Z" fill="#06222a"/><path d="M9 14.2a3 3 0 0 0 3 3" stroke="#38bec3" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
      </div>
      <div class="ttl">
        <p class="eyebrow">DHARA DAIRY · SMARTX</p>
        <h1>${htmlEsc(title)}</h1>
        ${o.subtitle ? `<p class="sub">${htmlEsc(o.subtitle)}</p>` : ''}
      </div>
      <div class="stamp"><span>Generated</span><b>${htmlEsc(generated)}</b><span>${rows.length} record${rows.length === 1 ? '' : 's'}</span></div>
    </header>
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    ${cards ? `<div class="cards">${cards}</div>` : ''}
    <table><thead>${head}</thead><tbody>${body || empty}${rows.length ? foot : ''}</tbody></table>
    ${o.note ? `<p class="note">${htmlEsc(o.note)}</p>` : ''}
    <footer><span>Dhara Dairy · Data from the SmartX portal</span><span class="pg"></span></footer>
  `;
}

export function exportPDF<T>(title: string, cols: ExportCol<T>[], rows: T[], options: PdfOptions = {}) {
  const report = window.open('', '_blank', 'width=1100,height=760');
  if (!report) return;
  const landscape = options.landscape ?? cols.length > 8;

  report.document.write(`<!doctype html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${htmlEsc(title)}</title>
      <style>
        :root { color-scheme: light; --deep:#0e2a3a; --brand:#14969b; --light:#38bec3; --line:#d6e2e8; --soft:#f0f6f7; --mute:#627d8c; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 28px; color: var(--deep); background: #fff; font: 12px/1.45 Inter, "Segoe UI", ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .top { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding: 18px 22px; color: #fff; border-radius: 16px; border-bottom: 5px solid var(--brand); background: linear-gradient(120deg, #0e2a3a 0%, #123c4f 60%, #0f6c73 100%); }
        .logo { display: grid; width: 50px; height: 50px; flex: 0 0 auto; place-items: center; border-radius: 15px; background: var(--light); }
        .ttl { min-width: 0; flex: 1; }
        .eyebrow { margin: 0 0 3px; color: #8edadd; font-size: 9.5px; font-weight: 800; letter-spacing: .16em; }
        h1 { margin: 0; font-size: 22px; line-height: 1.2; overflow-wrap: anywhere; }
        .top .sub { margin: 4px 0 0; color: #d4e5e9; font-size: 12px; }
        .stamp { display: grid; gap: 1px; text-align: right; font-size: 10px; color: #b9d3d8; white-space: nowrap; }
        .stamp b { color: #fff; font-size: 11.5px; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .chip { padding: 4px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--soft); font-size: 11px; }
        .chip b { margin-right: 6px; color: var(--brand); font-weight: 700; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
        .card { padding: 11px 14px; border: 1px solid var(--line); border-left: 4px solid var(--brand); border-radius: 12px; background: #fff; }
        .card.ok { border-left-color: #26a06a; } .card.warn { border-left-color: #e09628; } .card.danger { border-left-color: #da4e4e; }
        .card p { margin: 0; color: var(--mute); font-size: 10.5px; font-weight: 600; }
        .card strong { display: block; margin-top: 2px; font-size: 17px; letter-spacing: -.01em; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; font-size: 11px; }
        thead { display: table-header-group; }
        th { padding: 9px 9px; color: #fff; background: var(--brand); text-align: left; font-weight: 700; white-space: nowrap; border-right: 1px solid rgba(255,255,255,.18); }
        th.grp { background: var(--deep); text-align: center; font-size: 11.5px; letter-spacing: .02em; }
        tr.sub th { background: #1a7f84; }
        th.r, td.r { text-align: right; font-variant-numeric: tabular-nums; }
        td.c { text-align: center; }
        td { padding: 7px 9px; border-top: 1px solid var(--line); border-right: 1px solid #e8f0f3; vertical-align: top; }
        tbody tr:nth-child(even) td { background: var(--soft); }
        tr.total td { padding: 10px 9px; border-top: 2px solid var(--brand); background: #e3f3f4 !important; font-weight: 800; font-variant-numeric: tabular-nums; }
        td.empty { padding: 28px; text-align: center; color: var(--mute); }
        .note { margin: 12px 0 0; color: var(--mute); font-size: 10.5px; }
        footer { display: flex; justify-content: space-between; margin-top: 18px; padding-top: 9px; border-top: 1px solid var(--line); color: var(--mute); font-size: 10px; }
        @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm 14mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9px sans-serif; color: #627d8c; } }
        @media print { body { padding: 0; } tr { break-inside: avoid; } .top, .cards, .chips { break-inside: avoid; } }
        @media (max-width: 700px) { body { padding: 14px; } .top { flex-wrap: wrap; } .stamp { text-align: left; } table { font-size: 9px; } }
      </style>
    </head><body>${pdfBody(title, cols, rows, options)}</body></html>`);
  report.document.close();
  report.focus();
  window.setTimeout(() => report.print(), 400);
}
