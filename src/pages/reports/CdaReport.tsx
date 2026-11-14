import type * as React from "react";
import { useMemo, useRef, useState } from "react";
import { RotateCcw, Scale } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { GroupTable, type GCol } from "../../components/ui/GroupTable";
import { KindChip } from "../../components/KindChip";
import { ErrorBlock } from "../../components/Widget";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportBar, ReportPage, Reveal } from "../../components/ReportKit";
import { CentreField, ScopedPlantField, SubmitButton } from "../../components/ReportFilters";
import { ALL_CENTRES, usePlantScope } from "../../hooks/useCentres";
import { cn } from "../../lib/cn";
import { fmtDate, nf, todayISO } from "../../lib/format";
import { exportExcel, type ExcelOptions, type ExportCol } from "../../lib/export";
import { GLOBALLABELS } from "../../lib/global";
import { vlccCode, vlccName } from "../../services/vlcc/names";
import {
  CDA_ALL_SHIFT_CODE,
  getCdaReport,
  type CdaRaw,
  type CdaSide,
} from "../../services/report/cdaReport.api";

type MilkPick = "cow" | "buffalo" | "mix" | "both";
type ShiftPick = "Morning" | "Evening" | "both";

interface Filters {
  vlc: string;
  from: string;
  to: string;
  milk: MilkPick;
  shift: ShiftPick;
}

interface Metrics {
  weight: number;
  fat: number;
  snf: number;
  kgFat: number;
  kgSnf: number;
  rate: number;
  amount: number;
}
type Diff = Pick<Metrics, "weight" | "fat" | "snf" | "rate" | "amount">;

