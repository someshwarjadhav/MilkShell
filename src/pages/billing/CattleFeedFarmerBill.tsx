import type * as React from "react";
import { useRef, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Fields";
import { ReportPager } from "../../components/ui/ReportPager";
import { EmptyState } from "../../components/EmptyState";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportBar, ReportPage, Reveal, type ExportKind } from "../../components/ReportKit";
import { CentreField } from "../../components/ReportFilters";
import { ErrorBlock } from "../../components/Widget";
import { useToast } from "../../context/ToastContext";
import { useCentreOptions } from "../../hooks/useCentres";
import { DEFAULT_PAGE_SIZE, GLOBALLABELS } from "../../lib/global";
import { todayISO } from "../../lib/format";
import { cn } from "../../lib/cn";
import { exportCSV, exportExcel, exportPDF, type ExportCol } from "../../lib/export";
import { getFarmerBills, type CfBill } from "../../services/billing/cattleFeed.api";

type Status = "idle" | "loading" | "ready" | "error";

const dmy = (s: string) => s.split("-").reverse().join("-");
const n = (v: number) => (v === 0 ? "-" : String(Math.round(v * 100) / 100));
const amt = (v: number) => String(Math.round(v * 100) / 100);
const HEAD = "border border-line bg-soft px-3 py-2 font-bold";
const CELL = "border border-line px-3 py-2";

interface FlatRow {
  farmer: string;
  date: string;
  particulars: string;
  qty: number;
  rate: number;
  sale: number;
  receipt: number;
  mode: string;
  balance: number;
}

const COLS: Array<ExportCol<FlatRow>> = [
  { header: "Farmer", value: (r) => r.farmer },
  { header: "Date", value: (r) => r.date },
  { header: "Particulars", value: (r) => r.particulars },
  { header: "Qty", value: (r) => amt(r.qty) },
  { header: "Rate", value: (r) => amt(r.rate) },
  { header: "Sale", value: (r) => amt(r.sale) },
  { header: "Receipt", value: (r) => amt(r.receipt) },
  { header: "Payment Mode", value: (r) => r.mode },
  { header: "Balance", value: (r) => amt(r.balance) },
];

const flatten = (bills: CfBill[]): FlatRow[] =>
  bills.flatMap((b) => b.lines.map((l) => ({ farmer: `${b.farmerId} ${b.farmerName}`.trim(), ...l })));

