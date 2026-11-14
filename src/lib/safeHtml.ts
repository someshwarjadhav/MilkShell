const DROP_TAGS = new Set([
  "script", "style", "link", "meta", "base", "iframe", "frame", "frameset", "object",
  "embed", "applet", "form", "input", "button", "textarea", "select", "option",
  "svg", "math", "audio", "video", "source", "template", "noscript", "title", "head",
]);

const KEEP_ATTRS = new Set([
  "colspan", "rowspan", "align", "valign", "width", "height", "border", "cellpadding",
  "cellspacing", "bgcolor", "style", "alt", "title", "src", "scope",
]);

const SAFE_STYLE = (value: string) =>
  !/expression\s*\(|javascript:|url\s*\(|@import|behavior\s*:|-moz-binding/i.test(value);

const SAFE_SRC = (value: string) => /^(https?:|data:image\/(png|jpe?g|gif|webp);)/i.test(value.trim());

function clean(node: Element) {
  for (const child of Array.from(node.children)) {
    if (DROP_TAGS.has(child.tagName.toLowerCase())) {
      child.remove();
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const ok =
        KEEP_ATTRS.has(name) &&
        !(name === "style" && !SAFE_STYLE(attr.value)) &&
        !(name === "src" && !SAFE_SRC(attr.value));
      if (!ok) child.removeAttribute(attr.name);
    }
    if (child.tagName.toLowerCase() === "img" && !child.getAttribute("src")) {
      child.remove();
      continue;
    }
    clean(child);
  }
}

/** Returns safe markup (no <html>/<body> wrapper). Empty string when nothing is left. */
export function sanitizeBillHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  clean(doc.body);
  const out = doc.body.innerHTML.trim();
  return doc.body.textContent?.trim() || doc.body.querySelector("img") ? out : "";
}

/**
 * One bill per record. The portal sends every bill one after another; when the top level
 * is a list of blocks that each hold a table, each block is a record. Anything else is
 * treated as a single bill, so a bill is never cut into pieces.
 */
export function splitBills(safeHtml: string): string[] {
  if (!safeHtml) return [];
  const host = document.createElement("div");
  host.innerHTML = safeHtml;
  const blocks = Array.from(host.children).filter(
    (el) => !["br", "hr"].includes(el.tagName.toLowerCase()) && (el.textContent ?? "").trim() !== "",
  );
  const looksLikeBills =
    blocks.length > 1 &&
    blocks.every((el) => el.tagName.toLowerCase() === "table" || el.querySelector("table"));
  return looksLikeBills ? blocks.map((el) => el.outerHTML) : [safeHtml];
}

export const textOf = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return (host.textContent ?? "").replace(/\s+/g, " ").trim();
};

const PRINT_CSS = `
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:16px;font-size:13px}
  table{border-collapse:collapse;width:100%}
  th,td{padding:4px 8px;text-align:left;vertical-align:top}
  .bill{page-break-inside:avoid;border:1px solid #ccc;padding:12px;margin:0 0 14px}
`;

/** Prints the bills through a hidden frame, so no pop-up window is needed. */
export function printBills(title: string, bills: string[]) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>` +
      bills.map((b) => `<div class="bill">${b}</div>`).join("") +
      `</body></html>`,
  );
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  };
  window.setTimeout(go, 250);
}

/** Excel opens an HTML table saved as .xls, so the bills are downloaded as they look on screen. */
export function downloadBillsExcel(name: string, bills: string[]) {
  const html =
    `<html><head><meta charset="utf-8"></head><body>` +
    bills.map((b) => `<div>${b}</div><br>`).join("") +
    `</body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.xls`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}