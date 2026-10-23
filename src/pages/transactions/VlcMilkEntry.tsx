import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, RotateCcw, Save, Milk } from "lucide-react";
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
} from "../../components/ReportKit";
import { ErrorBlock } from "../../components/Widget";
import { exportExcel, type ExportCol } from "../../lib/export";
import { useToast } from "../../context/ToastContext";
import { fmtDate, nf, todayISO } from "../../lib/format";
import { DEFAULT_PAGE_SIZE, GLOBALSSHIFT } from "../../lib/global";
import { useCenters } from "../../hooks/useSessionData";
import { getSession } from "../../services/session";
import { vlccOption, vlccTitle } from "../../services/vlcc/names";
import {
  getVlcMilk,
  postVlcMilk,
  type VlcMilkRow,
} from "../../services/transaction/vlcMilk.api";
import { ApiError } from "../../services/http/errors";
import { norm } from "../../services/utils/loose";

const SHIFTS = GLOBALSSHIFT.shiftOptions.filter(
  (s) => s.Id === "M" || s.Id === "E",
);
const MILKS = [
  { Id: "C", Name: "Cow" },
  { Id: "B", Name: "Buffalo" },
  { Id: "M", Name: "Mix" },
];

const val = (r: VlcMilkRow, ...keys: string[]): string => {
  const wanted = keys.map(norm);
  for (const k of Object.keys(r)) {
    if (
      wanted.includes(norm(k)) &&
      r[k] !== null &&
      r[k] !== undefined &&
      String(r[k]).trim() !== ""
    )
      return String(r[k]).trim();
  }
  return "";
};

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

const clrFrom = (snf: number, fat: number) => r1((snf - 0.21 * fat - 0.36) * 4);

const COLS: Array<{
  key: string;
  header: string;
  align?: "right";
  get: (r: VlcMilkRow) => string;
}> = [
  {
    key: "date",
    header: "Date",
    get: (r) => val(r, "trdate", "entrydate", "dsdtdate", "date", "dtdate"),
  },
  {
    key: "vlc",
    header: "VLC Name",
    get: (r) =>
      val(r, "villagename", "vlcname", "vlcc name", "name") ||
      vlccTitle(val(r, "vlccid", "vlcid", "id")),
  },
  {
    key: "liter",
    header: "Liter",
    align: "right",
    get: (r) => val(r, "qty", "liter", "ltr", "weight", "weightltr"),
  },
  {
    key: "kg",
    header: "kg",
    align: "right",
    get: (r) => val(r, "kg", "weightkg"),
  },
  { key: "fat", header: "Fat", align: "right", get: (r) => val(r, "fat") },
  { key: "snf", header: "SNF", align: "right", get: (r) => val(r, "snf") },
  { key: "clr", header: "CLR", align: "right", get: (r) => val(r, "clr") },
  { key: "milk", header: "Milk Type", get: (r) => val(r, "milktype", "milk") },
  { key: "shift", header: "Shift", get: (r) => val(r, "shift") },
  {
    key: "rate",
    header: "Rate",
    align: "right",
    get: (r) => val(r, "rate", "rtpl"),
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    get: (r) => val(r, "amount"),
  },
];

interface Pending {
  vlc: string;
  shift: string;
  date: string;
  qty: number;
  fat: number;
  snf: number;
  clr: number;
  milk: string;
  row: VlcMilkRow;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const same = (a: number, b: string) =>
  num(b) !== null && Math.abs((num(b) as number) - a) < 0.005;
const sameMilk = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x));
};
const matches = (p: Pending, r: VlcMilkRow) =>
  same(p.qty, val(r, "qty", "liter", "ltr", "weight")) &&
  same(p.fat, val(r, "fat")) &&
  same(p.snf, val(r, "snf")) &&
  same(p.clr, val(r, "clr")) &&
  sameMilk(val(r, "milktype", "milk"), p.milk);

