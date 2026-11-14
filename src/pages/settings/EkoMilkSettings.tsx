import type * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCheck,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  Info,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Pager } from "../../components/ui/Pager";
import { TableTopBar } from "../../components/ui/ResultPerPage";
import { DEFAULT_PAGE_SIZE } from "../../lib/global";
import { Field, Input, Select } from "../../components/ui/Fields";
import { ErrorBlock } from "../../components/Widget";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportPage, Reveal } from "../../components/ReportKit";
import { useToast } from "../../context/ToastContext";
import { useCenters } from "../../hooks/useSessionData";
import { getSession } from "../../services/session";
import { vlccCode, vlccOption } from "../../services/vlcc/names";
import { ApiError } from "../../services/http/errors";
import { todayISO } from "../../lib/format";
import { DEFAULT_SHIFT, GLOBALSSHIFT } from "../../lib/global";
import {
  clrFromFatSnf,
  emptyCredentials,
  emptyQuality,
  emptySample,
  getControlSamples,
  getEkoCorrections,
  getEkoCredentials,
  getQualityPair,
  QUALITY_FIELDS,
  saveControlSample,
  saveEkoCorrection,
  updateCorrectorFlag,
  updateEkoCorrectionFlag,
  updateEkoPassword,
  type ControlRow,
  type CorrectionRow,
  type Quality6,
  type Sample3,
} from "../../services/settings/ekoMilk.api";

const message = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;
const decimal = (v: string) =>
  v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
const SHIFTS = GLOBALSSHIFT.shiftOptions.map((o) => ({
  value: o.Id as string,
  label: o.Name as string,
}));

const CenterSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  ids: string[];
}> = ({ value, onChange, ids }) => (
  <Field label="Center Name">
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- select center --</option>
      {ids.map((id) => (
        <option key={id} value={id}>
          {vlccOption(id)}
        </option>
      ))}
    </Select>
  </Field>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <p className="pt-1 text-sm font-semibold text-mute">{children}</p>;

const PassInput: React.FC<{
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}> = ({ value, onChange, readOnly, disabled }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        className="pr-10"
        onChange={(e) => onChange?.(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const statusCls = (s: string) =>
  /complete/i.test(s)
    ? "text-green-700 dark:text-green-400"
    : /reject/i.test(s)
      ? "text-red-600 dark:text-red-400"
      : /pending/i.test(s)
        ? "text-blue-700 dark:text-blue-400"
        : "text-mute";

type Row = CorrectionRow | ControlRow;

const COW = "bg-sky-500/10";
const BUFF = "bg-orange-500/10";
const MIX = "bg-emerald-500/10";
const TINTS = [COW, COW, BUFF, BUFF, MIX, MIX];
const cell = "border border-line px-3 py-2.5 tnum";
const headCell = "border border-line px-3 py-2.5 text-left font-bold";


const REJECT_FLAG = "2";


const ConfirmReject: React.FC<{
  row: Row | null;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}> = ({ row, busy, onYes, onNo }) => (
  <Modal
    open={!!row}
    onClose={busy ? () => undefined : onNo}
    title="Confirm Reject"
    width="max-w-sm"
    footer={
      <>
        <Button variant="ghost" disabled={busy} onClick={onNo}>
          No
        </Button>
        <Button variant="danger" loading={busy} onClick={onYes}>
          Yes
        </Button>
      </>
    }
  >
    <p className="text-sm">
      Are you sure you want to reject record <b>#{row?.id}</b>?
    </p>
  </Modal>
);

const RecordsTable: React.FC<{
  rows: Row[];
  kind: "eko" | "control";
  busyId: string | null;
  onCancel: (r: Row) => void;
  loading: boolean;
  emptyText: string;
}> = ({ rows, kind, busyId, onCancel, loading, emptyText }) => {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [rows]);
  const slice = rows.slice((page - 1) * size, page * size);

  const six = (r: {
    cowFat: string;
    cowSnf: string;
    buffFat: string;
    buffSnf: string;
    mixFat: string;
    mixSnf: string;
  }) => [r.cowFat, r.cowSnf, r.buffFat, r.buffSnf, r.mixFat, r.mixSnf];
  const action = (r: Row) => {
    if (/pending/i.test(r.status)) {
      return (
        <button
          type="button"
          disabled={busyId === r.id}
          onClick={() => onCancel(r)}
          title="Reject this record"
          aria-label="Reject this record"
          className="mx-auto grid h-8 w-8 place-items-center rounded-lg text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          {busyId === r.id ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <X size={20} strokeWidth={2.5} />
          )}
        </button>
      );
    }
    return (
      <CheckCheck
        size={20}
        className="mx-auto text-green-600"
        aria-label={r.status}
      />
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {rows.length > 0 && (
        <TableTopBar
          total={rows.length}
          page={page}
          size={size}
          onSize={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className={headCell}>
                Id
              </th>
              <th rowSpan={2} className={headCell}>
                Entry Date
              </th>
              <th rowSpan={2} className={headCell}>
                Station
              </th>
              <th colSpan={2} className={headCell}>
                Cow
              </th>
              <th colSpan={2} className={headCell}>
                Buffalo
              </th>
              <th colSpan={2} className={headCell}>
                Mix
              </th>
              <th rowSpan={2} className={headCell}>
                Status
              </th>
              <th rowSpan={2} className={headCell}>
                Applied Date
              </th>
              <th rowSpan={2} className={headCell}>
                Applied Time
              </th>
              <th rowSpan={2} className={`${headCell} text-center`}>
                Action
              </th>
            </tr>
            <tr>
              {["Fat", "Snf", "Fat", "Snf", "Fat", "Snf"].map((h, i) => (
                <th key={i} className={headCell}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const rejected = /reject/i.test(r.status);
              const base = rejected ? "bg-soft" : "";
              if (kind === "eko") {
                return (
                  <tr key={r.id} className={base}>
                    <td className={cell}>{r.id}</td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {r.entryDate}
                    </td>
                    <td className={cell}>{vlccCode(r.stationId)}</td>
                    {six(r).map((v, i) => (
                      <td key={i} className={`${cell} ${TINTS[i]}`}>
                        {v}
                      </td>
                    ))}
                    <td className={`${cell} ${statusCls(r.status)}`}>
                      {r.status}
                    </td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {r.appliedDate}
                    </td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {r.appliedTime}
                    </td>
                    <td className={`${cell} text-center`}>{action(r)}</td>
                  </tr>
                );
              }
              const c = r as ControlRow;
              const lines: Array<{ label: string | null; values: string[] }> = [
                { label: null, values: six(c) },
                { label: "Previous", values: six(c.prev) },
                { label: "New", values: six(c.next) },
              ];
              return lines.map((ln, li) => (
                <tr key={`${r.id}-${li}`} className={base}>
                  {li === 0 && (
                    <td rowSpan={3} className={cell}>
                      {r.id}
                    </td>
                  )}
                  {li === 0 && (
                    <td rowSpan={3} className={`${cell} whitespace-nowrap`}>
                      {r.entryDate}
                    </td>
                  )}
                  <td
                    className={`${cell} ${ln.label ? "font-bold italic" : ""}`}
                  >
                    {ln.label ?? vlccCode(r.stationId)}
                  </td>
                  {ln.values.map((v, i) => (
                    <td key={i} className={`${cell} ${TINTS[i]}`}>
                      {v}
                    </td>
                  ))}
                  {li === 0 && (
                    <td
                      rowSpan={3}
                      className={`${cell} ${statusCls(r.status)}`}
                    >
                      {r.status}
                    </td>
                  )}
                  {li === 0 && (
                    <td rowSpan={3} className={`${cell} whitespace-nowrap`}>
                      {r.appliedDate}
                    </td>
                  )}
                  {li === 0 && (
                    <td rowSpan={3} className={`${cell} whitespace-nowrap`}>
                      {r.appliedTime}
                    </td>
                  )}
                  {li === 0 && (
                    <td rowSpan={3} className={`${cell} text-center`}>
                      {action(r)}
                    </td>
                  )}
                </tr>
              ));
            })}
            {slice.length === 0 && (
              <tr>
                {loading ? (
                  <td colSpan={12} className="p-0">
                    <MilkLoader label="Loading records…" />
                  </td>
                ) : (
                  <td colSpan={12} className={`${cell} py-8 text-center text-mute`}>
                    {emptyText}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {slice.map((r) => {
          const c = kind === "control" ? (r as ControlRow) : null;
          const blocks: Array<{ label: string | null; q: Quality6 }> = [
            { label: c ? "Current" : null, q: r },
          ];
          if (c)
            blocks.push(
              { label: "Previous", q: c.prev },
              { label: "New", q: c.next },
            );
          return (
            <div
              key={r.id}
              className={`space-y-3 rounded-xl border border-line p-3 text-sm ${/reject/i.test(r.status) ? "bg-soft" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    #{r.id}{" "}
                    <span
                      className={`ml-1 font-semibold ${statusCls(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </p>
                  <p className="text-mute">
                    {r.entryDate} · Station {vlccCode(r.stationId)}
                  </p>
                  {(r.appliedDate || r.appliedTime) && (
                    <p className="text-mute">
                      Applied {r.appliedDate} {r.appliedTime}
                    </p>
                  )}
                </div>
                <div className="shrink-0">{action(r)}</div>
              </div>
              {blocks.map((b, bi) => (
                <div key={bi} className="space-y-1">
                  {b.label && (
                    <p className="text-xs font-bold italic text-mute">
                      {b.label}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["Cow", COW, b.q.cowFat, b.q.cowSnf],
                        ["Buffalo", BUFF, b.q.buffFat, b.q.buffSnf],
                        ["Mix", MIX, b.q.mixFat, b.q.mixSnf],
                      ] as const
                    ).map(([name, tint, fat, snf]) => (
                      <div
                        key={name}
                        className={`rounded-lg px-2 py-1.5 ${tint}`}
                      >
                        <p className="text-xs font-bold">{name}</p>
                        <p className="tnum text-xs">Fat {fat || "-"}</p>
                        <p className="tnum text-xs">SNF {snf || "-"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {slice.length === 0 &&
          (loading ? (
            <MilkLoader label="Loading records…" />
          ) : (
            <p className="py-6 text-center text-mute">{emptyText}</p>
          ))}
      </div>
      <Pager
        total={rows.length}
        page={page}
        size={size}
        onPage={setPage}
      />
    </div>
  );
};

type Tab = "calibration" | "tools" | "history";
type Adj = Record<keyof Quality6, number>;

const STEP = 0.02;
const zeroAdj = (): Adj => ({
  cowFat: 0,
  cowSnf: 0,
  buffFat: 0,
  buffSnf: 0,
  mixFat: 0,
  mixSnf: 0,
});
const r2 = (n: number) => Math.round(n * 100) / 100;
const clampAdj = (n: number) => r2(n);
const num = (v: string) => {
  const n = Number(v);
  return v === "" || Number.isNaN(n) ? 0 : n;
};
const signedText = (n: number) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

const MILKS: Array<{
  key: "cow" | "buff" | "mix";
  label: string;
  dot: string;
  fat: keyof Quality6;
  snf: keyof Quality6;
}> = [
  { key: "cow", label: "Cow", dot: "bg-cow", fat: "cowFat", snf: "cowSnf" },
  {
    key: "buff",
    label: "Buffalo",
    dot: "bg-buffalo",
    fat: "buffFat",
    snf: "buffSnf",
  },
  { key: "mix", label: "Mixed", dot: "bg-goat", fat: "mixFat", snf: "mixSnf" },
];
const FIELD_LABEL: Record<keyof Quality6, string> = {
  cowFat: "Cow FAT",
  cowSnf: "Cow SNF",
  buffFat: "Buffalo FAT",
  buffSnf: "Buffalo SNF",
  mixFat: "Mixed FAT",
  mixSnf: "Mixed SNF",
};

/** Number box that lets the user type freely (e.g. "-", "-0.") and commits on every valid keystroke. */
const NumBox: React.FC<{
  value: number;
  onCommit: (n: number) => void;
  disabled?: boolean;
  signed?: boolean;
  highlight?: boolean;
  label: string;
}> = ({ value, onCommit, disabled, signed, highlight, label }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (signed ? signedText(value) : value.toFixed(2));
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      disabled={disabled}
      value={shown}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.+-]/g, "");
        setDraft(t);
        const n = Number(t);
        if (t !== "" && t !== "-" && t !== "+" && !Number.isNaN(n)) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
      className={`tnum h-9 w-full min-w-0 rounded-lg border bg-panel px-2 text-center text-sm font-semibold outline-none transition-colors focus:border-brand disabled:opacity-50 ${
        highlight ? "border-brand text-brand" : "border-line"
      }`}
    />
  );
};

const StepBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="grid h-9 w-8 shrink-0 place-items-center rounded-lg border border-line bg-soft text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
  >
    {children}
  </button>
);

const MilkCard: React.FC<{
  m: (typeof MILKS)[number];
  device: Quality6;
  doc: Quality6;
  adj: Adj;
  enabled: boolean;
  onAdj: (k: keyof Quality6, n: number) => void;
}> = ({ m, device, doc, adj, enabled, onAdj }) => (
  <div className="min-w-0 rounded-2xl border border-line bg-panel p-4 shadow-card">
    <div className="mb-3 flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${m.dot}`} />
      <h4 className="font-display text-sm font-semibold">{m.label}</h4>
    </div>
    <div className="grid grid-cols-[3.2rem_minmax(0,1fr)_minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-x-2 gap-y-3 text-sm">
      {["Param", "Device", "Adjust", "New"].map((h) => (
        <span
          key={h}
          className={`text-[11px] font-bold uppercase tracking-wide text-mute ${h === "Adjust" ? "text-center" : ""}`}
        >
          {h}
        </span>
      ))}
      {(
        [
          ["FAT", m.fat],
          ["SNF", m.snf],
        ] as const
      ).map(([name, k]) => {
        const dev = num(device[k]);
        const a = adj[k];
        const changed = a !== 0;
        return (
          <div key={k} className="contents">
            <div>
              <p className="font-bold">{name}</p>
              <p className="tnum text-[10px] text-mute">
                DOC {doc[k] || "0.00"}
              </p>
            </div>
            <span className="tnum font-semibold text-mute">
              {dev.toFixed(2)}
            </span>
            <div className="flex items-center gap-1">
              <StepBtn
                label={`Decrease ${FIELD_LABEL[k]}`}
                disabled={!enabled}
                onClick={() => onAdj(k, clampAdj(a - STEP))}
              >
                <Minus size={14} />
              </StepBtn>
              <NumBox
                label={`${FIELD_LABEL[k]} adjust`}
                signed
                value={a}
                disabled={!enabled}
                highlight={changed}
                onCommit={(n) => onAdj(k, clampAdj(n))}
              />
              <StepBtn
                label={`Increase ${FIELD_LABEL[k]}`}
                disabled={!enabled}
                onClick={() => onAdj(k, clampAdj(a + STEP))}
              >
                <Plus size={14} />
              </StepBtn>
            </div>
            <NumBox
              label={`${FIELD_LABEL[k]} new value`}
              value={r2(dev + a)}
              disabled={!enabled}
              highlight={changed}
              onCommit={(n) => onAdj(k, clampAdj(n - dev))}
            />
          </div>
        );
      })}
    </div>
  </div>
);

const CalibrationCard: React.FC<{ ids: string[] }> = ({ ids }) => {
  const toast = useToast();
  const [center, setCenter] = useState("");
  const [shift, setShift] = useState<string>(DEFAULT_SHIFT);
  const [tab, setTab] = useState<Tab>("calibration");

  const [device, setDevice] = useState<Quality6>(emptyQuality);
  const [doc, setDoc] = useState<Quality6>(emptyQuality);
  const [adj, setAdj] = useState<Adj>(zeroAdj);
  const [cred, setCred] = useState(emptyCredentials);
  const [passApply, setPassApply] = useState(false);
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState(false);

  const loadRecords = useCallback(async (c: string) => {
    if (!c) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      setRows(await getEkoCorrections(c));
    } catch (e) {
      setError(message(e, "The calibration records could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCredentials = useCallback(async (c: string) => {
    if (!c) {
      setCred(emptyCredentials());
      return;
    }
    try {
      setCred(await getEkoCredentials(c));
    } catch (e) {
      setError(message(e, "The Eko credentials could not be loaded."));
    }
  }, []);

  const resetEntry = () => {
    setAdj(zeroAdj());
    setPassApply(false);
  };

  // Same as the original "Show" button: values are only read when asked for.
  const show = async () => {
    if (!center) {
      toast("Select a center first", "warn");
      return;
    }
    setReading(true);
    setError(null);
    try {
      const q = await getQualityPair(center, shift);
      setDevice(q.vlc);
      setDoc(q.doc);
    } catch (e) {
      setDevice(emptyQuality());
      setDoc(emptyQuality());
      setError(message(e, "The milk quality could not be loaded."));
    } finally {
      setReading(false);
    }
  };

  useEffect(() => {
    setError(null);
    setDevice(emptyQuality());
    setDoc(emptyQuality());
    resetEntry();
    void loadRecords(center);
    void loadCredentials(center);
  }, [center, loadRecords, loadCredentials]);

  useEffect(() => {
    setDevice(emptyQuality());
    setDoc(emptyQuality());
  }, [shift]);

  const setOne = (k: keyof Quality6, n: number) =>
    setAdj((a) => ({ ...a, [k]: n }));
  const regen = () =>
    setCred((c) => ({
      ...c,
      newPass: String(Math.floor(100000 + Math.random() * 900000)),
    }));

  const changes = useMemo(
    () =>
      QUALITY_FIELDS.filter(([k]) => adj[k] !== 0).map(([k]) => {
        const on = num(device[k]);
        return { k, label: FIELD_LABEL[k], on, next: r2(on + adj[k]), by: adj[k] };
      }),
    [adj, device],
  );
  const passOk = !passApply || /^\d{6}$/.test(cred.newPass);
  const pending = changes.length + (passApply ? 1 : 0);

  const signed = (): Quality6 => {
    const out = emptyQuality();
    QUALITY_FIELDS.forEach(([k]) => {
      out[k] = adj[k] === 0 ? "" : adj[k].toFixed(2);
    });
    return out;
  };

  const discard = () => {
    resetEntry();
    void loadCredentials(center);
  };

  const openReview = () => {
    if (!center || saving) return;
    if (changes.length === 0) {
      toast("Enter the quality difference first", "warn");
      return;
    }
    if (!passOk) {
      toast("New password must be 6 digits", "warn");
      setTab("tools");
      return;
    }
    setReview(true);
  };

  const apply = async () => {
    if (!center || saving) return;
    setSaving(true);
    try {
      await saveEkoCorrection({
        stationId: center,
        entryDate: todayISO(),
        shift,
        vlc: device,
        doc,
        diff: signed(),
      });
    } catch (e) {
      toast(message(e, "The Eko calibration could not be saved"), "warn");
      setSaving(false);
      return;
    }

    try {
      await updateEkoPassword(cred, passApply);
      toast("Eko calibration saved successfully!");
    } catch (e) {
      toast(
        `Calibration saved, but the password was not updated: ${message(e, "please try again")}`,
        "warn",
      );
    }
    setReview(false);
    resetEntry();
    await Promise.all([loadRecords(center), loadCredentials(center)]);
    setSaving(false);
  };

  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const reject = async () => {
    const r = confirmRow;
    if (!r) return;
    setBusyId(r.id);
    try {
      await updateEkoCorrectionFlag(center, r.id, REJECT_FLAG);
      toast("Record rejected");
      setConfirmRow(null);
      await loadRecords(center);
    } catch (e) {
      toast(message(e, "The record could not be updated"), "warn");
    } finally {
      setBusyId(null);
    }
  };

  const pendingRecords = rows.filter((r) => /pending/i.test(r.status)).length;
  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ["calibration", "Calibration", null],
    ["tools", "Tools", null],
    ["history", "History", rows.length > 0 ? rows.length : null],
  ];

  return (
    <Card>
      <CardHeader
        title={
          <CardTitle icon={SlidersHorizontal}>
            Eko Ultra Pro Online Calibration
          </CardTitle>
        }
      />
      <div className="space-y-5 px-4 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,28.5rem)_minmax(0,21rem)_auto]">
          <CenterSelect value={center} onChange={setCenter} ids={ids} />
          <Field label="Shift">
            <Select value={shift} onChange={(e) => setShift(e.target.value)}>
              {SHIFTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            className="w-full sm:col-span-2 lg:col-span-1 lg:w-auto"
            icon={<Download size={16} />}
            loading={reading}
            disabled={!center}
            onClick={show}
          >
            Read calibration
          </Button>
        </div>
        {error && (
          <ErrorBlock
            compact
            message={error}
            onRetry={() => {
              setError(null);
              void loadRecords(center);
              void loadCredentials(center);
            }}
          />
        )}

        <div
          role="tablist"
          className="flex gap-1 overflow-x-auto border-b border-line"
        >
          {tabs.map(([id, label, badge]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === id
                  ? "border-brand text-brand"
                  : "border-transparent text-mute hover:text-ink"
              }`}
            >
              {label}
              {badge !== null && (
                <span className="rounded-full bg-brand/10 px-1.5 text-[11px] font-bold text-brand">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "calibration" && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-xl bg-brand/10 px-3 py-2.5 text-sm text-brand">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>
                {center
                  ? "Press Read calibration to load the device values. Change Adjust (−/+) or type the New value, then press Review & apply."
                  : "Select a center to read its calibration."}
              </span>
            </p>
            <div
              className={`grid gap-4 lg:grid-cols-3 ${reading ? "pointer-events-none opacity-60" : ""}`}
              aria-busy={reading}
            >
              {MILKS.map((m) => (
                <MilkCard
                  key={m.key}
                  m={m}
                  device={device}
                  doc={doc}
                  adj={adj}
                  enabled={!!center}
                  onAdj={setOne}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "tools" && (
          <div className="space-y-4">
            <SectionLabel>Eko Milk Credentials</SectionLabel>
            <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Contact">
                <Input readOnly value={cred.contact} />
              </Field>
              <Field label="PCB SerialNo">
                <Input readOnly value={cred.pcbSerial} />
              </Field>
              <Field label="Current Password">
                <PassInput readOnly value={cred.currentPass} />
              </Field>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field label="New Password">
                    <PassInput
                      value={cred.newPass}
                      disabled={!center}
                      onChange={(v) =>
                        setCred((c) => ({
                          ...c,
                          newPass: v.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={regen}
                  disabled={!center}
                  aria-label="Generate new password"
                  title="Generate new password"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-brand transition-colors hover:bg-brand/10 disabled:opacity-50"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-line accent-brand"
                checked={passApply}
                disabled={!center}
                onChange={(e) => setPassApply(e.target.checked)}
              />
              Password Apply
            </label>
            {passApply && !passOk && (
              <p className="text-sm font-semibold text-danger">
                New password must be 6 digits
              </p>
            )}
            <p className="text-sm text-mute">
              The password is applied together with the calibration when you
              press Review &amp; apply.
            </p>
          </div>
        )}

        {tab === "history" && (
          <>
            {pendingRecords > 0 && (
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                {pendingRecords} record{pendingRecords > 1 ? "s" : ""} waiting
                to be applied on the device.
              </p>
            )}
            <RecordsTable
              kind="eko"
              rows={rows}
              busyId={busyId}
              onCancel={setConfirmRow}
              loading={loading}
              emptyText={
                center
                  ? "No calibration records yet."
                  : "Select a center to see its records."
              }
            />
          </>
        )}

        {pending > 0 && (
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-panel px-4 py-3 shadow-pop">
            <p className="text-sm font-semibold">
              {pending} change{pending > 1 ? "s" : ""} pending
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={15} />}
                onClick={discard}
              >
                Discard
              </Button>
              <Button
                size="sm"
                icon={<ClipboardCheck size={15} />}
                disabled={!center}
                onClick={openReview}
              >
                Review &amp; apply
              </Button>
            </div>
          </div>
        )}

        <Modal
          open={review}
          onClose={saving ? () => undefined : () => setReview(false)}
          title={`Apply ${pending} change${pending > 1 ? "s" : ""} to ${vlccOption(center)}?`}
          width="max-w-lg"
          footer={
            <>
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => setReview(false)}
              >
                Cancel
              </Button>
              <Button loading={saving} onClick={() => void apply()}>
                Apply {pending} change{pending > 1 ? "s" : ""}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {changes.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-soft text-left text-[11px] uppercase tracking-wide text-mute">
                    <tr>
                      <th className="px-3 py-2">Parameter</th>
                      <th className="px-3 py-2 text-right">On device</th>
                      <th className="px-3 py-2 text-right">New</th>
                      <th className="px-3 py-2 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((c) => (
                      <tr key={c.k} className="border-t border-line">
                        <td className="px-3 py-2 font-semibold">{c.label}</td>
                        <td className="tnum px-3 py-2 text-right text-mute">
                          {c.on.toFixed(2)}
                        </td>
                        <td className="tnum px-3 py-2 text-right font-bold">
                          {c.next.toFixed(2)}
                        </td>
                        <td
                          className={`tnum px-3 py-2 text-right font-bold ${c.by < 0 ? "text-danger" : "text-ok"}`}
                        >
                          {signedText(c.by)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {passApply && (
              <p className="rounded-xl border border-line px-3 py-2 text-sm">
                Eko menu password will be changed to{" "}
                <b className="tnum">{cred.newPass}</b>.
              </p>
            )}
            <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">
              Every apply is stored in History, where a record that is still
              pending can be rejected.
            </p>
          </div>
        </Modal>

        <ConfirmReject
          row={confirmRow}
          busy={busyId !== null}
          onYes={reject}
          onNo={() => setConfirmRow(null)}
        />
      </div>
    </Card>
  );
};

const SAMPLE_ROWS: Array<["cow" | "buff" | "mix", string]> = [
  ["cow", "Cow Quality"],
  ["buff", "Buff Quality"],
  ["mix", "Mix Quality"],
];
const SAMPLE_COLS: Array<[keyof Sample3, string]> = [
  ["fat", "Fat"],
  ["snf", "SNF"],
  ["clr", "CLR"],
];

const ControlSampleCard: React.FC<{ ids: string[] }> = ({ ids }) => {
  const toast = useToast();
  const [center, setCenter] = useState("");
  const [vals, setVals] = useState<Record<"cow" | "buff" | "mix", Sample3>>({
    cow: emptySample(),
    buff: emptySample(),
    mix: emptySample(),
  });
  const [rows, setRows] = useState<ControlRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async (c: string) => {
    if (!c) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getControlSamples(c));
    } catch (e) {
      setError(message(e, "The control sample records could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords(center);
  }, [center, loadRecords]);

  
  const set = (r: "cow" | "buff" | "mix", c: keyof Sample3, v: string) =>
    setVals((x) => {
      const row = { ...x[r], [c]: decimal(v) };
      if (c !== "clr") row.clr = clrFromFatSnf(row.fat, row.snf);
      return { ...x, [r]: row };
    });
  const filled = SAMPLE_ROWS.some(([r]) =>
    SAMPLE_COLS.some(([c]) => vals[r][c] !== ""),
  );

  const submit = async () => {
    if (!center || !filled || saving) return;
    setSaving(true);
    try {
      await saveControlSample({
        stationId: center,
        entryDate: todayISO(),
        cow: vals.cow,
        buff: vals.buff,
        mix: vals.mix,
      });
      toast("Control sample saved successfully!");
      setVals({ cow: emptySample(), buff: emptySample(), mix: emptySample() });
      await loadRecords(center);
    } catch (e) {
      toast(message(e, "The control sample could not be saved"), "warn");
    } finally {
      setSaving(false);
    }
  };

  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const reject = async () => {
    const r = confirmRow;
    if (!r) return;
    setBusyId(r.id);
    try {
      await updateCorrectorFlag(center, r.id, REJECT_FLAG);
      toast("Record rejected");
      setConfirmRow(null);
      await loadRecords(center);
    } catch (e) {
      toast(message(e, "The record could not be updated"), "warn");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title={<CardTitle icon={FlaskConical}>Control Sample</CardTitle>}
      />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <CenterSelect value={center} onChange={setCenter} ids={ids} />
        </div>
        {error && (
          <ErrorBlock
            compact
            message={error}
            onRetry={() => void loadRecords(center)}
          />
        )}

        <div className="space-y-4">
          {SAMPLE_ROWS.map(([r, label]) => (
            <div
              key={r}
              className="grid grid-cols-3 items-end gap-3 sm:grid-cols-[8rem_repeat(3,minmax(0,1fr))] sm:gap-4"
            >
              <span className="col-span-3 text-sm font-bold sm:col-span-1 sm:pb-2">
                {label}
              </span>
              {SAMPLE_COLS.map(([c, colLabel]) => (
                <Field key={c} label={colLabel}>
                  <Input
                    inputMode="decimal"
                    disabled={!center}
                    value={vals[r][c]}
                    onChange={(e) => set(r, c, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          loading={saving}
          disabled={!center || !filled}
          onClick={submit}
        >
          Submit
        </Button>
        <ConfirmReject
          row={confirmRow}
          busy={busyId !== null}
          onYes={reject}
          onNo={() => setConfirmRow(null)}
        />
        <RecordsTable
          kind="control"
          rows={rows}
          busyId={busyId}
          onCancel={setConfirmRow}
          loading={loading}
          emptyText={
            center
              ? "No control sample records yet."
              : "Select a center to see its records."
          }
        />
      </div>
    </Card>
  );
};

const EkoMilkSettings: React.FC = () => {
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds;
  const ids = useMemo(
    () => (centers.length ? centers.map((c) => c.id) : (sessionIds ?? [])),
    [centers, sessionIds],
  );

  return (
    <ReportPage title="Eko Milk Settings">
      <Reveal delay={0.05}>
        <CalibrationCard ids={ids} />
      </Reveal>
      <Reveal delay={0.1}>
        <ControlSampleCard ids={ids} />
      </Reveal>
    </ReportPage>
  );
};

export default EkoMilkSettings;
