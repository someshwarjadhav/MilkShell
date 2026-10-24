import type * as React from "react";
import { useMemo, useState } from "react";
import { Check, Eye, ListChecks, Pencil, Trash2, X } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { Modal } from "../../components/ui/Modal";
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
import { todayISO } from "../../lib/format";
import { DEFAULT_PAGE_SIZE, GLOBALSSHIFT } from "../../lib/global";
import { useCenters } from "../../hooks/useSessionData";
import { getSession } from "../../services/session";
import { vlccOption } from "../../services/vlcc/names";
import {
  deleteEntry,
  forgetCachedLists,
  getCollection,
  updateEntry,
  type CollectionRow,
} from "../../services/transaction/manageCollection.api";
import { ApiError } from "../../services/http/errors";
import { norm } from "../../services/utils/loose";

const ALL = "ALL";
const SHIFTS = GLOBALSSHIFT.shiftOptions.filter(
  (s) => s.Id === "M" || s.Id === "E",
);

const MILKS = [
  { Id: "C", Name: "Cow" },
  { Id: "B", Name: "Buff" },
  { Id: "M", Name: "Mix" },
];
const KG_PER_LITRE = 1.03;

const val = (r: CollectionRow, ...keys: string[]): string => {
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
const two = (n: number) => n.toFixed(2);

const clrFrom = (snf: number, fat: number) => r1((snf - 0.21 * fat - 0.36) * 4);

const milkCode = (v: string) => {
  const x = v.trim().toLowerCase();
  if (x === "c" || x === "cow") return "C";
  if (x === "b" || x === "buff" || x === "buffalo") return "B";
  return "M";
};
const milkName = (code: string) =>
  MILKS.find((m) => m.Id === code)?.Name ?? "Mix";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const toIsoDate = (s: string): string => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(s.trim());
  if (!m) return "";
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  if (month < 1) return "";
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

const idOf = (r: CollectionRow) => val(r, "maxid");

const TEXT_COLS: Array<{
  key: string;
  header: string;
  align?: "right";
  get: (r: CollectionRow) => string;
}> = [
  { key: "date", header: "Date", get: (r) => val(r, "trdate", "date") },
  { key: "shift", header: "Shift", get: (r) => val(r, "shift") },
  { key: "fid", header: "Farmer Id", get: (r) => val(r, "farmerid") },
  { key: "fname", header: "Name", get: (r) => val(r, "farmername", "name") },
  { key: "liter", header: "Liter", align: "right", get: (r) => val(r, "qty") },
  { key: "kg", header: "Kg", align: "right", get: (r) => val(r, "kg") },
  { key: "fat", header: "Fat", align: "right", get: (r) => val(r, "fat") },
  { key: "snf", header: "Snf", align: "right", get: (r) => val(r, "snf") },
  { key: "clr", header: "Clr", align: "right", get: (r) => val(r, "clr") },
  { key: "milk", header: "Milk Type", get: (r) => val(r, "milktype") },
  { key: "station", header: "Station Id", get: (r) => val(r, "vlccid") },
  {
    key: "rate",
    header: "Rate",
    align: "right",
    get: (r) => val(r, "rtpl", "rate"),
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    get: (r) => val(r, "amount"),
  },
];

interface Draft {
  qty: string;
  fat: string;
  snf: string;
  clr: string;
  milk: string; // C | B | M
}

const CellInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label: string;
}> = ({ value, onChange, label }) => (
  <Input
    type="number"
    inputMode="decimal"
    min="0"
    step="any"
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="h-8 w-20 px-2 text-right"
  />
);

