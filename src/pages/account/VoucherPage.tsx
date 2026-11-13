import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Landmark, RotateCcw, Save, Trash2 } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field, Input, Select } from "../../components/ui/Fields";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { ErrorBlock } from "../../components/Widget";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportBar, ReportPage, Reveal } from "../../components/ReportKit";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_PAGE_SIZE } from "../../lib/global";
import { enterNext } from "../../lib/enterNav";
import { exportExcel, type ExportCol } from "../../lib/export";
import { farmerCode, fmtDate, nf, todayISO } from "../../lib/format";
import { useCentreOptions } from "../../hooks/useCentres";
import { ApiError } from "../../services/http/errors";
import { getFarmers } from "../../services/transaction/farmerMilk.api";
import type { MasterFarmer } from "../../services/farmer/farmerBook";
import {
  PAYMENT_MODES,
  ledgersForMode,
  type VoucherOption,
  type VoucherRow,
} from "../../services/account/voucher.common";
import * as payment from "../../services/account/paymentVoucher.api";
import * as receipt from "../../services/account/receiptVoucher.api";

export type VoucherKind = "payment" | "receipt";

const message = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const farmerLabel = (f: MasterFarmer) =>
  f.name ? `${farmerCode(f.farmerId)} | ${f.name}` : farmerCode(f.farmerId);

const COPY: Record<VoucherKind, { title: string; card: string; noun: string }> = {
  payment: { title: "Payment Voucher", card: "Payment Voucher", noun: "payment voucher" },
  receipt: { title: "Receipt Voucher", card: "Receipt Voucher", noun: "receipt voucher" },
};

