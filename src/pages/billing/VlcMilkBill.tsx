import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ReceiptText, Search } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { PastDateInput } from "../../components/ui/PastDateInput";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportBar, ReportPage, Reveal, type ExportKind } from "../../components/ReportKit";
import { ErrorBlock } from "../../components/Widget";
import { useCentreOptions } from "../../hooks/useCentres";
import { useToast } from "../../context/ToastContext";
import { exportExcel, exportPDF, type ExportCol } from "../../lib/export";
import { todayISO } from "../../lib/format";
import { validateDateRange } from "../../lib/dateRange";
import { downloadBillsExcel, printBills, sanitizeBillHtml, splitBills, textOf } from "../../lib/safeHtml";
import { getVlcMilkBill } from "../../services/billing/vlcMilkBill.api";
import { ApiError } from "../../services/http/errors";
import { norm, type Obj } from "../../services/utils/loose";

interface Row {
  raw: Obj;
  key: string;
}
interface Col {
  key: string;
  header: string;
  numeric: boolean;
}

const dmy = (s: string) => s.split("-").reverse().join("-");
const cell = (v: unknown) => (v === null || v === undefined || typeof v === "object" ? "" : String(v).trim());
const asNumber = (s: string): number | null => {
  const clean = s.replace(/,/g, "");
  return /^-?\d*\.?\d+$/.test(clean) ? parseFloat(clean) : null;
};

const prettify = (k: string) =>
  k
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])([a-z]*)/gi, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());

/** Columns are read from the rows, so the page follows whatever fields the API sends. */
function columnsOf(rows: Row[]): Col[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(0, 200))
    for (const k of Object.keys(r.raw)) {
      const n = norm(k);
      if (seen.has(n)) continue;
      seen.add(n);
      order.push(k);
    }
  const cols: Col[] = [];
  for (const k of order) {
    const values = rows.map((r) => cell(r.raw[k]));
    if (values.every((v) => v === "")) continue;
    const filled = values.filter((v) => v !== "");
    cols.push({ key: k, header: prettify(k), numeric: filled.every((v) => asNumber(v) !== null) });
  }
  return cols;
}

const PAGE_SIZES = [100, 200, 300];

// The bill is a printed-paper style document, so it stays black on white in light and dark mode.
const PAPER =
  "overflow-x-auto rounded-xl border border-line bg-white p-3 text-sm text-slate-900 shadow-sm sm:p-6 " +
  "[&_table]:w-full [&_table]:border-collapse [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-bold " +
  "[&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap " +
  "[&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-bold [&_h4]:font-bold [&_p]:my-1 [&_img]:max-w-full";

