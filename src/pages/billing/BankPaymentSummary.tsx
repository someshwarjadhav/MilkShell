import type * as React from "react";
import { useMemo, useRef, useState } from "react";
import { Landmark, Search } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { ReportPager } from "../../components/ui/ReportPager";
import { EmptyState } from "../../components/EmptyState";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportBar, ReportPage, Reveal, type ExportKind } from "../../components/ReportKit";
import { ErrorBlock } from "../../components/Widget";
import { useCentreOptions } from "../../hooks/useCentres";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_PAGE_SIZE, GLOBALLABELS } from "../../lib/global";
import { nf, todayISO } from "../../lib/format";
import { cn } from "../../lib/cn";
import { exportCSV, exportExcel, exportPDF, type ExportCol } from "../../lib/export";
import {
  getPaymentSummary,
  PAY_TYPES,
  type PayResult,
  type PayRow,
  type PayType,
} from "../../services/billing/bankPaymentSummary.api";

const dmy = (s: string) => s.split("-").reverse().join("-");
const f2 = (n: number) => n.toFixed(2);
const sum = (rows: PayRow[], pick: (r: PayRow) => number) => rows.reduce((a, r) => a + pick(r), 0);

type Status = "idle" | "loading" | "ready" | "error";

const TH = "whitespace-nowrap border-b border-line bg-soft/70 px-3 py-3 text-xs font-semibold text-mute";
const TD = "whitespace-nowrap border-b border-line/70 px-3 py-2.5 tnum";

