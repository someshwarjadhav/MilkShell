import { validateDateRange } from "../../lib/dateRange";
import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, PackageCheck, Save, Wallet } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { PastDateInput } from "../../components/ui/PastDateInput";
import { MilkLoader } from "../../components/MilkLoader";
import {
  CardTitle,
  ReportPage,
  Reveal,
} from "../../components/ReportKit";
import { ErrorBlock } from "../../components/Widget";
import { useSmoothLoading } from "../../hooks/useSmoothLoading";
import { useCentreOptions } from "../../hooks/useCentres";
import { useToast } from "../../context/ToastContext";
import { cn } from "../../lib/cn";
import { todayISO } from "../../lib/format";
import { clearRequestMemo } from "../../services/http/client";
import { ApiError } from "../../services/http/errors";
import {
  calcRow,
  getDeductionTypes,
  getDeductions,
  saveDeductions,
  toNum,
  two,
  type DeductionRow,
  type DeductionType,
} from "../../services/transaction/deductionEntry.api";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const th =
  "whitespace-nowrap border-b border-line bg-soft/70 px-4 py-3 text-left text-xs font-semibold text-mute first:rounded-tl-xl last:rounded-tr-xl";
// One table, two looks: stacked farmer cards on smaller screens and a table once there is room for all columns.
const td =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3 py-1.5 text-right text-sm before:min-w-0 before:break-words before:text-left before:text-xs before:font-semibold before:text-mute before:content-[attr(data-label)] xl:table-cell xl:whitespace-nowrap xl:border-b xl:border-line/70 xl:px-4 xl:py-3 xl:text-left xl:before:hidden";