const ManageCollection: React.FC = () => {
  const toast = useToast();
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];
  const ids = centers.length ? centers.map((c) => c.id) : sessionIds;

  const [vlc, setVlc] = useState(ALL);
  const [milk, setMilk] = useState("C");
  const [shift, setShift] = useState("M");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const [applied, setApplied] = useState<{
    vlc: string;
    milk: string;
    shift: string;
    from: string;
    to: string;
  } | null>(null);

  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CollectionRow | null>(null);

  const range = from && to && from <= to;

  const show = async () => {
    if (!range || loading) return;
    const f = { vlc, milk, shift, from, to };

    const targets = vlc === ALL ? ids : [vlc];
    setApplied(f);
    setLoading(true);
    setError(null);
    setNote(null);
    setEditId(null);
    setDraft(null);
    setNeedle("");
    forgetCachedLists();
    try {
      const results = await Promise.allSettled(
        targets.map((id) =>
          getCollection({
            vlccid: id,
            shift,
            milktype: milk,
            fromdate: from,
            todate: to,
          }),
        ),
      );
      const ok = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );
      const failed = results.length - ok.length;
      if (ok.length === 0 && failed > 0) {
        const first = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        throw (
          first?.reason ??
          new ApiError("The entries could not be loaded.", "server")
        );
      }

      const seen = new Set<string>();
      const merged = ok.flat().filter((r) => {
        const k = idOf(r) || JSON.stringify(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setRows(merged);
      if (failed > 0)
        setNote(`${failed} of ${results.length} centres could not be loaded.`);
    } catch (e) {
      setRows([]);
      setError(
        e instanceof ApiError ? e.message : "The entries could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (r: CollectionRow) => {
    setEditId(idOf(r));
    setDraft({
      qty: val(r, "qty"),
      fat: val(r, "fat"),
      snf: val(r, "snf"),
      clr: val(r, "clr"),
      milk: milkCode(val(r, "milktype")),
    });
  };
  const cancelEdit = () => {
    setEditId(null);
    setDraft(null);
  };

  const changeDraft = (patch: Partial<Draft>) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      if ("fat" in patch || "snf" in patch) {
        const f = num(next.fat);
        const s = num(next.snf);
        if (f !== null && s !== null) next.clr = String(clrFrom(s, f));
      }
      return next;
    });

  const saveEdit = async (r: CollectionRow) => {
    if (!draft || busyId) return;
    const qty = num(draft.qty);
    const fat = num(draft.fat);
    const snf = num(draft.snf);
    const clr = num(draft.clr);
    if (
      qty === null ||
      qty <= 0 ||
      fat === null ||
      snf === null ||
      clr === null
    ) {
      toast("Enter Liter, Fat and SNF before saving", "warn");
      return;
    }
    const id = idOf(r);
    const date = toIsoDate(val(r, "trdate", "date"));
    if (!id || !date) {
      toast("This entry has no record id, so it cannot be edited", "warn");
      return;
    }
    setBusyId(id);
    try {
      const rate = await updateEntry({
        recordId: id,
        vlccid: val(r, "vlccid"),
        date,
        qty: String(qty),
        fat: String(fat),
        snf: String(snf),
        clr: String(clr),
        milktype: draft.milk,
      });

      setRows((all) =>
        all.map((x) =>
          idOf(x) === id
            ? {
                ...x,
                qty: two(qty),
                Kg: two(qty * KG_PER_LITRE),
                fat: two(fat),
                snf: two(snf),
                clr: two(clr),
                milktype: milkName(draft.milk),
                rtpl: two(rate),
                amount: two(qty * rate),
              }
            : x,
        ),
      );
      toast("Data updated successfully");
      cancelEdit();
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The entry could not be updated",
        "warn",
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const r = toDelete;
    if (!r || busyId) return;
    const id = idOf(r);
    setBusyId(id);
    try {
      await deleteEntry({
        recordId: id,
        vlccid: val(r, "vlccid"),
        date: toIsoDate(val(r, "trdate", "date")),
      });
      setRows((all) => all.filter((x) => idOf(x) !== id));
      toast("Entry deleted");
      setToDelete(null);
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The entry could not be deleted",
        "warn",
      );
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s
      ? rows.filter((r) =>
          TEXT_COLS.map((c) => c.get(r))
            .join(" ")
            .toLowerCase()
            .includes(s),
        )
      : rows;
  }, [rows, needle]);

  const columns: Column<CollectionRow>[] = useMemo(() => {
    const editing = (r: CollectionRow) => !!draft && editId === idOf(r);

    const text: Column<CollectionRow>[] = TEXT_COLS.map((c) => ({
      key: c.key,
      header: c.header,
      align: c.align,
      sort: (r) => {
        const v = c.get(r);
        return v !== "" && Number.isFinite(Number(v)) ? Number(v) : v;
      },
      cell: (r) => {
        if (editing(r) && draft) {
          switch (c.key) {
            case "liter":
              return (
                <CellInput
                  label="Liter"
                  value={draft.qty}
                  onChange={(v) => changeDraft({ qty: v })}
                />
              );
            case "fat":
              return (
                <CellInput
                  label="Fat"
                  value={draft.fat}
                  onChange={(v) => changeDraft({ fat: v })}
                />
              );
            case "snf":
              return (
                <CellInput
                  label="Snf"
                  value={draft.snf}
                  onChange={(v) => changeDraft({ snf: v })}
                />
              );
            case "clr":
              return <span className="tnum">{draft.clr || "—"}</span>;
            case "milk":
              return (
                <Select
                  aria-label="Milk type"
                  value={draft.milk}
                  onChange={(e) => changeDraft({ milk: e.target.value })}
                  className="h-8 w-28 text-xs"
                >
                  {MILKS.map((m) => (
                    <option key={m.Id} value={m.Id}>
                      {m.Name}
                    </option>
                  ))}
                </Select>
              );
            case "amount": {
              const q = num(draft.qty);
              const rt = num(val(r, "rtpl", "rate"));
              return q !== null && rt !== null ? two(q * rt) : c.get(r) || "—";
            }
          }
        }
        return c.get(r) || "—";
      },
    }));

    const edit: Column<CollectionRow> = {
      key: "edit",
      header: "Edit",
      align: "center",
      cell: (r) =>
        editing(r) ? (
          <span className="inline-flex items-center gap-1">
            <Button
              size="sm"
              variant="soft"
              aria-label="Save"
              icon={<Check size={14} />}
              loading={busyId === idOf(r)}
              onClick={() => void saveEdit(r)}
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label="Cancel"
              icon={<X size={14} />}
              disabled={busyId === idOf(r)}
              onClick={cancelEdit}
            />
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Edit entry"
            icon={<Pencil size={14} />}
            disabled={!!editId}
            onClick={() => startEdit(r)}
          />
        ),
    };

    const del: Column<CollectionRow> = {
      key: "delete",
      header: "Delete",
      align: "center",
      cell: (r) => (
        <Button
          size="sm"
          variant="danger"
          aria-label="Delete entry"
          icon={<Trash2 size={14} />}
          disabled={!!editId || busyId === idOf(r)}
          onClick={() => setToDelete(r)}
        />
      ),
    };

    return [...text, edit, del];
  }, [draft, editId, busyId]);

  const exportCols: ExportCol<CollectionRow>[] = useMemo(
    () => TEXT_COLS.map((c) => ({ header: c.header, value: (r) => c.get(r) })),
    [],
  );

  return (
    <ReportPage title="Manage Collection">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={ListChecks}>Collection Info</CardTitle>}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-6">
            <Field
              label="VLC Name"
              className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
            >
              <Select value={vlc} onChange={(e) => setVlc(e.target.value)}>
                <option value={ALL}>All</option>
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {vlccOption(id)}
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
            <Field label="Shift">
              <Select value={shift} onChange={(e) => setShift(e.target.value)}>
                {SHIFTS.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="From Date">
              <Input
                type="date"
                value={from}
                max={todayISO()}
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
                max={todayISO()}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>

            <div className="flex items-end sm:col-span-2 lg:col-span-3 xl:col-span-6">
              <Button
                className="w-full sm:w-auto sm:min-w-48"
                icon={<Eye size={16} />}
                loading={loading}
                disabled={!range || ids.length === 0}
                onClick={() => void show()}
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
                  `manage-collection-${applied.vlc}-${applied.from}-${applied.to}-${applied.shift}-${applied.milk}`,
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
            {note && !loading && (
              <p className="border-b border-line px-4 py-2 text-xs text-mute sm:px-6">
                {note}
              </p>
            )}
            {loading ? (
              <MilkLoader label="Loading entries…" />
            ) : error ? (
              <ErrorBlock message={error} onRetry={() => void show()} />
            ) : visible.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-mute">
                {rows.length === 0
                  ? "No entry for these filters."
                  : "Nothing matches your search."}
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={visible}
                rowKey={(r) => idOf(r) || JSON.stringify(r)}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            )}
          </Card>
        </Reveal>
      )}

      <Modal
        open={!!toDelete}
        onClose={() => (busyId ? undefined : setToDelete(null))}
        title="Delete this entry?"
        subtitle="This cannot be undone."
        width="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={!!busyId}
              onClick={() => setToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              loading={!!busyId}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </>
        }
      >
        {toDelete && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-mute">Date</dt>
            <dd className="font-semibold">
              {val(toDelete, "trdate", "date") || "—"}
            </dd>
            <dt className="text-mute">Farmer Id</dt>
            <dd className="font-semibold">
              {val(toDelete, "farmerid") || "—"}
            </dd>
            <dt className="text-mute">Liter</dt>
            <dd className="font-semibold">{val(toDelete, "qty") || "—"}</dd>
            <dt className="text-mute">Fat / Snf</dt>
            <dd className="font-semibold">
              {val(toDelete, "fat") || "—"} / {val(toDelete, "snf") || "—"}
            </dd>
            <dt className="text-mute">Amount</dt>
            <dd className="font-semibold">{val(toDelete, "amount") || "—"}</dd>
          </dl>
        )}
      </Modal>
    </ReportPage>
  );
};

export default ManageCollection;