const BankPaymentSummary: React.FC = () => {
  const toast = useToast();
  const today = todayISO();
  const centres = useCentreOptions();

  const [type, setType] = useState<PayType>("farmer");
  const [picked, setPicked] = useState<string[]>([]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PayResult | null>(null);
  const [applied, setApplied] = useState({ type: "farmer" as PayType, from: "", to: "", vlcs: [] as string[] });
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const ticket = useRef(0);

  const idLabel = "Id";
  const rows = result?.rows ?? [];
  const total = rows.length;
  const multi = applied.vlcs.length > 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * pageSize, current * pageSize);
  const ready = status === "ready" && total > 0;

  const labelOf = (id: string) => centres.find((c) => c.id === id)?.label ?? id;

  const totals = useMemo(
    () => ({
      qty: sum(rows, (r) => r.totalQty),
      amount: sum(rows, (r) => r.totalAmount),
      incentive: sum(rows, (r) => r.totalIncentive),
      deduction: sum(rows, (r) => r.deduction),
      payable: sum(rows, (r) => r.payable),
    }),
    [rows],
  );

  const submit = async () => {
    if (!picked.length) {
      toast("Select at least one VLC", "warn");
      return;
    }
    if (!from || !to) {
      toast("Select the From Date and To Date", "warn");
      return;
    }
    if (from > to) {
      toast("From Date cannot be after To Date", "warn");
      return;
    }
    const mine = ++ticket.current;
    const ids = centres.map((c) => c.id).filter((id) => picked.includes(id));
    setStatus("loading");
    setError("");
    setPage(1);
    try {
      const r = await getPaymentSummary(type, from, to, ids);
      if (mine !== ticket.current) return;
      setResult(r);
      setApplied({ type, from, to, vlcs: ids });
      setStatus("ready");
      if (r.rows.length === 0 && r.failed.length === 0) toast("Please freeze Milk Bill Process !", "info");
      if (r.failed.length)
        toast(`${r.failed.length} of ${r.total} VLC requests failed, so the list may be incomplete`, "warn");
    } catch (e) {
      if (mine !== ticket.current) return;
      setResult(null);
      setStatus("error");
      setError(e instanceof Error ? e.message : "The payment summary could not be loaded.");
    }
  };

  const cols: Array<ExportCol<PayRow>> = [
    ...(multi ? [{ header: "VLC", value: (r: PayRow) => labelOf(r.vlcId) }] : []),
    { header: idLabel, value: (r) => r.id },
    { header: "Name", value: (r) => r.name },
    { header: "Bank Name", value: (r) => r.bankName },
    { header: "Account No", value: (r) => r.accountNo },
    { header: "IFSC", value: (r) => r.ifsc },
    { header: "Avg Fat", value: (r) => f2(r.avgFat) },
    { header: "Avg Snf", value: (r) => f2(r.avgSnf) },
    { header: "Avg Rate", value: (r) => f2(r.avgRate) },
    { header: "Total Qty", value: (r) => f2(r.totalQty) },
    { header: "Total Amount", value: (r) => f2(r.totalAmount) },
    { header: "Total Incentive", value: (r) => f2(r.totalIncentive) },
    { header: "Deduction Amount", value: (r) => f2(r.deduction) },
    { header: "Payable Amount", value: (r) => f2(r.payable) },
  ];

  const run = (kind: ExportKind) => {
    if (!ready) return;
    const name = `${applied.type}-bank-payment-summary-${applied.from}-to-${applied.to}`;
    if (kind === "csv") {
      exportCSV(name, cols, rows);
      toast("CSV file downloaded");
    } else if (kind === "xls") {
      exportExcel(name, cols, rows);
      toast("XLS file downloaded");
    } else {
      const lead = cols.length - 5;
      exportPDF(name, cols, rows, {
        subtitle: `Bank Payment Summary · ${dmy(applied.from)} To ${dmy(applied.to)}`,
        meta: [
          ["Type", PAY_TYPES.find((t) => t.id === applied.type)?.label ?? ""],
          ["VLC", applied.vlcs.map(labelOf).join(", ")],
        ],
        summary: [
          { label: "Farmers", value: String(total) },
          { label: "Total Qty", value: f2(totals.qty) },
          { label: "Total Amount", value: f2(totals.amount) },
          { label: "Payable Amount", value: f2(totals.payable), tone: "ok" },
        ],
        totals: [
          { text: "Total", span: lead, align: "left" },
          { text: f2(totals.qty) },
          { text: f2(totals.amount) },
          { text: f2(totals.incentive) },
          { text: f2(totals.deduction) },
          { text: f2(totals.payable) },
        ],
        landscape: true,
      });
      toast("Print dialog opened — choose Save as PDF to download");
    }
  };

  return (
    <ReportPage title="Payment Summary">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={Landmark}>Milk Payment</CardTitle>} />
          <div className="grid gap-x-4 gap-y-4 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as PayType)}>
                {PAY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={GLOBALLABELS.vlcName}>
              <MultiSelect options={centres} value={picked} onChange={setPicked} placeholder="Select VLC" />
            </Field>
            <Field label={GLOBALLABELS.fromDate}>
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={GLOBALLABELS.toDate}>
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div className="md:col-span-2 lg:col-span-4">
              <Button
                className="w-full"
                icon={<Search size={16} />}
                loading={status === "loading"}
                disabled={!picked.length}
                onClick={() => void submit()}
              >
                Submit
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={total}
            disabled={!ready}
            kinds={["xls", "pdf", "csv"]}
            onExport={run}
          />

          {status === "loading" && (
            <div className="p-6">
              <MilkLoader label="Loading payment summary…" />
            </div>
          )}
          {status === "error" && <ErrorBlock message={error} onRetry={() => void submit()} />}

          {status !== "loading" && status !== "error" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    {multi && <th className={cn(TH, "text-left")}>VLC</th>}
                    <th className={cn(TH, "text-left")}>{idLabel}</th>
                    <th className={cn(TH, "text-left")}>Name</th>
                    <th className={cn(TH, "text-left")}>Bank Name</th>
                    <th className={cn(TH, "text-left")}>Account No</th>
                    <th className={cn(TH, "text-left")}>IFSC</th>
                    {["Avg Fat", "Avg Snf", "Avg Rate", "Total Qty", "Total Amount", "Total Incentive", "Deduction Amount", "Payable Amount"].map((h) => (
                      <th key={h} className={cn(TH, "text-right")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.key} className="transition-colors hover:bg-brand/[0.06]">
                      {multi && <td className={TD}>{labelOf(r.vlcId)}</td>}
                      <td className={TD}>{r.id}</td>
                      <td className={cn(TD, "font-semibold")}>{r.name || "—"}</td>
                      <td className={TD}>{r.bankName || "—"}</td>
                      <td className={TD}>{r.accountNo || "—"}</td>
                      <td className={TD}>{r.ifsc || "—"}</td>
                      <td className={cn(TD, "text-right")}>{f2(r.avgFat)}</td>
                      <td className={cn(TD, "text-right")}>{f2(r.avgSnf)}</td>
                      <td className={cn(TD, "text-right")}>{f2(r.avgRate)}</td>
                      <td className={cn(TD, "text-right")}>{nf(r.totalQty, 2)}</td>
                      <td className={cn(TD, "text-right")}>{nf(r.totalAmount, 2)}</td>
                      <td className={cn(TD, "text-right")}>{nf(r.totalIncentive, 2)}</td>
                      <td className={cn(TD, "text-right")}>{nf(r.deduction, 2)}</td>
                      <td className={cn(TD, "text-right font-bold")}>{nf(r.payable, 2)}</td>
                    </tr>
                  ))}
                  {ready && (
                    <tr className="bg-soft font-bold">
                      <td className={cn(TD, "border-t-2 border-t-brand")} colSpan={(multi ? 6 : 5) + 3}>
                        Total ({total})
                      </td>
                      <td className={cn(TD, "border-t-2 border-t-brand text-right")}>{nf(totals.qty, 2)}</td>
                      <td className={cn(TD, "border-t-2 border-t-brand text-right")}>{nf(totals.amount, 2)}</td>
                      <td className={cn(TD, "border-t-2 border-t-brand text-right")}>{nf(totals.incentive, 2)}</td>
                      <td className={cn(TD, "border-t-2 border-t-brand text-right")}>{nf(totals.deduction, 2)}</td>
                      <td className={cn(TD, "border-t-2 border-t-brand text-right")}>{nf(totals.payable, 2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {status === "idle" && <EmptyState title="Nothing to show yet" hint="Select the VLCs and dates, then press Submit." />}
              {status === "ready" && total === 0 && <EmptyState title="No record found" hint="Try other VLCs or dates." />}
            </div>
          )}

          {status === "ready" && total > 0 && (
            <ReportPager
              total={total}
              page={current}
              size={pageSize}
              onPage={setPage}
              onSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default BankPaymentSummary;
