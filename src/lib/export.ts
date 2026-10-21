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

function tableHTML<T>(title: string, cols: ExportCol<T>[], rows: T[]) {
  const th = cols.map((column) => `<th>${htmlEsc(column.header)}</th>`).join('');
  const tr = rows.map((row) => `<tr>${cols.map((column) => `<td>${htmlEsc(column.value(row))}</td>`).join('')}</tr>`).join('');
  const generated = new Date().toLocaleString();
  return `
    <header class="report-header">
      <div class="brand-mark" aria-hidden="true">D</div>
      <div class="report-heading">
        <p class="eyebrow">DHARA DAIRY</p>
        <h1>${htmlEsc(title)}</h1>
        <p class="generated">Generated ${htmlEsc(generated)}</p>
      </div>
    </header>
    <table><thead><tr>${th}</tr></thead><tbody>${tr || `<tr><td colspan="${cols.length}">No records in this report.</td></tr>`}</tbody></table>
    <footer>Dhara Dairy · Data from the SmartX portal</footer>
  `;
}

export function exportExcel<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const html = `<html><head><meta charset="utf-8"></head><body>${tableHTML(name, cols, rows)}</body></html>`;
  download(`${name}.xls`, 'application/vnd.ms-excel', html);
}

/** Extra things a report can put on its PDF. Everything is optional: exportPDF(name, cols, rows) still works. */
export interface PdfOptions {
  /** Line under the title, e.g. "21 Oct 2026 to 21 Oct 2026". */
  subtitle?: string;
  /** Filters used, shown as small chips: [['VLC', 'All'], ['Shift', 'Morning']]. */
  meta?: Array<[string, string]>;
  /** Big numbers above the table. */
  summary?: Array<{ label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }>;
  /** Heading over neighbouring columns, left to right, covering ALL columns. label '' = no group (the column heading spans both lines). */
  groups?: Array<{ label: string; span: number }>;
  /** Last row. Each cell can span columns; "\n" starts a new line inside the cell. */
  totals?: Array<{ text: string | number; span?: number; align?: 'left' | 'right' | 'center' }>;
  /** Default: landscape when the table has more than 8 columns. */
  landscape?: boolean;
  /** Short note printed under the table. */
  note?: string;
}

const isNumberText = (v: string | number) => typeof v === 'number' || /^-?[\d,]+(\.\d+)?$/.test(String(v).trim());
const cell = (v: string | number) => htmlEsc(v).replace(/\n/g, '<br>');

function pdfBody<T>(title: string, cols: ExportCol<T>[], rows: T[], o: PdfOptions) {
  const values = rows.map((row) => cols.map((c) => c.value(row)));
  // A column is right aligned when every value in it is a number.
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
