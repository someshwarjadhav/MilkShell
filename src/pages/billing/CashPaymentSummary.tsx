import type * as React from "react";
import { useMemo, useState } from "react";
import { Banknote, Search } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { MilkLoader } from "../../components/MilkLoader";
import {
  CardTitle,
  ReportBar,
  ReportPage,
  Reveal,
  type ExportKind,
} from "../../components/ReportKit";
import { ErrorBlock } from "../../components/Widget";
import { useCentreOptions } from "../../hooks/useCentres";
import {
  exportCSV,
  exportExcel,
  exportPDF,
  type ExportCol,
} from "../../lib/export";
import { DEFAULT_PAGE_SIZE } from "../../lib/global";
import { todayISO } from "../../lib/format";
import {
  getCashSummary,
  SUMMARY_TYPES,
  type SummaryType,
} from "../../services/billing/cashPaymentSummary.api";
import { ApiError } from "../../services/http/errors";
import { pick, type Obj } from "../../services/utils/loose";

interface Row {
  raw: Obj;
  station: string;
  key: string;
}

const get = (r: Row, names: string[]) => pick(r.raw, names);

const FIELDS = {
  id: [
    "farmerid",
    "codeno",
    "farmercode",
    "vlccid",
    "vlcid",
    "villageid",
    "stationid",
  ],
  name: ["farmername", "vlccname", "vlcname", "villagename", "name"],
  cowQty: ["cowqty"],
  buffQty: ["buffaloqty", "buffqty"],
  qty: ["qty", "totalqty", "totalliter", "liter", "ltr", "totalltr"],
  kgFat: ["kgfat"],
  fat: ["avgfat", "fat"],
  kgSnf: ["kgsnf"],
  snf: ["avgsnf", "snf"],
  rate: ["avgrate", "rate", "rtpl"],
  amount: ["amount", "totalamount", "amt"],
  advance: ["advance"],
  cattleFeed: ["cattlefeed"],
  incentive: [["cowcomm"], ["buffcomm"]],
  transport: [["cowtrans"], ["bufftrans"]],
  deposit: [["cowdeposit"], ["buffdeposit"]],
  payable: ["payableamount", "payable", "netamount", "netpayable", "netamt"],
};

const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const sortValue = (s: string): number | string => {
  const n = num(s);
  return n !== null && s.trim() !== "" ? n : s;
};
const money = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const dmy = (s: string) => s.split("-").reverse().join("-");

const numOf = (r: Row, names: string[]): number | null => {
  const t = get(r, names);
  return t === "" ? null : num(t);
};

const partsOf = (r: Row, parts: string[][]): number | null => {
  const v = parts.map((p) => numOf(r, p));
  return v.every((x) => x === null)
    ? null
    : v.reduce<number>((t, x) => t + (x ?? 0), 0);
};
const two = (n: number | null) => (n === null ? "" : n.toFixed(2));

const payableOf = (r: Row): number | null => {
  const sent = numOf(r, FIELDS.payable);
  if (sent !== null) return sent;
  const amount = numOf(r, FIELDS.amount);
  if (amount === null) return null;
  return (
    amount +
    (partsOf(r, FIELDS.incentive) ?? 0) +
    (partsOf(r, FIELDS.transport) ?? 0) -
    (partsOf(r, FIELDS.deposit) ?? 0) -
    (numOf(r, FIELDS.advance) ?? 0) -
    (numOf(r, FIELDS.cattleFeed) ?? 0)
  );
};