const CattleFeedFarmerBill: React.FC = () => {
  const toast = useToast();
  const today = todayISO();
  const [vlc, setVlc] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [bills, setBills] = useState<CfBill[]>([]);
  const [range, setRange] = useState("");
  const [applied, setApplied] = useState({ vlc: "", from: "", to: "" });
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const ticket = useRef(0);

  const submit = async () => {
    if (!vlc) return toast("Select a VLC", "warn");
    if (!from || !to) return toast("Select the From Date and To Date", "warn");
    if (from > to) return toast("From Date cannot be after To Date", "warn");
    const mine = ++ticket.current;
    setStatus("loading");
    setError("");
    try {
      const list = await getFarmerBills(vlc, from, to);
      if (mine !== ticket.current) return;
      setBills(list);
      setRange(`${dmy(from)} To ${dmy(to)}`);
      setApplied({ vlc, from, to });
      setPage(1);
      setStatus("ready");
    } catch (e) {
      if (mine !== ticket.current) return;
      setBills([]);
      setStatus("error");
      setError(e instanceof Error ? e.message : "The farmer bill could not be loaded.");
    }
  };

  const ready = status === "ready" && bills.length > 0;
  const centres = useCentreOptions();
  const total = bills.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const shown = bills.slice((current - 1) * pageSize, current * pageSize);

  const run = (kind: ExportKind) => {
    if (!ready) return;
    const name = `cattlefeed-farmer-bill-${applied.from}-to-${applied.to}`;
    const rows = flatten(bills);
    if (kind === "csv") {
      exportCSV(name, COLS, rows);
      toast("CSV file downloaded");
    } else if (kind === "xls") {
      exportExcel(name, COLS, rows);
      toast("XLS file downloaded");
    } else {
      const sale = bills.reduce((a, b) => a + b.totalSale, 0);
      const receipt = bills.reduce((a, b) => a + b.totalReceipt, 0);
      exportPDF(name, COLS, rows, {
        subtitle: `CattleFeed Farmer Bill · ${range}`,
        meta: [["VLC", centres.find((c) => c.id === applied.vlc)?.label ?? applied.vlc]],
        summary: [
          { label: "Farmers", value: String(total) },
          { label: "Total Sale", value: amt(sale) },
          { label: "Total Receipt", value: amt(receipt) },
          { label: "Balance", value: amt(bills.reduce((a, b) => a + b.closing, 0)), tone: "ok" },
        ],
        landscape: true,
      });
      toast("Print dialog opened — choose Save as PDF to download");
    }
  };

  return (
    <ReportPage title="CattleFeed Farmer Bill">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={UserRound}>User Info</CardTitle>} />
          <div className="grid gap-x-4 gap-y-3 px-5 pb-5 pt-3 sm:grid-cols-2 sm:px-6 sm:pb-6 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]">
            <CentreField value={vlc} onChange={setVlc} label={GLOBALLABELS.vlcName} className="sm:col-span-2 lg:col-span-1" />
            <Field label={GLOBALLABELS.fromDate}>
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={GLOBALLABELS.toDate}>
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <Button className="w-full" icon={<Search size={16} />} loading={status === "loading"} disabled={!vlc} onClick={() => void submit()}>
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
              <MilkLoader label="Loading farmer bills…" />
            </div>
          )}
          {status === "error" && <ErrorBlock message={error} onRetry={() => void submit()} />}
          {status === "idle" && <EmptyState title="Nothing to show yet" hint="Select a VLC and dates, then press Submit." />}
          {status === "ready" && bills.length === 0 && <EmptyState title="No record found" hint="Try another VLC or dates." />}

          {ready && (
            <div className="space-y-4 p-4 sm:p-6">
              {shown.map((b) => (
                <article key={b.farmerId} className="overflow-hidden rounded-2xl border border-line bg-panel">
                  <h3 className="pt-4 text-center text-sm font-bold">FARMER BILL</h3>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3 text-sm">
                    <p>
                      <span className="font-bold">Farmer:</span> {b.farmerId} {b.farmerName}
                    </p>
                    <p>
                      <span className="font-bold">Date:</span> <span className="tnum">{range}</span>
                    </p>
                  </div>
                  <div className="overflow-x-auto px-3">
                    <table className="w-full min-w-[700px] border-collapse text-[13px] tnum">
                      <thead>
                        <tr>
                          <th className={cn(HEAD, "text-center")}>Date</th>
                          <th className={cn(HEAD, "text-center")}>Particulars</th>
                          {["Qty", "Rate", "Sale", "Receipt"].map((h) => (
                            <th key={h} className={cn(HEAD, "text-center")}>{h}</th>
                          ))}
                          <th className={cn(HEAD, "text-center")}>Payment Mode</th>
                          <th className={cn(HEAD, "text-center")}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.lines.map((l, i) => (
                          <tr key={i}>
                            <td className={CELL}>{l.date}</td>
                            <td className={CELL}>{l.particulars}</td>
                            <td className={cn(CELL, "text-center")}>{n(l.qty)}</td>
                            <td className={cn(CELL, "text-center")}>{n(l.rate)}</td>
                            <td className={cn(CELL, "text-center")}>{n(l.sale)}</td>
                            <td className={cn(CELL, "text-center")}>{n(l.receipt)}</td>
                            <td className={cn(CELL, "text-right")}>{l.mode}</td>
                            <td className={cn(CELL, "text-right font-bold")}>{amt(l.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-4 text-sm">
                    <p><span className="font-bold">Total Sale:</span> {amt(b.totalSale)}</p>
                    <p><span className="font-bold">Total Receipt:</span> {amt(b.totalReceipt)}</p>
                    <p><span className="font-bold">Closing Balance:</span> {amt(b.closing)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
          {ready && (
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

export default CattleFeedFarmerBill;