interface CdaRow {
  id: string;
  vlccId: string;
  customId: string;
  vlcc: string;
  type: "Cow" | "Buffalo" | "Mix";
  from: string;
  to: string;
  composite: Metrics;
  dispatch: Metrics;
  actual: Metrics;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const EMPTY: Metrics = { weight: 0, fat: 0, snf: 0, kgFat: 0, kgSnf: 0, rate: 0, amount: 0 };


function metricsOf(items: CdaRaw[], pick: (r: CdaRaw) => CdaSide): Metrics {
  let qty = 0,
    kgFat = 0,
    kgSnf = 0,
    amount = 0,
    rateQty = 0;
  for (const r of items) {
    const s = pick(r);
    qty += s.qty;
    kgFat += (s.qty * s.fat) / 100;
    kgSnf += (s.qty * s.snf) / 100;
    amount += s.amount;
    rateQty += s.qty * s.rate;
  }
  if (!qty) return { ...EMPTY, amount: r2(amount) };
  return {
    weight: r2(qty),
    fat: r2((kgFat / qty) * 100),
    snf: r2((kgSnf / qty) * 100),
    kgFat: r2(kgFat),
    kgSnf: r2(kgSnf),
    rate: r2(rateQty > 0 ? rateQty / qty : amount / qty),
    amount: r2(amount),
  };
}


const delta = (from: Metrics, to: Metrics): Diff => ({
  weight: r2(to.weight - from.weight),
  fat: r2(to.fat - from.fat),
  snf: r2(to.snf - from.snf),
  rate: r2(to.rate - from.rate),
  amount: r2(to.amount - from.amount),
});
const isEmpty = (m: Metrics): boolean =>
  !m.weight && !m.fat && !m.snf && !m.kgFat && !m.kgSnf && !m.rate && !m.amount;

const MILK_NAME: Record<"C" | "B" | "M", CdaRow["type"]> = { C: "Cow", B: "Buffalo", M: "Mix" };
const tone = (n: number): string => (n > 0 ? "text-ok" : n < 0 ? "text-danger" : "");

const SET: Array<[keyof Metrics, string]> = [
  ["weight", "Weight"],
  ["fat", "Fat"],
  ["snf", "SNF"],
  ["kgFat", "Kg Fat"],
  ["kgSnf", "Kg SNF"],
  ["rate", "Rate"],
  ["amount", "Amount"],
];
const DIFF_SET: Array<[keyof Diff, string]> = [
  ["weight", "Weight"],
  ["fat", "Fat"],
  ["snf", "SNF"],
  ["rate", "Rate"],
  ["amount", "Amount"],
];

const compositeActual = (r: Pick<CdaRow, "composite" | "actual">): Diff => delta(r.composite, r.actual);
const dispatchActual = (r: Pick<CdaRow, "dispatch" | "actual">): Diff => delta(r.dispatch, r.actual);
const compositeDispatch = (r: Pick<CdaRow, "composite" | "dispatch">): Diff => delta(r.composite, r.dispatch);

interface CdaTotal {
  type: string;
  composite: Metrics;
  dispatch: Metrics;
  actual: Metrics;
}

const setCols = (group: string, prefix: string, pick: (r: CdaRow) => Metrics): GCol<CdaRow>[] =>
  SET.map(([k, label]) => ({
    key: `${prefix}-${k}`,
    group,
    header: label,
    align: "right" as const,
    cell: (r: CdaRow) => <span className={cn(k === "amount" && "font-semibold")}>{nf(pick(r)[k], 2)}</span>,
  }));

const diffCols = (group: string, prefix: string, pick: (r: CdaRow) => Diff): GCol<CdaRow>[] =>
  DIFF_SET.map(([k, label]) => ({
    key: `${prefix}-${k}`,
    group,
    header: label,
    align: "right" as const,
    cell: (r: CdaRow) => (
      <span className={cn(k === "amount" && "font-semibold", tone(pick(r)[k]))}>{nf(pick(r)[k], 2)}</span>
    ),
  }));

const COLUMNS: GCol<CdaRow>[] = [
  { key: "vlcId", header: "VLC ID", cell: (r) => <span className="font-semibold">{r.customId}</span> },
  {
    key: "vlcName",
    header: "VLC Name",
    cell: (r) => (
      <span className="block max-w-[190px] truncate font-semibold" title={r.vlcc}>
        {r.vlcc}
      </span>
    ),
  },
  {
    key: "type",
    header: "Type",
    cell: (r) => <KindChip kind={r.type === "Cow" ? "cow" : r.type === "Buffalo" ? "buffalo" : "mix"} />,
  },
  { key: "from", header: "From Date", cell: (r) => fmtDate(r.from) },
  { key: "to", header: "To Date", cell: (r) => fmtDate(r.to) },
  ...setCols("Composite", "c", (r) => r.composite),
  ...setCols("Dispatch", "d", (r) => r.dispatch),
  ...setCols("Actual", "a", (r) => r.actual),
  ...diffCols("Composite-Actual", "ca", compositeActual),
  ...diffCols("Dispatch-Actual", "da", dispatchActual),
  ...diffCols("Composite-Dispatch", "cd", compositeDispatch),
];


const TotalFooter: React.FC<{ total: CdaTotal; from: string; to: string }> = ({ total, from, to }) => {
  const m = (x: Metrics) => SET.map(([k]) => x[k]);
  const d = (x: Diff) => DIFF_SET.map(([k]) => x[k]);
  const values = [
    ...m(total.composite),
    ...m(total.dispatch),
    ...m(total.actual),
    ...d(compositeActual(total)),
    ...d(dispatchActual(total)),
    ...d(compositeDispatch(total)),
  ];
  const diffFrom = SET.length * 3;
  const cell = "border-b border-line/70 px-4 py-3 whitespace-nowrap";
  return (
    <tr className="bg-brand/[0.07] font-bold">
      <td className={cell}>Total</td>
      <td className={cell}>All selected VLCs</td>
      <td className={cell}>{total.type}</td>
      <td className={cell}>{fmtDate(from)}</td>
      <td className={cell}>{fmtDate(to)}</td>
      {values.map((v, i) => (
        <td key={i} className={cn(cell, "text-right tnum", i >= diffFrom && tone(v))}>
          {nf(v, 2)}
        </td>
      ))}
    </tr>
  );
};


async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane));
}

const MILK_OPTIONS: { value: MilkPick; label: string }[] = [
  { value: "cow", label: "Cow" },
  { value: "buffalo", label: "Buffalo" },
  { value: "mix", label: "Mix" },
  { value: "both", label: "Both" },
];
const SHIFT_OPTIONS: { value: ShiftPick; label: string }[] = [
  { value: "Morning", label: "Morning" },
  { value: "Evening", label: "Evening" },
  { value: "both", label: "Both" },
];