const CashPaymentSummary: React.FC = () => {
  const options = useCentreOptions();
  const today = todayISO();

  const [type, setType] = useState<SummaryType>("farmer");
  const [picked, setPicked] = useState<string[]>([]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const [applied, setApplied] = useState<{
    type: SummaryType;
    ids: string[];
    from: string;
    to: string;
  } | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");

  const allChecked = options.length > 0 && picked.length === options.length;
  const range = !!from && !!to && from <= to;

  const toggleAll = () => setPicked(allChecked ? [] : options.map((o) => o.id));
  const toggleOne = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;

  const submit = async () => {
    if (loading || !range || picked.length === 0) return;
    const f = { type, ids: picked, from, to };
    setApplied(f);
    setLoading(true);
    setError(null);
    setNote(null);
    setNeedle("");
    try {
      const results = await Promise.allSettled(
        f.ids.map((id) =>
          getCashSummary({
            type: f.type,
            fromdate: f.from,
            todate: f.to,
            stationid: id,
          }),
        ),
      );
      const merged: Row[] = [];
      const problems: string[] = [];
      results.forEach((res, i) => {
        if (res.status === "fulfilled")
          res.value.forEach((raw, n) =>
            merged.push({ raw, station: f.ids[i], key: `${f.ids[i]}-${n}` }),
          );
        else
          problems.push(
            res.reason instanceof ApiError
              ? res.reason.message
              : "The summary could not be loaded.",
          );
      });
      const unique = [...new Set(problems)];
      if (merged.length === 0 && unique.length > 0) {
        setRows([]);
        setError(unique.join(" "));
        return;
      }
      setRows(merged);
      if (unique.length > 0)
        setNote(
          `${problems.length} of ${f.ids.length} centres: ${unique.join(" ")}`,
        );
    } finally {
      setLoading(false);
    }
  };

  const multi = (applied?.ids.length ?? 0) > 1;
  const isVlcType = applied?.type === "vlc";

  const cols = useMemo(() => {
    const list: Array<{
      key: string;
      header: string;
      align?: "right";
      sum?: (r: Row) => number | null;
      value: (r: Row) => string;
    }> = [];
    if (multi)
      list.push({
        key: "vlc",
        header: "VLC",
        value: (r) => labelOf(r.station),
      });
    const money2 = (
      key: string,
      header: string,
      read: (r: Row) => number | null,
    ) => ({
      key,
      header,
      align: "right" as const,
      sum: read,
      value: (r: Row) => two(read(r)),
    });
    list.push(
      {
        key: "id",
        header: isVlcType ? "VLC Id" : "Farmer Id",
        value: (r) => get(r, FIELDS.id),
      },
      {
        key: "name",
        header: isVlcType ? "VLC Name" : "Farmer Name",
        value: (r) => get(r, FIELDS.name),
      },
      {
        key: "cowQty",
        header: "Cow Qty",
        align: "right",
        sum: (r) => numOf(r, FIELDS.cowQty),
        value: (r) => get(r, FIELDS.cowQty),
      },
      {
        key: "buffQty",
        header: "Buff Qty",
        align: "right",
        sum: (r) => numOf(r, FIELDS.buffQty),
        value: (r) => get(r, FIELDS.buffQty),
      },
      {
        key: "qty",
        header: "Total Qty",
        align: "right",
        sum: (r) => numOf(r, FIELDS.qty),
        value: (r) => get(r, FIELDS.qty),
      },
      {
        key: "kgFat",
        header: "Kg Fat",
        align: "right",
        sum: (r) => numOf(r, FIELDS.kgFat),
        value: (r) => get(r, FIELDS.kgFat),
      },
      {
        key: "fat",
        header: "Avg Fat",
        align: "right",
        value: (r) => get(r, FIELDS.fat),
      },
      {
        key: "kgSnf",
        header: "Kg SNF",
        align: "right",
        sum: (r) => numOf(r, FIELDS.kgSnf),
        value: (r) => get(r, FIELDS.kgSnf),
      },
      {
        key: "snf",
        header: "Avg SNF",
        align: "right",
        value: (r) => get(r, FIELDS.snf),
      },
      {
        key: "rate",
        header: "Avg Rate",
        align: "right",
        value: (r) => get(r, FIELDS.rate),
      },
      {
        key: "amount",
        header: "Total Amount",
        align: "right",
        sum: (r) => numOf(r, FIELDS.amount),
        value: (r) => get(r, FIELDS.amount),
      },
      money2("incentive", "Incentive", (r) => partsOf(r, FIELDS.incentive)),
      money2("transport", "Transport", (r) => partsOf(r, FIELDS.transport)),
      money2("deposit", "Milk Deposit", (r) => partsOf(r, FIELDS.deposit)),
      {
        key: "cattleFeed",
        header: "Cattle Feed",
        align: "right",
        sum: (r) => numOf(r, FIELDS.cattleFeed),
        value: (r) => get(r, FIELDS.cattleFeed),
      },
      {
        key: "advance",
        header: "Advance",
        align: "right",
        sum: (r) => numOf(r, FIELDS.advance),
        value: (r) => get(r, FIELDS.advance),
      },
      money2("payable", "Payable Amount", payableOf),
      { key: "sign", header: "Signature", value: () => "" },
    );
    return list;
  }, [multi, isVlcType, options]);

  const visible = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s
      ? rows.filter((r) =>
          cols
            .map((c) => c.value(r))
            .join(" ")
            .toLowerCase()
            .includes(s),
        )
      : rows;
  }, [rows, needle, cols]);

  const columns: Column<Row>[] = useMemo(
    () =>
      cols.map((c) => ({
        key: c.key,
        header: c.header,
        align: c.align,
        sort: c.key === "sign" ? undefined : (r: Row) => sortValue(c.value(r)),
        cell: (r: Row) =>
          c.key === "sign" ? (
            <span className="inline-block min-w-24 border-b border-dashed border-line">
              &nbsp;
            </span>
          ) : (
            c.value(r) || "—"
          ),
      })),
    [cols],
  );

  const exportCols: ExportCol<Row>[] = useMemo(
    () =>
      cols.map((c) => ({ header: c.header, value: (r: Row) => c.value(r) })),
    [cols],
  );

  const colTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of cols)
      if (c.sum) out[c.key] = visible.reduce((t, r) => t + (c.sum!(r) ?? 0), 0);
    return out;
  }, [cols, visible]);
  const totals = {
    qty: colTotals.qty ?? 0,
    amount: colTotals.amount ?? 0,
    payable: colTotals.payable ?? 0,
  };

  const run = (kind: ExportKind) => {
    if (!applied) return;
    const name = `cash-payment-summary-${applied.from}-${applied.to}`;
    if (kind === "xls") return exportExcel(name, exportCols, visible);
    if (kind === "csv") return exportCSV(name, exportCols, visible);

    const lead = cols.findIndex((c) => c.sum);
    exportPDF("Cash Payment Summary", exportCols, visible, {
      subtitle: `${SUMMARY_TYPES.find((t) => t.id === applied.type)?.label} · ${dmy(applied.from)} to ${dmy(applied.to)}`,
      meta: [
        ["VLC", applied.ids.map(labelOf).join(", ")],
        ["From", dmy(applied.from)],
        ["To", dmy(applied.to)],
      ],
      totals: [
        { text: "Total", span: Math.max(1, lead), align: "left" as const },
        ...cols.slice(Math.max(1, lead)).map((c) => ({
          text: c.sum ? money(colTotals[c.key] ?? 0) : "",
        })),
      ],
    });
  };

  return (
    <ReportPage
      title="Cash Payment Summary"
      subtitle="Choose the type, tick the VLCs and the dates, then press Submit."
    >
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Banknote}>Cash Payment Summary</CardTitle>}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
            <Field label="Type">
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as SummaryType)}
              >
                {SUMMARY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="min-w-0 sm:row-span-2 xl:row-span-1">
              <span className="mb-1.5 block text-sm font-semibold">
                VLC Name
              </span>
              <div
                role="group"
                aria-label="VLC Name"
                className="max-h-44 overflow-y-auto rounded-xl border border-line bg-panel p-2 text-sm"
              >
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 font-bold hover:bg-soft">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--brand,#14969b)]"
                    checked={allChecked}
                    onChange={toggleAll}
                  />
                  All
                </label>
                {options.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-soft"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--brand,#14969b)]"
                      checked={picked.includes(o.id)}
                      onChange={() => toggleOne(o.id)}
                    />
                    <span className="min-w-0 break-words">{o.label}</span>
                  </label>
                ))}
              </div>
              {picked.length === 0 && (
                <span className="mt-1 block text-xs text-mute">
                  Tick at least one VLC.
                </span>
              )}
            </div>

            <Field label="From Date">
              <Input
                type="date"
                value={from}
                max={today}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field
              label="To Date"
              hint={
                from && to && from > to
                  ? "To Date must not be before From Date."
                  : undefined
              }
            >
              <Input
                type="date"
                value={to}
                max={today}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>

            <div className="sm:col-span-2 xl:col-span-4">
              <Button
                className="w-full"
                icon={<Search size={16} />}
                loading={loading}
                disabled={!range || picked.length === 0}
                onClick={() => void submit()}
              >
                Submit
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      {applied && (
        <Reveal delay={0.1}>
          <Card>
            <ReportBar
              count={visible.length}
              hideCount={loading || !!error}
              disabled={loading || !!error || visible.length === 0}
              kinds={["xls", "pdf", "csv"]}
              onExport={run}
              left={
                <div className="w-56 max-w-full">
                  <Input
                    placeholder="Search any column"
                    value={needle}
                    onChange={(e) => setNeedle(e.target.value)}
                  />
                </div>
              }
            />
            {note && !loading && (
              <p className="border-b border-line px-4 py-2 text-xs text-mute sm:px-6">
                {note}
              </p>
            )}
            {loading ? (
              <MilkLoader label="Loading summary…" />
            ) : error ? (
              <ErrorBlock message={error} onRetry={() => void submit()} />
            ) : visible.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-mute">
                {rows.length === 0
                  ? "No record for these filters."
                  : "Nothing matches your search."}
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-3 gap-3 border-b border-line px-4 py-3 text-sm sm:px-6">
                  <div>
                    <dt className="text-xs text-mute">Total Qty</dt>
                    <dd className="font-bold tnum">{money(totals.qty)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mute">Total Amount</dt>
                    <dd className="font-bold tnum">{money(totals.amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mute">Payable Amount</dt>
                    <dd className="font-bold tnum">{money(totals.payable)}</dd>
                  </div>
                </dl>
                <DataTable
                  columns={columns}
                  rows={visible}
                  rowKey={(r) => r.key}
                  pageSize={DEFAULT_PAGE_SIZE}
                  pageSizes={[10, 25, 50, 100, 250]}
                  sizeLabel="Result per page"
                />
              </>
            )}
          </Card>
        </Reveal>
      )}
    </ReportPage>
  );
};

export default CashPaymentSummary;
