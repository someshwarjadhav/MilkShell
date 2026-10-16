export interface ExportCol<T = any> {
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
        <p class="eyebrow">DHARA DAIRY CLOUD</p>
        <h1>${htmlEsc(title)}</h1>
        <p class="generated">Generated ${htmlEsc(generated)} · Demo report</p>
      </div>
    </header>
    <table><thead><tr>${th}</tr></thead><tbody>${tr || `<tr><td colspan="${cols.length}">No records in this report.</td></tr>`}</tbody></table>
    <footer>Dhara dairy cloud · Sample data — verify figures before operational use</footer>
  `;
}

/** Opens a formatted sheet in Excel-compatible HTML format. */
export function exportExcel<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const html = `<html><head><meta charset="utf-8"></head><body>${tableHTML(name, cols, rows)}</body></html>`;
  download(`${name}.xls`, 'application/vnd.ms-excel', html);
}

/** Opens a branded print view; choose Save as PDF in the browser print dialog. */
export function exportPDF<T>(title: string, cols: ExportCol<T>[], rows: T[]) {
  const report = window.open('', '_blank', 'width=1000,height=700');
  if (!report) return;

  report.document.write(`<!doctype html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${htmlEsc(title)}</title>
      <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 32px; color: #0e2a3a; background: #fff; font: 13px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding: 20px 24px; color: #fff; background: #0e2a3a; border-radius: 16px; border-bottom: 5px solid #14969b; }
        .brand-mark { display: grid; width: 48px; height: 48px; place-items: center; flex: 0 0 auto; color: #06222a; background: #38bec3; border-radius: 14px; font-size: 24px; font-weight: 800; }
        .report-heading { min-width: 0; }
        .eyebrow { margin: 0 0 3px; color: #8edadd; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
        h1 { margin: 0; font-size: 22px; line-height: 1.2; overflow-wrap: anywhere; }
        .generated { margin: 5px 0 0; color: #d4e5e9; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #d6e2e8; font-size: 11px; }
        thead { display: table-header-group; }
        th { padding: 9px 8px; color: #fff; background: #14969b; text-align: left; font-weight: 700; }
        td { padding: 7px 8px; border: 1px solid #d6e2e8; }
        tbody tr:nth-child(even) { background: #f0f6f7; }
        footer { margin-top: 18px; padding-top: 10px; color: #627d8c; border-top: 1px solid #d6e2e8; font-size: 10px; }
        @page { size: auto; margin: 14mm; }
        @media print { body { padding: 0; } tr { break-inside: avoid; } }
        @media (max-width: 600px) { body { padding: 16px; } .report-header { padding: 16px; } h1 { font-size: 18px; } table { font-size: 9px; } th, td { padding: 6px 5px; } }
      </style>
    </head><body>${tableHTML(title, cols, rows)}</body></html>`);
  report.document.close();
  report.focus();
  window.setTimeout(() => report.print(), 300);
}