const CdaReport: React.FC = () => {
  const toast = useToast();
  const today = todayISO();
  const scope = usePlantScope();
  const runId = useRef(0);

  const [vlc, setVlc] = useState(ALL_CENTRES);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [milk, setMilk] = useState<MilkPick>("cow");
  const [shift, setShift] = useState<ShiftPick>("Morning");

  const [applied, setApplied] = useState<(Filters & { ids: string[] }) | null>(null);
  const [raw, setRaw] = useState<CdaRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsFor = (v: string) => (v === ALL_CENTRES ? scope.centreIds : [v]);
  const currentIds = idsFor(vlc);
  const filtersMatchApplied =
    !!applied &&
    applied.vlc === vlc &&
    applied.from === from &&
    applied.to === to &&
    applied.milk === milk &&
    applied.shift === shift &&
    applied.ids.length === currentIds.length &&
    applied.ids.every((id, i) => id === currentIds[i]);

  const load = async (f: Filters & { ids: string[] }) => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    setRaw([]);
    const milks: Array<"C" | "B" | "M"> =
      f.milk === "cow" ? ["C"] : f.milk === "buffalo" ? ["B"] : f.milk === "mix" ? ["M"] : ["C", "B", "M"];
   
    const shifts: string[] =
      f.shift === "Morning" ? ["M"] : f.shift === "Evening" ? ["E"] : CDA_ALL_SHIFT_CODE ? [CDA_ALL_SHIFT_CODE] : ["M", "E"];
    const tasks = f.ids.flatMap((vlccId) =>
      milks.flatMap((m) => shifts.map((s) => ({ vlccId, milk: m, shift: s }))),
    );
    const got: CdaRaw[] = [];
    let bad = 0;
    let firstError = "";
    await pool(tasks, 6, async (t) => {
      try {
        got.push(...(await getCdaReport({ from: f.from, to: f.to, ...t })));
      } catch (e) {
        
        if (t.milk === "M" && f.milk === "both") return;
        bad += 1;
        firstError ||= e instanceof Error ? e.message : "The CDA report could not be loaded.";
      }
    });
    if (id !== runId.current) return; 
    setRaw(got);
    setError(bad > 0 && bad === tasks.length ? firstError : null);
    if (bad > 0 && bad < tasks.length) toast(`${bad} of ${tasks.length} requests failed, the rest is shown`, "warn");
    setLoading(false);
  };

  const show = () => {
    if (from > to) return toast("From Date cannot be after To Date", "warn");
    if (to > today) return toast("To Date cannot be in the future", "warn");
    const ids = idsFor(vlc);
    if (!vlc || !ids.length) return toast("No VLC is available for this login.", "warn");
    const next = { vlc, from, to, milk, shift, ids };
    setApplied(next);
    void load(next);
  };

  const reset = () => {
    runId.current++;
    scope.setPlant("ALL");
    setVlc(ALL_CENTRES);
    setFrom(today);
    setTo(today);
    setMilk("cow");
    setShift("Morning");
    setApplied(null);
    setRaw([]);
    setError(null);
    setLoading(false);
  };


  const rows = useMemo<CdaRow[]>(() => {
    if (!applied) return [];
    const out: CdaRow[] = [];
    const kinds: Array<"C" | "B" | "M"> =
      applied.milk === "cow" ? ["C"] : applied.milk === "buffalo" ? ["B"] : applied.milk === "mix" ? ["M"] : ["C", "B", "M"];
    const ordered = [...applied.ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const vlccId of ordered) {
      const mine = raw.filter((r) => r.vlccId === vlccId);
      if (!mine.length) continue;
      for (const k of kinds) {
        const items = mine.filter((r) => r.milk === k);
        if (!items.length) continue;
        const composite = metricsOf(items, (r) => r.v);
        const dispatch = metricsOf(items, (r) => r.d);
        const actual = metricsOf(items, (r) => r.f);
        if (isEmpty(composite) && isEmpty(dispatch) && isEmpty(actual)) continue;
        out.push({
          id: `${vlccId}|${k}`,
          vlccId,
          customId: vlccCode(vlccId),
          vlcc: vlccName(vlccId) || vlccId,
          type: MILK_NAME[k],
          from: applied.from,
          to: applied.to,
          composite,
          dispatch,
          actual,
        });
      }
    }
    return out;
  }, [raw, applied]);

  
  const total = useMemo<CdaTotal>(() => {
    const sum = (pick: (r: CdaRow) => Metrics): Metrics => {
      const ms = rows.map(pick);
      const weight = ms.reduce((a, x) => a + x.weight, 0);
      const avg = (f: (x: Metrics) => number): number =>
        weight ? ms.reduce((a, x) => a + x.weight * f(x), 0) / weight : 0;
      return {
        weight: r2(weight),
        fat: r2(avg((x) => x.fat)),
        snf: r2(avg((x) => x.snf)),
        kgFat: r2(ms.reduce((a, x) => a + x.kgFat, 0)),
        kgSnf: r2(ms.reduce((a, x) => a + x.kgSnf, 0)),
        rate: r2(avg((x) => x.rate)),
        amount: r2(ms.reduce((a, x) => a + x.amount, 0)),
      };
    };
    return {
      type: [...new Set(rows.map((r) => r.type))].join(" + "),
      composite: sum((r) => r.composite),
      dispatch: sum((r) => r.dispatch),
      actual: sum((r) => r.actual),
    };
  }, [rows]);


  const exportXls = async () => {
    if (!applied || !filtersMatchApplied) return;
    const cols: ExportCol<CdaRow>[] = [
      { header: "VLC ID", value: (r) => r.customId },
      { header: "VLC Name", value: (r) => r.vlcc },
      { header: "Type", value: (r) => r.type },
      { header: "From Date", value: () => applied.from },
      { header: "To Date", value: () => applied.to },
    ];
    const totals: NonNullable<ExcelOptions["totals"]> = [null, null, null, null, null];
    
    (["Composite", "Dispatch", "Actual"] as const).forEach((group, g) => {
      const w = 5 + g * 7;
      SET.forEach(([k, label]) => {
        const pick = (r: CdaRow) => (group === "Composite" ? r.composite : group === "Dispatch" ? r.dispatch : r.actual)[k];
        cols.push({ header: `${group} ${label}`, value: pick });
        totals.push(k === "fat" || k === "snf" || k === "rate" ? { wavg: w } : "sum");
      });
    });
    const OFFSET = [0, 1, 2, 5, 6]; 
    const GROUP_AT = { Composite: 5, Dispatch: 12, Actual: 19 } as const;
    const DIFFS: Array<[string, keyof typeof GROUP_AT, keyof typeof GROUP_AT, (r: CdaRow) => Diff]> = [
      ["Composite-Actual", "Composite", "Actual", compositeActual],
      ["Dispatch-Actual", "Dispatch", "Actual", dispatchActual],
      ["Composite-Dispatch", "Composite", "Dispatch", compositeDispatch],
    ];
    for (const [label, a, b, fn] of DIFFS) {
      DIFF_SET.forEach(([k, name], j) => {
        cols.push({ header: `${label} ${name}`, value: (r) => fn(r)[k] });
        totals.push({ diff: [GROUP_AT[a] + OFFSET[j]!, GROUP_AT[b] + OFFSET[j]!] });
      });
    }
    const dates =
      applied.from === applied.to ? fmtDate(applied.from) : `${fmtDate(applied.from)} to ${fmtDate(applied.to)}`;
    try {
      await exportExcel(`CDA Report ${dates}`, cols, rows, {
        sheetName: "VLC Difference Report",
        totals,
        totalText: { 1: "All selected VLCs", 2: total.type, 3: applied.from, 4: applied.to },
      });
      toast("XLS file downloaded");
    } catch {
      toast("The Excel file could not be created.", "warn");
    }
  };

  return (
    <ReportPage
      title="CDA Report"
      subtitle="Composite, dispatch and actual milk of every VLC, with the differences between them."
    >
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Scale}>CDA Report</CardTitle>}
            action={
              <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={reset}>
                Reset
              </Button>
            }
          />
          <div className="grid gap-x-4 gap-y-3 px-5 pb-5 pt-3 sm:grid-cols-2 sm:px-6 sm:pb-6 lg:grid-cols-12">
            <ScopedPlantField
              className="lg:col-span-3"
              options={scope.plantOptions}
              value={scope.plant}
              onChange={scope.setPlant}
            />
            <CentreField
              className="lg:col-span-3"
              value={vlc}
              allValue={ALL_CENTRES}
              centres={scope.centreOptions}
              onChange={setVlc}
            />
            <Field label={GLOBALLABELS.milkType} className="lg:col-span-3">
              <Select value={milk} onChange={(e) => setMilk(e.target.value as MilkPick)}>
                {MILK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={GLOBALLABELS.shift} className="lg:col-span-3">
              <Select value={shift} onChange={(e) => setShift(e.target.value as ShiftPick)}>
                {SHIFT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={GLOBALLABELS.fromDate} className="lg:col-span-3">
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={GLOBALLABELS.toDate} className="lg:col-span-3">
              <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <SubmitButton
              className="sm:col-span-2 lg:col-span-6"
              label="Show"
              loading={loading}
              disabled={!vlc || scope.centreIds.length === 0}
              onClick={show}
            />
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={rows.length}
            hideCount={!filtersMatchApplied || loading || !!error}
            disabled={!filtersMatchApplied || loading || !!error || rows.length === 0}
            kinds={["xls"]}
            onExport={() => void exportXls()}
          />
          {!filtersMatchApplied ? (
            <p className="px-6 py-8 text-center text-sm text-mute">
              Choose the options above and press Show to load the CDA report.
            </p>
          ) : loading ? (
            <MilkLoader label="Loading CDA report…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => void load(applied)} />
          ) : (
            <GroupTable
              columns={COLUMNS}
              rows={rows}
              rowKey={(r) => r.id}
              footer={rows.length > 0 ? <TotalFooter total={total} from={applied.from} to={applied.to} /> : undefined}
              empty={<p className="px-6 py-10 text-center text-sm text-mute">No CDA record for this VLC and these dates.</p>}
            />
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default CdaReport;