const DeductionEntry: React.FC = () => {
  const toast = useToast();
  const centres = useCentreOptions();

  const [vlc, setVlc] = useState("");
  const [types, setTypes] = useState<DeductionType[]>([]);
  const [typeCode, setTypeCode] = useState("");
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [typesTick, setTypesTick] = useState(0);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const [rows, setRows] = useState<DeductionRow[]>([]);

  const [typed, setTyped] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const showLoader = useSmoothLoading(loading);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticket = useRef(0);

  const vlcId = vlc || centres[0]?.id || "";

  const reset = () => {
    ticket.current++;
    setRows([]);
    setTyped({});
    setLoaded(false);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    if (!vlcId) return;
    let alive = true;
    setTypesLoading(true);
    setTypesError(null);
    getDeductionTypes(vlcId)
      .then((list) => {
        if (!alive) return;
        setTypes(list);
        setTypeCode((cur) =>
          list.some((t) => t.code === cur) ? cur : (list[0]?.code ?? ""),
        );
      })
      .catch((e) => {
        if (!alive) return;
        console.error("[DeductionEntry] deduction types FAILED:", e);
        setTypes([]);
        setTypeCode("");
        setTypesError(msg(e, "The deduction types could not be loaded."));
      })
      .finally(() => {
        if (alive) setTypesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [vlcId, typesTick]);

  const show = async () => {
    if (!vlcId || !typeCode || loading) return;
    const rangeError = validateDateRange(from, to);
    if (rangeError) return toast(rangeError, "warn");
    clearRequestMemo();
    reset();
    setLoading(true);
    const mine = ticket.current;
    try {
      const list = await getDeductions({
        vlcid: vlcId,
        reftype: typeCode,
        from,
        to,
      });
      if (mine !== ticket.current) return;
      setRows(list);
      setTyped(
        Object.fromEntries(list.map((r) => [r.farmerId, two(r.deduction)])),
      );
      setLoaded(true);
    } catch (e) {
      console.error("[DeductionEntry] load FAILED:", e);
      if (mine !== ticket.current) return;
      setError(msg(e, "The farmers could not be loaded."));
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  };

  // every row with what is typed for it and the numbers that follow from it
  const view = useMemo(
    () =>
      rows.map((row) => {
        const text = typed[row.farmerId] ?? two(row.deduction);
        return { row, text, calc: calcRow(row, toNum(text)) };
      }),
    [rows, typed],
  );

  const totals = useMemo(
    () => ({
      deduction: view.reduce(
        (s, v) => s + (v.calc.error ? 0 : toNum(v.text)),
        0,
      ),
      payable: view.reduce((s, v) => s + v.calc.payable, 0),
    }),
    [view],
  );

  const setText = (id: string, value: string) =>
    setTyped((t) => ({ ...t, [id]: value }));

  const commit = (id: string) => {
    const v = view.find((x) => x.row.farmerId === id);
    if (!v) return;
    if (v.calc.error) {
      toast(`Farmer ${id}: ${v.calc.error}`, "warn");
      setText(id, two(0));
    } else setText(id, two(toNum(v.text)));
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    commit(id);
    const boxes = Array.from(
      document.querySelectorAll<HTMLInputElement>("[data-ded-box]"),
    );
    boxes[boxes.indexOf(e.currentTarget) + 1]?.focus();
  };

  const submit = async () => {
    if (saving || !loaded || view.length === 0) return;
    const bad = view.find((v) => v.calc.error);
    if (bad)
      return toast(`Farmer ${bad.row.farmerId}: ${bad.calc.error}`, "warn");
    setSaving(true);
    try {
      const reply = await saveDeductions({
        vlcid: vlcId,
        reftype: typeCode,
        from,
        to,
        rows: view.map((v) => ({ row: v.row, deduction: toNum(v.text) })),
      });
      toast(reply || "Deduction saved");
      setSaving(false);
      await show(); // like the old portal: the list is loaded again after saving
    } catch (e) {
      console.error("[DeductionEntry] SAVE FAILED:", e);
      toast(msg(e, "The deduction could not be saved."), "warn");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReportPage title="Deduction Entry">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Wallet}>Bill Deduction</CardTitle>}
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <Field label="VLC Name" className="sm:col-span-1 lg:col-span-2">
              <Select
                value={vlcId}
                onChange={(e) => {
                  setVlc(e.target.value);
                  reset();
                }}
              >
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Deduction Type"
              className="sm:col-span-1 lg:col-span-2"
            >
              <Select
                value={typeCode}
                disabled={typesLoading || types.length === 0}
                onChange={(e) => {
                  setTypeCode(e.target.value);
                  reset();
                }}
              >
                {types.length === 0 && (
                  <option value="">
                    {typesLoading ? "Loading…" : "No type found"}
                  </option>
                )}
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="From Date">
              <PastDateInput
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  reset();
                }}
              />
            </Field>
            <Field label="To Date">
              <PastDateInput
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  reset();
                }}
              />
            </Field>
            <div className="grid grid-cols-2 items-end gap-3 sm:col-span-2 sm:gap-4 lg:self-end">
              <Button
                className="h-11 w-full min-w-0 px-3 sm:px-4"
                icon={<Eye size={16} />}
                loading={loading}
                disabled={!vlcId || !typeCode || !from || !to}
                onClick={() => void show()}
              >
                Show
              </Button>
              <Button
                className="h-11 w-full min-w-0 bg-ok px-3 text-white hover:bg-ok/90 sm:px-4"
                icon={<Save size={16} />}
                loading={saving}
                disabled={!loaded || view.length === 0}
                onClick={() => void submit()}
              >
                Submit
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      {typesError && (
        <ErrorBlock
          message={typesError}
          onRetry={() => setTypesTick((n) => n + 1)}
          busy={typesLoading}
          compact
        />
      )}

      {error && (
        <ErrorBlock
          message={error}
          onRetry={() => void show()}
          busy={loading}
        />
      )}

      {(showLoader || loaded) && (
        <Reveal delay={0.1}>
          <Card>
            {showLoader ? (
              <MilkLoader label="Loading farmers…" />
            ) : view.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-6 py-10 text-center text-sm text-mute">
                <PackageCheck size={16} />
                No farmer has a bill amount for these dates.
              </p>
            ) : (
              <>
                <CardHeader
                  title={<CardTitle icon={Wallet}>Farmers</CardTitle>}
                  subtitle={`${view.length} farmer${view.length === 1 ? "" : "s"} · Deduction ${two(totals.deduction)} · Payable ${two(totals.payable)}`}
                />
                <div className="max-w-full overflow-x-auto p-3 sm:p-4">
                  <table className="block w-full border-separate border-spacing-0 text-sm xl:table xl:min-w-[900px]">
                    <thead className="hidden xl:table-header-group">
                      <tr>
                        <th className={th}>Farmer Id</th>
                        <th className={th}>Farmer Name</th>
                        <th className={th}>Ded Amount</th>
                        <th className={th}>Payable Amount</th>
                        <th className={th}>Rem Ded Amount</th>
                        <th className={th}>Bill Amount</th>
                        <th className={th}>Only Show Purpose Bill Amount</th>
                      </tr>
                    </thead>
                    <tbody className="block xl:table-row-group">
                      {view.map(({ row, text, calc }) => (
                        <tr
                          key={row.farmerId}
                          className="mb-3 block rounded-xl border border-line bg-panel px-3 py-2 shadow-card xl:mb-0 xl:table-row xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:hover:bg-brand/[0.06]"
                        >
                          <td className={td} data-label="Farmer Id">
                            <span className="font-semibold">
                              {row.farmerId}
                            </span>
                          </td>
                          <td className={td} data-label="Farmer Name">
                            <span className="min-w-0 break-words text-right md:text-left">
                              {row.farmerName || "—"}
                            </span>
                          </td>
                          <td
                            className={cn(td, "xl:align-top")}
                            data-label="Ded Amount"
                          >
                            <div className="w-40 max-w-full xl:w-36">
                              <Input
                                data-ded-box
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="any"
                                aria-label={`Deduction for farmer ${row.farmerId}`}
                                aria-invalid={calc.error ? true : undefined}
                                value={text}
                                onChange={(e) =>
                                  setText(row.farmerId, e.target.value)
                                }
                                onBlur={() => commit(row.farmerId)}
                                onKeyDown={(e) => onKey(e, row.farmerId)}
                                className={cn(
                                  "h-10 text-right",
                                  calc.error &&
                                    "border-danger focus:border-danger focus:ring-danger/15",
                                )}
                              />
                              {calc.error && (
                                <span className="mt-1 block text-left text-xs text-danger">
                                  {calc.error}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className={cn(td, "font-semibold tnum")}
                            data-label="Payable Amount"
                          >
                            {two(calc.payable)}
                          </td>
                          <td
                            className={cn(td, "tnum")}
                            data-label="Rem Ded Amount"
                          >
                            {two(calc.remaining)}
                          </td>
                          <td
                            className={cn(td, "tnum")}
                            data-label="Bill Amount"
                          >
                            {two(row.billAmount)}
                          </td>
                          <td
                            className={cn(td, "tnum")}
                            data-label="Only Show Purpose Bill Amount"
                          >
                            {two(row.billAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </Reveal>
      )}
    </ReportPage>
  );
};

export default DeductionEntry;