/** Account > Payment Voucher / Receipt Voucher. One screen, two kinds: the kind decides the API and the deduction field. */
const VoucherPage: React.FC<{ kind: VoucherKind }> = ({ kind }) => {
  const toast = useToast();
  const text = COPY[kind];
  const centres = useCentreOptions();

  const [vlc, setVlc] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState("Bank");
  const [ledgerId, setLedgerId] = useState("");
  const [deduction, setDeduction] = useState("");
  const [farmerText, setFarmerText] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");

  const [farmers, setFarmers] = useState<MasterFarmer[]>([]);
  const [farmersState, setFarmersState] = useState<"loading" | "ready" | "error">("loading");
  const [ledgers, setLedgers] = useState<VoucherOption[]>([]);
  const [deductionTypes, setDeductionTypes] = useState<VoucherOption[]>([]);

  const [applied, setApplied] = useState<{ vlc: string; date: string } | null>(null);
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [needle, setNeedle] = useState("");
  const [toDelete, setToDelete] = useState<VoucherRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const stamp = useRef(0);

  const vlcId = vlc || centres[0]?.id || "";

  useEffect(() => {
    if (!vlc && centres.length) setVlc(centres[0]!.id);
  }, [vlc, centres]);

  // ledgers (bank / cash accounts)
  useEffect(() => {
    let alive = true;
    (kind === "payment" ? payment.getLedgers() : receipt.getLedgers())
      .then((l) => alive && setLedgers(l))
      .catch((e) => {
        if (alive) toast(message(e, "The ledger list could not be loaded."), "warn");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const modeLedgers = useMemo(() => ledgersForMode(ledgers, mode), [ledgers, mode]);
  useEffect(() => {
    if (!modeLedgers.some((l) => l.value === ledgerId)) setLedgerId(modeLedgers[0]?.value ?? "");
  }, [modeLedgers, ledgerId]);

  // deduction type (payment voucher only)
  useEffect(() => {
    if (kind !== "payment" || !vlcId) return;
    let alive = true;
    payment
      .getDeductionTypes(vlcId)
      .then((d) => {
        if (!alive) return;
        setDeductionTypes(d);
        setDeduction((cur) => (d.some((x) => x.value === cur) ? cur : (d[0]?.value ?? "")));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind, vlcId]);

  // farmers of the centre
  const [farmerTry, setFarmerTry] = useState(0);
  useEffect(() => {
    if (!vlcId) return;
    let alive = true;
    setFarmerText("");
    setFarmers([]);
    setFarmersState("loading");
    getFarmers(vlcId)
      .then((list) => {
        if (!alive) return;
        setFarmers(list);
        setFarmersState("ready");
      })
      .catch(() => alive && setFarmersState("error"));
    return () => {
      alive = false;
    };
  }, [vlcId, farmerTry]);

  const farmer = useMemo(() => {
    const t = farmerText.trim().toLowerCase();
    if (!t) return null;
    return (
      farmers.find((f) => farmerLabel(f).toLowerCase() === t) ??
      farmers.find((f) => f.farmerId.toLowerCase() === t) ??
      farmers.find((f) => farmerCode(f.farmerId).toLowerCase() === t) ??
      (/^\d+$/.test(t)
        ? farmers.find((f) => /^\d+$/.test(f.farmerId) && Number(f.farmerId) === Number(t))
        : undefined) ??
      null
    );
  }, [farmerText, farmers]);

  const amountN = parseFloat(amount.replace(/,/g, ""));
  const valid =
    !!vlcId &&
    !!date &&
    !!farmer &&
    Number.isFinite(amountN) &&
    amountN > 0 &&
    (kind === "receipt" || !!deduction);

  const load = useCallback(
    async (a: { vlc: string; date: string } | null, silent = false) => {
      if (!a) return;
      const me = ++stamp.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const got =
          kind === "payment"
            ? await payment.getPaymentVouchers(a.vlc, a.date)
            : await receipt.getReceiptVouchers(a.vlc, a.date);
        if (me === stamp.current) setRows(got);
      } catch (e) {
        if (me !== stamp.current) return;
        setRows([]);
        setError(message(e, "The vouchers could not be loaded."));
      } finally {
        if (me === stamp.current) setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  const clearForm = () => {
    setFarmerText("");
    setAmount("");
    setNarration("");
  };

  const submit = async () => {
    if (!valid || saving || !farmer) return;
    const ledger = modeLedgers.find((l) => l.value === ledgerId);
    setSaving(true);
    try {
      const base = {
        vlcid: vlcId,
        farmerId: farmer.farmerId,
        farmerCode: farmer.masterCode || farmer.farmerId,
        date,
        amount,
        paymentMode: mode,
        ledgerId,
        ledgerType: ledger?.type,
        narration,
      };
      const reply =
        kind === "payment"
          ? await payment.savePaymentVoucher({ ...base, deductionType: deduction })
          : await receipt.saveReceiptVoucher({ ...base, accountNo: "" });
      toast(reply && reply.length < 80 ? reply : `${text.card} saved`);
      clearForm();
      const next = { vlc: vlcId, date };
      setApplied(next);
      await load(next, true);
    } catch (e) {
      toast(message(e, `The ${text.noun} could not be saved.`), "warn");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting || !applied) return;
    setDeleting(true);
    try {
      if (kind === "payment") await payment.deletePaymentVoucher(toDelete.id, applied.vlc, applied.date);
      else await receipt.deleteReceiptVoucher(toDelete.id, applied.vlc, applied.date);
      toast(`${text.card} deleted`);
      setToDelete(null);
      await load(applied, true);
    } catch (e) {
      toast(message(e, `The ${text.noun} could not be deleted.`), "warn");
    } finally {
      setDeleting(false);
    }
  };

  const visible = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s
      ? rows.filter((r) =>
          [r.id, r.farmerId, farmerCode(r.farmerId), r.farmerName, r.name, r.code, r.narration, r.amount]
            .join(" ")
            .toLowerCase()
            .includes(s),
        )
      : rows;
  }, [rows, needle]);

  const total = useMemo(() => visible.reduce((n, r) => n + r.amount, 0), [visible]);

  const columns: Column<VoucherRow>[] = [
    { key: "id", header: "Id", sort: (r) => Number(r.id) || 0, cell: (r) => r.id || "—" },
    { key: "date", header: "Date", sort: (r) => r.date, cell: (r) => (r.date ? fmtDate(r.date) : "—") },
    { key: "fid", header: "Farmer Id", sort: (r) => farmerCode(r.farmerId), cell: (r) => farmerCode(r.farmerId) || "—" },
    ...(kind === "payment"
      ? ([
          { key: "code", header: "Code", cell: (r) => r.code || "—" },
          { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name || "—"}</span> },
        ] as Column<VoucherRow>[])
      : ([
          { key: "name", header: "Farmer Name", cell: (r) => <span className="font-semibold">{r.name || r.farmerName || "—"}</span> },
        ] as Column<VoucherRow>[])),
    { key: "amt", header: "Amount", align: "right", sort: (r) => r.amount, cell: (r) => <span className="font-bold">{nf(r.amount, 2)}</span> },
    { key: "nar", header: "Narration", cell: (r) => (r.narration && r.narration !== "0" ? r.narration : "—") },
    {
      key: "del",
      header: "Action",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setToDelete(r)}>
          Delete
        </Button>
      ),
    },
  ];
  const exportCols: ExportCol<VoucherRow>[] = [
    { header: "Id", value: (r) => r.id },
    { header: "Date", value: (r) => r.date },
    { header: "Farmer Id", value: (r) => farmerCode(r.farmerId) },
    ...(kind === "payment"
      ? [
          { header: "Code", value: (r: VoucherRow) => r.code },
          { header: "Name", value: (r: VoucherRow) => r.name },
        ]
      : [{ header: "Farmer Name", value: (r: VoucherRow) => r.name || r.farmerName }]),
    { header: "Amount", value: (r) => r.amount },
    { header: "Narration", value: (r) => r.narration },
  ];

  const farmerHint =
    farmersState === "error"
      ? "Farmer list could not be loaded. Tap the box to try again."
      : farmerText.trim() && !farmer && farmersState === "ready"
        ? "Pick a farmer from the list."
        : undefined;

  return (
    <ReportPage title={text.title}>
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Landmark}>{text.card}</CardTitle>}
            action={
              <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={clearForm}>
                Clear
              </Button>
            }
          />
          <div
            className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4"
            onKeyDown={(e) => enterNext(e, () => void submit())}
          >
            <Field label="Date">
              <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="VLC">
              <Select value={vlcId} onChange={(e) => setVlc(e.target.value)}>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Farmer Name" hint={farmerHint}>
              <Input
                list={`voucher-farmers-${kind}`}
                autoComplete="off"
                placeholder={farmersState === "loading" ? "Loading farmers…" : "Select or type farmer"}
                value={farmerText}
                onChange={(e) => setFarmerText(e.target.value)}
                onFocus={() => {
                  if (farmersState === "error") setFarmerTry((n) => n + 1);
                }}
              />
              <datalist id={`voucher-farmers-${kind}`}>
                {farmers.map((f) => (
                  <option key={f.key} value={farmerLabel(f)} />
                ))}
              </datalist>
            </Field>
            <Field label="Payment Mode">
              <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ledger">
              <Select value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
                {modeLedgers.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            {kind === "payment" && (
              <Field label="Deduction Type">
                <Select value={deduction} onChange={(e) => setDeduction(e.target.value)}>
                  {deductionTypes.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Amount">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Narration" className={kind === "payment" ? "" : "lg:col-span-2"}>
              <Input value={narration} onChange={(e) => setNarration(e.target.value)} />
            </Field>

            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:flex-wrap sm:items-end lg:col-span-4">
              <Button
                className="w-full sm:w-auto sm:min-w-48"
                icon={<Save size={16} />}
                loading={saving}
                disabled={!valid}
                onClick={() => void submit()}
              >
                Submit
              </Button>
              <Button
                className="w-full sm:w-auto sm:min-w-40"
                variant="outline"
                icon={<Eye size={16} />}
                loading={loading}
                disabled={!vlcId || !date}
                onClick={() => setApplied({ vlc: vlcId, date })}
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
                exportExcel(`${kind}-voucher-${applied.vlc}-${applied.date}`, exportCols, visible)
              }
              left={
                <div className="w-56 max-w-full">
                  <Input placeholder="Search" value={needle} onChange={(e) => setNeedle(e.target.value)} />
                </div>
              }
            />
            {loading ? (
              <MilkLoader label="Loading vouchers…" />
            ) : error ? (
              <ErrorBlock message={error} onRetry={() => void load(applied)} />
            ) : visible.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-mute">
                {rows.length === 0
                  ? `No ${text.noun} for ${fmtDate(applied.date)}.`
                  : "Nothing matches your search."}
              </p>
            ) : (
              <>
                <DataTable
                  columns={columns}
                  rows={visible}
                  rowKey={(r) => r.key}
                  pageSize={DEFAULT_PAGE_SIZE}
                  pageSizes={[10, 25, 50, 100, 250]}
                  sizeLabel="Result per page"
                />
                <p className="border-t border-line px-6 py-3 text-right text-sm font-bold">
                  Total: ₹ {nf(total, 2)}
                </p>
              </>
            )}
          </Card>
        </Reveal>
      )}

      <Modal
        open={!!toDelete}
        onClose={() => (deleting ? undefined : setToDelete(null))}
        title={`Delete this ${text.noun}?`}
        subtitle={
          toDelete
            ? `${farmerCode(toDelete.farmerId)} · ₹ ${nf(toDelete.amount, 2)}`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" disabled={deleting} onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" icon={<Trash2 size={15} />} loading={deleting} onClick={() => void remove()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-mute">This cannot be undone.</p>
      </Modal>
    </ReportPage>
  );
};

export default VoucherPage;