const sortValue = (s: string): number | string =>
  s !== "" && Number.isFinite(Number(s)) ? Number(s) : s;

const VlcMilkEntry: React.FC = () => {
  const toast = useToast();
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];
  const ids = centers.length ? centers.map((c) => c.id) : sessionIds;

  const [vlc, setVlc] = useState("");
  const [shift, setShift] = useState("M");
  const [milk, setMilk] = useState("C");
  const [date, setDate] = useState(todayISO());
  const [qty, setQty] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [clr, setClr] = useState("");

  const [applied, setApplied] = useState<{
    vlc: string;
    shift: string;
    date: string;
  } | null>(null);

  const [rows, setRows] = useState<VlcMilkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [needle, setNeedle] = useState("");
  const stamp = useRef(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const pendingRef = useRef<Pending[]>([]);
  pendingRef.current = pending;

  useEffect(() => {
    if (!vlc && ids.length) setVlc(ids[0]);
  }, [vlc, ids]);

  const load = useCallback(
    async (silent = false) => {
      if (!applied) return;
      const { vlc: aVlc, shift: aShift, date: aDate } = applied;
      if (!aVlc || !aDate) return;
      const me = ++stamp.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const got = await getVlcMilk(aVlc, aShift, aDate);
        if (me === stamp.current) setRows(got);
      } catch (e) {
        if (me !== stamp.current) return;
        setRows([]);
        setError(
          e instanceof ApiError
            ? e.message
            : "The entries could not be loaded.",
        );
      } finally {
        if (me === stamp.current) setLoading(false);
      }
    },
    [applied],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPending((p) =>
      p.some((x) => rows.some((r) => matches(x, r)))
        ? p.filter((x) => !rows.some((r) => matches(x, r)))
        : p,
    );
  }, [rows]);

  const onFat = (v: string) => {
    setFat(v);
    const f = num(v);
    const s = num(snf);
    if (f !== null && s !== null) setClr(String(clrFrom(s, f)));
    else setClr("");
  };
  const onSnf = (v: string) => {
    setSnf(v);
    const s = num(v);
    const f = num(fat);
    if (s !== null && f !== null) setClr(String(clrFrom(s, f)));
    else setClr("");
  };

  const valid =
    !!vlc &&
    !!date &&
    [qty, fat, snf, clr].every((x) => num(x) !== null) &&
    (num(qty) ?? 0) > 0;

  const clearForm = () => {
    setQty("");
    setFat("");
    setSnf("");
    setClr("");
  };

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const q = num(qty) as number;
    const entry = {
      vlccid: vlc,
      shift,
      milktype: milk,
      entrydate: date,
      qty: String(q),
      fat: String(num(fat)),
      snf: String(num(snf)),
      clr: String(num(clr)),
    };
    const tableIsOnThese =
      !!applied &&
      applied.vlc === vlc &&
      applied.shift === shift &&
      applied.date === date;
    const milkName = MILKS.find((m) => m.Id === milk)?.Name ?? milk;
    const shiftName = SHIFTS.find((x) => x.Id === shift)?.Name ?? shift;
    try {
      const message = await postVlcMilk(entry);
      toast(message && message.length < 80 ? message : "Milk entry saved");
      if (!tableIsOnThese) {
        clearForm();
        return;
      }
      const p: Pending = {
        vlc,
        shift,
        date,
        qty: q,
        fat: num(fat) as number,
        snf: num(snf) as number,
        clr: num(clr) as number,
        milk: milkName,
        row: {
          trdate: fmtDate(date),
          villagename: vlccTitle(vlc),
          qty: String(q),
          kg: (q * 1.03).toFixed(2),
          fat,
          snf,
          clr,
          milktype: milkName,
          shift: shiftName,
          rate: "0",
          amount: "0",
        },
      };
      setPending((x) => [...x, p]);
      clearForm();
      await load(true);

      for (let i = 0; i < 5 && pendingRef.current.includes(p); i++) {
        await sleep(1500);
        await load(true);
      }
      if (pendingRef.current.includes(p)) {
        setPending((x) => x.filter((y) => y !== p));
        toast(
          "The portal list does not show this entry. It may have updated the existing entry of this milk type.",
          "warn",
        );
      }
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The entry could not be saved",
        "warn",
      );
      if (tableIsOnThese) await load(true);
    } finally {
      setSaving(false);
    }
  };

  const shown = useMemo(
    () => [
      ...rows,
      ...pending
        .filter(
          (p) =>
            !!applied &&
            p.vlc === applied.vlc &&
            p.shift === applied.shift &&
            p.date === applied.date &&
            !rows.some((r) => matches(p, r)),
        )
        .map((p) => p.row),
    ],
    [rows, pending, applied],
  );

  const visible = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s
      ? shown.filter((r) =>
          COLS.map((c) => c.get(r))
            .join(" ")
            .toLowerCase()
            .includes(s),
        )
      : shown;
  }, [shown, needle]);

  const columns: Column<VlcMilkRow>[] = useMemo(
    () =>
      COLS.map((c) => ({
        key: c.key,
        header: c.header,
        align: c.align,
        sort: (r) => sortValue(c.get(r)),
        cell: (r) => c.get(r) || "—",
      })),
    [],
  );
  const exportCols: ExportCol<VlcMilkRow>[] = useMemo(
    () => COLS.map((c) => ({ header: c.header, value: (r) => c.get(r) })),
    [],
  );

  return (
    <ReportPage title="VLC Milk Entry">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Milk}>VLC Milk Collection</CardTitle>}
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={clearForm}
              >
                Clear
              </Button>
            }
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <Field label="VLC">
              <Select value={vlc} onChange={(e) => setVlc(e.target.value)}>
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {vlccOption(id)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Shift">
              <Select value={shift} onChange={(e) => setShift(e.target.value)}>
                {SHIFTS.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Milk Type">
              <Select value={milk} onChange={(e) => setMilk(e.target.value)}>
                {MILKS.map((m) => (
                  <option key={m.Id} value={m.Id}>
                    {m.Name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>

            <Field label="Weight Ltr">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field label="Fat">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={fat}
                onChange={(e) => onFat(e.target.value)}
              />
            </Field>
            <Field label="SNF">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={snf}
                onChange={(e) => onSnf(e.target.value)}
              />
            </Field>
            <Field label="CLR">
              <Input
                readOnly
                tabIndex={-1}
                value={clr}
                className="bg-soft/60"
              />
            </Field>

            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:flex-wrap sm:items-end lg:col-span-4">
              <Button
                className="w-full sm:w-auto sm:min-w-48"
                icon={<Save size={16} />}
                loading={saving}
                disabled={!valid}
                onClick={submit}
              >
                Submit
              </Button>
              <Button
                className="w-full sm:w-auto sm:min-w-40"
                variant="outline"
                icon={<Eye size={16} />}
                loading={loading}
                disabled={!vlc || !date}
                onClick={() => setApplied({ vlc, shift, date })}
              >
                Show
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
              kinds={["xls"]}
              onExport={() =>
                exportExcel(
                  `vlc-milk-entry-${applied.vlc}-${applied.date}-${applied.shift}`,
                  exportCols,
                  visible,
                )
              }
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
            {loading ? (
              <MilkLoader label="Loading entries…" />
            ) : error ? (
              <ErrorBlock message={error} onRetry={() => void load()} />
            ) : visible.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-mute">
                {shown.length === 0
                  ? `No entry for ${vlccTitle(applied.vlc)} on ${fmtDate(applied.date)}.`
                  : "Nothing matches your search."}
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={visible}
                rowKey={(r) => JSON.stringify(r)}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            )}
          </Card>
        </Reveal>
      )}
      <span className="sr-only">{nf(shown.length)} entries</span>
    </ReportPage>
  );
};

export default VlcMilkEntry;
