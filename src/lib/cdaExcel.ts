import { excelFileName } from "./fileName";

type XlsxApi = typeof import("xlsx");

async function loadXlsx(): Promise<XlsxApi> {
  try {
    const mod = (await import("xlsx-js-style")) as unknown as XlsxApi & { default?: XlsxApi };
    const api = mod.default && mod.default.utils ? mod.default : mod;
    if (api.utils) return api;
  } catch {
    /* plain build below */
  }
  return import("xlsx");
}

export interface CdaExcelMetrics {
  weight: number;
  fat: number;
  snf: number;
  kgFat: number;
  kgSnf: number;
  rate: number;
  amount: number;
}
export type CdaExcelDiff = Pick<CdaExcelMetrics, "weight" | "fat" | "snf" | "rate" | "amount">;

export interface CdaExcelRow {
  customId: string;
  vlcc: string;
  type: string;
  from: string;
  to: string;
  composite: CdaExcelMetrics;
  dispatch: CdaExcelMetrics;
  actual: CdaExcelMetrics;
  compositeActual: CdaExcelDiff;
  dispatchActual: CdaExcelDiff;
  compositeDispatch: CdaExcelDiff;
}

const SET: Array<[keyof CdaExcelMetrics, string]> = [
  ["weight", "Weight"],
  ["fat", "Fat"],
  ["snf", "SNF"],
  ["kgFat", "Kg Fat"],
  ["kgSnf", "Kg SNF"],
  ["rate", "Rate"],
  ["amount", "Amount"],
];
const DIFF: Array<[keyof CdaExcelDiff, string]> = [
  ["weight", "Weight"],
  ["fat", "Fat"],
  ["snf", "SNF"],
  ["rate", "Rate"],
  ["amount", "Amount"],
];
const GROUPS = ["Composite", "Dispatch", "Actual"] as const;
const DIFFS = ["Composite-Actual", "Dispatch-Actual", "Composite-Dispatch"] as const;
/** [second group, first group] index: a difference total = total(second) - total(first) */
const DIFF_FROM: Array<[number, number]> = [
  [2, 0],
  [2, 1],
  [1, 0],
];
/** position of Weight, Fat, SNF, Rate, Amount inside a 7-column group */
const OFFSET = [0, 1, 2, 5, 6];
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function exportCdaExcel(
  dates: string,
  rows: CdaExcelRow[],
  total: { type: string; from: string; to: string },
): Promise<void> {
  const XLSX = await loadXlsx();
  const head = ["VLC ID", "VLC Name", "Type", "From Date", "To Date"];
  for (const g of GROUPS) for (const [, label] of SET) head.push(`${g} ${label}`);
  for (const d of DIFFS) for (const [, label] of DIFF) head.push(`${d} ${label}`);

  const body: Array<Array<string | number>> = rows.map((r) => [
    r.customId,
    r.vlcc,
    r.type,
    r.from,
    r.to,
    ...SET.map(([k]) => r.composite[k]),
    ...SET.map(([k]) => r.dispatch[k]),
    ...SET.map(([k]) => r.actual[k]),
    ...DIFF.map(([k]) => r.compositeActual[k]),
    ...DIFF.map(([k]) => r.dispatchActual[k]),
    ...DIFF.map(([k]) => r.compositeDispatch[k]),
  ]);

  const n = body.length;
  const col = (i: number) => body.map((r) => Number(r[i]) || 0);
  const sum = (i: number) => col(i).reduce((a, b) => a + b, 0);
  const wavg = (i: number, w: number) => {
    const weight = sum(w);
    const v = col(i);
    const wt = col(w);
    return weight ? v.reduce((a, x, j) => a + x * (wt[j] ?? 0), 0) / weight : 0;
  };

  // kind of every numeric column: how its Total is made
  type Kind = { t: "sum" } | { t: "wavg"; w: number } | { t: "diff"; a: number; b: number };
  const kinds: Kind[] = [];
  GROUPS.forEach((_, g) => {
    const w = 5 + g * 7;
    SET.forEach(([k], j) => {
      kinds[5 + g * 7 + j] = k === "fat" || k === "snf" || k === "rate" ? { t: "wavg", w } : { t: "sum" };
    });
  });
  DIFF_FROM.forEach(([second, first], d) => {
    DIFF.forEach((_, j) => {
      kinds[26 + d * 5 + j] = { t: "diff", a: 5 + second * 7 + OFFSET[j]!, b: 5 + first * 7 + OFFSET[j]! };
    });
  });

  const totalOf = (i: number): number => {
    const k = kinds[i]!;
    if (k.t === "sum") return r2(sum(i));
    if (k.t === "wavg") return r2(wavg(i, k.w));
    const a = kinds[k.a]!;
    const b = kinds[k.b]!;
    const val = (kk: Kind, idx: number): number =>
      kk.t === "sum" ? sum(idx) : kk.t === "wavg" ? wavg(idx, kk.w) : 0;
    return r2(val(a, k.a) - val(b, k.b));
  };

  const totals: Array<string | number> = [
    "Total",
    "All selected VLCs",
    total.type,
    total.from,
    total.to,
    ...head.slice(5).map((_, j) => (n ? totalOf(5 + j) : 0)),
  ];

  const ws = XLSX.utils.aoa_to_sheet([head, ...body, totals]);
  ws["!cols"] = head.map((h, i) => ({ wch: i === 1 ? 32 : Math.max(11, h.length + 2) }));
  if (n > 0) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: n, c: head.length - 1 } }) };

  const L = (i: number) => XLSX.utils.encode_col(i);
  const rng = (i: number) => `${L(i)}2:${L(i)}${n + 1}`;
  const totalRow = n + 1;
  for (let r = 1; r <= n + 1; r++) {
    for (let c = 5; c < head.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === "n") cell.z = "#,##0.00";
    }
  }
  if (n > 0) {
    for (let c = 5; c < head.length; c++) {
      const k = kinds[c]!;
      let f: string;
      if (k.t === "sum") f = `SUM(${rng(c)})`;
      else if (k.t === "wavg") f = `IFERROR(SUMPRODUCT(${rng(k.w)},${rng(c)})/SUM(${rng(k.w)}),0)`;
      else f = `${L(k.a)}${totalRow + 1}-${L(k.b)}${totalRow + 1}`;
      ws[XLSX.utils.encode_cell({ r: totalRow, c })] = { t: "n", v: Number(totals[c]) || 0, f, z: "#,##0.00" };
    }
  }
  for (let c = 0; c < head.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: totalRow, c });
    const cell = ws[addr] ?? (ws[addr] = { t: "s", v: "" });
    (cell as unknown as { s?: unknown }).s = { font: { bold: true } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "VLC Difference Report");
  XLSX.writeFile(wb, excelFileName(`CDA Report ${dates}`), { compression: true });
}