const VlcMilkBill: React.FC = () => {
  const options = useCentreOptions();
  const toast = useToast();
  const today = todayISO();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);

  const [bills, setBills] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [failed, setFailed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);

  const range = !!from && !!to && from <= to;
  const ready = range && options.length > 0;

  const submit = async () => {
    if (loading || options.length === 0) return;
    const rangeError = validateDateRange(from, to);
    if (rangeError) return toast(rangeError, "warn");
    const f = { from, to };
    setApplied(f);
    setLoading(true);
    setError(null);
    setNeedle("");
    setPage(1);
    setFailed(0);
    try {
      const res = await getVlcMilkBill({
        fromdate: f.from,
        todate: f.to,
        stationIds: options.map((o) => o.id),
      });
      setBills(splitBills(sanitizeBillHtml(res.markup)));
      setRows(res.rows.map((raw, n) => ({ raw, key: String(n) })));
      setFailed(res.failed);
    } catch (e) {
      setBills([]);
      setRows([]);
      setError(e instanceof ApiError ? e.message : "The milk bill could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const cols = useMemo(() => columnsOf(rows), [rows]);

  const visibleRows = useMemo(() => {
    const s = needle.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => cols.map((c) => cell(r.raw[c.key])).join(" ").toLowerCase().includes(s));
  }, [rows, needle, cols]);

  const visibleBills = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s ? bills.filter((b) => textOf(b).toLowerCase().includes(s)) : bills;
  }, [bills, needle]);

  // The API answers with table rows, or (older portal) with a ready-made HTML bill.
  const tableMode = rows.length > 0;
  const visible = tableMode ? visibleRows : visibleBills;
  const total = tableMode ? rows.length : bills.length;

  const columns: Column<Row>[] = useMemo(
    () =>
      cols.map((c) => ({
        key: c.key,
        header: c.header,
        align: c.numeric ? ("right" as const) : undefined,
        sort: (r: Row) => {
          const t = cell(r.raw[c.key]);
          const n = c.numeric ? asNumber(t) : null;
          return n !== null ? n : t;
        },
        cell: (r: Row) => cell(r.raw[c.key]) || "—",
      })),
    [cols],
  );
  const exportCols: ExportCol<Row>[] = useMemo(
    () => cols.map((c) => ({ header: c.header, value: (r: Row) => cell(r.raw[c.key]) })),
    [cols],
  );

  const pages = Math.max(1, Math.ceil(visibleBills.length / pageSize));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const start = (page - 1) * pageSize;
  const shown = tableMode ? [] : visibleBills.slice(start, start + pageSize);

  const run = (kind: ExportKind) => {
    if (!applied || visible.length === 0) return;
    const name = `vlc-milk-bill-${applied.from}-${applied.to}`;
    if (tableMode) {
      if (kind === "xls") return void exportExcel(name, exportCols, visibleRows);
      return exportPDF("VLC Milk Bill", exportCols, visibleRows, {
        subtitle: `${dmy(applied.from)} to ${dmy(applied.to)}`,
        meta: [
          ["From", dmy(applied.from)],
          ["To", dmy(applied.to)],
        ],
      });
    }
    if (kind === "xls") return downloadBillsExcel(name, visibleBills);
    printBills("VLC Milk Bill", visibleBills);
  };

  const hasData = !!applied && !loading && !error && visible.length > 0;

  return (
    <ReportPage title="VLC Milk Bill" subtitle="Choose the dates, then press Show Record.">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={ReceiptText}>Milk Bill</CardTitle>} />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
            <Field label="From Date">
              <PastDateInput type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To Date" hint={from && to && from > to ? "To Date must not be before From Date." : undefined}>
              <PastDateInput type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div className="flex items-end sm:col-span-2">
              <Button
                className="w-full"
                icon={<Search size={16} />}
                loading={loading}
                disabled={!ready}
                onClick={() => void submit()}
              >
                Show Record
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* Always on screen, empty until Show Record is pressed */}
      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={hasData ? visible.length : 0}
            hideCount={loading}
            disabled={!hasData}
            kinds={["pdf", "xls"]}
            labels={{ pdf: "Print Bill", xls: "Excel Export" }}
            onExport={run}
            left={
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-48">
                  <Input
                    placeholder="Search any column"
                    value={needle}
                    onChange={(e) => {
                      setNeedle(e.target.value);
                      setPage(1);
                    }}
                    disabled={!applied}
                  />
                </div>
                <label className={tableMode ? "hidden" : "flex items-center gap-2 text-sm"}>
                  <span className="font-bold">Result per page:</span>
                  <div className="w-24">
                    <Select
                      value={String(pageSize)}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </div>
                </label>
              </div>
            }
          />

          {!applied ? (
            <p className="px-6 py-12 text-center text-sm text-mute">
              Pick the dates and press <b>Show Record</b> to see the bill.
            </p>
          ) : loading ? (
            <MilkLoader label="Loading milk bill…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => void submit()} />
          ) : visible.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-mute">
              {total === 0 ? "No record for these dates." : "Nothing matches your search."}
            </p>
          ) : tableMode ? (
            <div>
              {failed > 0 && (
                <p className="px-5 pt-4 text-sm text-warn">{failed} centre(s) could not be loaded, the rest are shown.</p>
              )}
              <DataTable columns={columns} rows={visibleRows} rowKey={(r) => r.key} pageSize={100} />
            </div>
          ) : (
            <div className="space-y-4 p-3 sm:p-5">
              {shown.map((html, i) => (
                <div
                  key={start + i}
                  className={PAPER}
                  // markup was cleaned by sanitizeBillHtml (no scripts, styles, handlers or classes)
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ))}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line pt-4 text-sm text-mute sm:flex-row">
                <p className="tnum">
                  Showing{" "}
                  <b className="text-ink">
                    {start + 1}–{Math.min(start + pageSize, visibleBills.length)}
                  </b>{" "}
                  of {visibleBills.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ChevronLeft size={15} />}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="tnum px-1">
                    {page} / {pages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ChevronRight size={15} />}
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default VlcMilkBill;