import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Field, Input, Select } from "../../components/ui/Fields";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { ErrorBlock } from "../../components/Widget";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportPage, Reveal } from "../../components/ReportKit";
import { useToast } from "../../context/ToastContext";
import { useCenters } from "../../hooks/useSessionData";
import { getSession } from "../../services/session";
import { vlccName, vlccOption } from "../../services/vlcc/names";
import { ApiError } from "../../services/http/errors";
import { nf } from "../../lib/format";
import { DEFAULT_PAGE_SIZE } from "../../lib/global";
import {
  deleteFarmer,
  getData,
  getDataById,
  getMaxId,
  postData,
  postExcel,
  updateFarmerStatus,
  type MasterRecord,
} from "../../services/master/farmerMaster.api";
import {
  digits,
  emptyFarmer,
  hasErrors,
  parseImportRows,
  validateFarmer,
  type FarmerErrors,
  type FarmerInput,
} from "../../services/master/farmerMaster.rules";
import {
  downloadSample,
  exportRecords,
  readImportFile,
} from "../../services/master/farmerMaster.excel";

const ALL = "ALL";
const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const Req: React.FC = () => <span className="text-danger"> *</span>;

const Err: React.FC<{ text?: string }> = ({ text }) =>
  text ? (
    <span className="mt-1 block text-xs font-semibold text-danger">{text}</span>
  ) : null;

const invalid = (e?: string) =>
  e ? "border-danger focus:border-danger focus:ring-danger/20" : "";

const FarmerMaster: React.FC = () => {
  const toast = useToast();
  const centers = useCenters();
  const session = getSession();

  const ids = useMemo(
    () =>
      centers.length ? centers.map((c) => c.id) : (session?.vlccIds ?? []),
    [centers, session?.vlccIds],
  );

  const codeOf = useCallback(
    (id: string) =>
      centers.find((c) => c.id === id)?.stationId ||
      session?.stationByVlcc?.[id] ||
      id,
    [centers, session?.stationByVlcc],
  );
  const customToReal = useMemo(
    () => Object.fromEntries(ids.map((id) => [codeOf(id), id])),
    [ids, codeOf],
  );

  const [rows, setRows] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listCenter, setListCenter] = useState(ALL);
  const [q, setQ] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getData(ids, customToReal);
      setRows(list);
      setChecks(Object.fromEntries(list.map((r) => [r.key, r.active])));
    } catch (e) {
      setError(msg(e, "The farmers could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [ids, customToReal]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => listCenter === ALL || r.vlccid === listCenter)
      .filter(
        (r) =>
          !s ||
          r.name.toLowerCase().includes(s) ||
          r.farmerId.includes(s) ||
          r.mobile.includes(s) ||
          r.account.includes(s),
      );
  }, [rows, listCenter, q]);

  const changed = useMemo(
    () =>
      rows.filter(
        (r) => checks[r.key] !== undefined && checks[r.key] !== r.active,
      ),
    [rows, checks],
  );
  const allChecked = shown.length > 0 && shown.every((r) => checks[r.key]);

  const firstCenter = ids[0] ?? "";
  const [form, setForm] = useState<FarmerInput>(() => emptyFarmer(firstCenter));
  const [editing, setEditing] = useState<MasterRecord | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [original, setOriginal] = useState<FarmerInput | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!form.vlccid && firstCenter)
      setForm((f) => ({ ...f, vlccid: firstCenter }));
  }, [firstCenter, form.vlccid]);

  const set = <K extends keyof FarmerInput>(k: K, v: FarmerInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const errors: FarmerErrors = useMemo(() => {
    const e = validateFarmer(form, editing && original ? original : undefined);
    if (
      !editing &&
      !e.farmerId &&
      rows.some(
        (r) =>
          r.vlccid === form.vlccid &&
          Number(r.farmerId) === Number(form.farmerId),
      )
    ) {
      e.farmerId = "This farmer code already exists in this center";
    }
    return e;
  }, [form, editing, original, rows]);

  const shownErr = (k: keyof FarmerInput): string | undefined => {
    const v = form[k];
    return submitted || (typeof v === "string" && v !== "")
      ? errors[k]
      : undefined;
  };

  useEffect(() => {
    if (editing || codeTouched || !form.vlccid || loading) return;
    let alive = true;
    const inList = Math.max(
      0,
      ...rows
        .filter((r) => r.vlccid === form.vlccid)
        .map((r) => Number(r.farmerId) || 0),
    );
    getMaxId(form.vlccid)
      .then((max) => {
        if (alive) set("farmerId", String(Math.max(max ?? 0, inList) + 1));
      })
      .catch(() => {
        if (alive) set("farmerId", String(inList + 1));
      });
    return () => {
      alive = false;
    };
  }, [form.vlccid, editing, codeTouched, loading, rows]);

  const resetForm = () => {
    setEditing(null);
    setOriginal(null);
    setSubmitted(false);
    setCodeTouched(false);
    setForm(emptyFarmer(editing?.vlccid || form.vlccid || firstCenter));
  };

  const submit = async () => {
    setSubmitted(true);
    if (hasErrors(errors)) {
      toast(
        Object.values(errors)[0] ?? "Please correct the highlighted fields",
        "warn",
      );
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await postData(form, !!editing);
      toast(
        editing ? "Farmer updated successfully!" : "Farmer saved successfully!",
      );
      resetForm();
      await load();
    } catch (e) {
      toast(msg(e, "The farmer could not be saved"), "warn");
    } finally {
      setSaving(false);
    }
  };

  const edit = async (r: MasterRecord) => {
    setOpening(r.key);
    let rec: MasterRecord = r;
    let full = true;
    try {
      const got = await getDataById(r.farmerId, r.vlccid);
      if (got) rec = got;
      else full = false;
    } catch {
      full = false;
    }
    setOpening(null);
    if (!full)
      toast(
        "Full details could not be loaded; check the bank, address and Aadhaar fields before updating",
        "warn",
      );
    const next: FarmerInput = {
      vlccid: r.vlccid,
      farmerId: r.farmerId,
      name: rec.name || r.name,
      nameInBank: rec.nameInBank || r.nameInBank,
      address: rec.address || r.address,
      mobile: rec.mobile || r.mobile,
      bank: rec.bank || r.bank,
      ifsc: rec.ifsc || r.ifsc,
      account: rec.account || r.account,
      aadhaar: rec.aadhaar || r.aadhaar,
      active: checks[r.key] ?? r.active,
    };
    setEditing(r);
    setOriginal(next);
    setSubmitted(false);
    setCodeTouched(true);
    setForm(next);
    window.setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const [toDelete, setToDelete] = useState<MasterRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteFarmer(toDelete.farmerId, toDelete.vlccid);
      toast("Farmer deleted successfully!");
      if (editing?.key === toDelete.key) resetForm();
      setToDelete(null);
      await load();
    } catch (e) {
      toast(msg(e, "The farmer could not be deleted"), "warn");
    } finally {
      setDeleting(false);
    }
  };

  const saveStatus = async () => {
    if (changed.length === 0 || savingStatus) return;
    setSavingStatus(true);
    try {
      const villages = new Set(changed.map((r) => r.vlccid));
      await updateFarmerStatus(
        rows
          .filter((r) => villages.has(r.vlccid))
          .map((r) => ({
            vlccid: r.vlccid,
            farmerId: r.farmerId,
            active: !!checks[r.key],
          })),
      );
      toast(
        `Status updated for ${changed.length} farmer${changed.length === 1 ? "" : "s"}`,
      );
      await load();
    } catch (e) {
      toast(msg(e, "The status could not be updated"), "warn");
    } finally {
      setSavingStatus(false);
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const centreRefs = useMemo(
    () => ids.map((id) => ({ id, code: codeOf(id) })),
    [ids, codeOf],
  );

  const runImport = async () => {
    if (!file || importing) return;
    setImporting(true);
    setImportErrors([]);
    try {
      const raw = await readImportFile(file);
      const res = parseImportRows(raw, centreRefs, firstCenter);
      if (res.errors.length) {
        setImportErrors(res.errors);
        toast("Fix the highlighted rows and import again", "warn");
        return;
      }
      const dupes = res.valid.filter((f) =>
        rows.some(
          (r) =>
            r.vlccid === f.vlccid && Number(r.farmerId) === Number(f.farmerId),
        ),
      );

      await postExcel(res.valid);
      toast(
        `${res.valid.length} farmer${res.valid.length === 1 ? "" : "s"} imported${dupes.length ? ` (${dupes.length} existing updated)` : ""}`,
      );
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      const m = msg(
        e,
        "The file could not be read. Use the sample file format (.xlsx).",
      );
      setImportErrors([m]);
      toast(m, "warn");
    } finally {
      setImporting(false);
    }
  };

  const sample = async () => {
    const next =
      Math.max(
        0,
        ...rows
          .filter((r) => r.vlccid === firstCenter)
          .map((r) => Number(r.farmerId) || 0),
      ) + 1;
    await downloadSample(
      ids.map((id) => ({ id, code: codeOf(id), name: vlccName(id) })),
      next,
    );
  };

  const exportList = async () => {
    const day = new Date().toISOString().slice(0, 10);
    await exportRecords(
      shown.map((r) => ({ ...r, active: checks[r.key] ?? r.active })),
      `farmer-master-${day}`,
    );
    toast("Excel file downloaded");
  };

  const cols: Column<MasterRecord>[] = [
    {
      key: "v",
      header: "Vlccid",
      sort: (r) => codeOf(r.vlccid),
      cell: (r) => codeOf(r.vlccid),
    },
    {
      key: "id",
      header: "Farmer Id",
      sort: (r) => Number(r.farmerId) || 0,
      cell: (r) => r.farmerId,
    },
    {
      key: "name",
      header: "Farmer Name",
      sort: (r) => r.name,
      cell: (r) => r.name || "—",
    },
    { key: "mob", header: "Mobile No", cell: (r) => r.mobile || "—" },
    { key: "bank", header: "Bank Name", cell: (r) => r.bank || "—" },
    { key: "ac", header: "Account No", cell: (r) => r.account || "—" },
    { key: "ifsc", header: "IFSC", cell: (r) => r.ifsc || "—" },
    {
      key: "st",
      header: "Status",
      cell: (r) =>
        (checks[r.key] ?? r.active) ? (
          <Badge tone="ok" dot>
            Active
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Inactive
          </Badge>
        ),
    },
    {
      key: "act",
      header: (
        <span className="flex items-center gap-2">
          Action
          <input
            type="checkbox"
            aria-label="Select all"
            className="h-4 w-4 accent-brand"
            checked={allChecked}
            onChange={(e) =>
              setChecks((c) => ({
                ...c,
                ...Object.fromEntries(
                  shown.map((r) => [r.key, e.target.checked]),
                ),
              }))
            }
          />
        </span>
      ),
      cell: (r) => (
        <span className="flex items-center gap-3">
          <button
            aria-label={`Edit ${r.name}`}
            title="Edit"
            disabled={opening === r.key}
            onClick={() => void edit(r)}
            className="text-brand hover:opacity-70 disabled:opacity-40"
          >
            <Pencil size={16} />
          </button>
          <button
            aria-label={`Delete ${r.name}`}
            title="Delete"
            onClick={() => setToDelete(r)}
            className="text-danger hover:opacity-70"
          >
            <Trash2 size={16} />
          </button>
          <input
            type="checkbox"
            aria-label={`Active ${r.name}`}
            className="h-4 w-4 accent-brand"
            checked={!!checks[r.key]}
            onChange={(e) =>
              setChecks((c) => ({ ...c, [r.key]: e.target.checked }))
            }
          />
        </span>
      ),
    },
  ];

  const noCenters = ids.length === 0;

  return (
    <ReportPage title="Farmer Master">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Reveal delay={0.05}>
          <div ref={formRef} className="scroll-mt-4">
            <Card>
              <CardHeader
                title={
                  <CardTitle icon={Users}>
                    {editing
                      ? `Edit Farmer ${editing.farmerId}`
                      : "Farmer Master"}
                  </CardTitle>
                }
                action={
                  editing ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RotateCcw size={14} />}
                      onClick={resetForm}
                    >
                      Cancel edit
                    </Button>
                  ) : undefined
                }
              />
              <div className="space-y-4 px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
                <Field label="Center Name">
                  <Select
                    value={form.vlccid}
                    disabled={!!editing || noCenters}
                    className={invalid(submitted ? errors.vlccid : undefined)}
                    onChange={(e) => {
                      set("vlccid", e.target.value);
                      setCodeTouched(false);
                    }}
                  >
                    {noCenters && <option value="">-- no center --</option>}
                    {form.vlccid && !ids.includes(form.vlccid) && (
                      <option value={form.vlccid}>{form.vlccid}</option>
                    )}
                    {ids.map((id) => (
                      <option key={id} value={id}>
                        {vlccOption(id)}
                      </option>
                    ))}
                  </Select>
                  <Err text={submitted ? errors.vlccid : undefined} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <Field label="Farmer Code">
                    <Input
                      inputMode="numeric"
                      disabled={!!editing}
                      value={form.farmerId}
                      className={invalid(shownErr("farmerId"))}
                      onChange={(e) => {
                        setCodeTouched(true);
                        set("farmerId", digits(e.target.value, 9));
                      }}
                    />
                    <Err text={shownErr("farmerId")} />
                  </Field>
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-sm font-semibold">
                      Farmer Name
                      <Req />
                    </span>
                    <Input
                      value={form.name}
                      maxLength={60}
                      className={invalid(shownErr("name"))}
                      onChange={(e) => set("name", e.target.value)}
                    />
                    <Err text={shownErr("name")} />
                  </label>
                </div>

                <Field label="Farmer Name As Per Bank">
                  <Input
                    value={form.nameInBank}
                    maxLength={60}
                    className={invalid(shownErr("nameInBank"))}
                    onChange={(e) => set("nameInBank", e.target.value)}
                  />
                  <Err text={shownErr("nameInBank")} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Farmer Address">
                    <Input
                      value={form.address}
                      maxLength={110}
                      className={invalid(shownErr("address"))}
                      onChange={(e) => set("address", e.target.value)}
                    />
                    <Err text={shownErr("address")} />
                  </Field>
                  <Field label="Mobile Number">
                    <Input
                      inputMode="numeric"
                      value={form.mobile}
                      className={invalid(shownErr("mobile"))}
                      onChange={(e) =>
                        set("mobile", digits(e.target.value, 15))
                      }
                    />
                    <Err text={shownErr("mobile")} />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Bank Name">
                    <Input
                      value={form.bank}
                      maxLength={60}
                      className={invalid(shownErr("bank"))}
                      onChange={(e) => set("bank", e.target.value)}
                    />
                    <Err text={shownErr("bank")} />
                  </Field>
                  <Field label="Bank IFSC">
                    <Input
                      value={form.ifsc}
                      maxLength={15}
                      className={invalid(shownErr("ifsc"))}
                      onChange={(e) =>
                        set(
                          "ifsc",
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, ""),
                        )
                      }
                    />
                    <Err text={shownErr("ifsc")} />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Bank Account No">
                    <Input
                      inputMode="numeric"
                      value={form.account}
                      className={invalid(shownErr("account"))}
                      onChange={(e) =>
                        set("account", digits(e.target.value, 25))
                      }
                    />
                    <Err text={shownErr("account")} />
                  </Field>
                  <Field label="Aadhaar No">
                    <Input
                      inputMode="numeric"
                      value={form.aadhaar}
                      className={invalid(shownErr("aadhaar"))}
                      onChange={(e) =>
                        set("aadhaar", digits(e.target.value, 15))
                      }
                    />
                    <Err text={shownErr("aadhaar")} />
                  </Field>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-line accent-brand"
                    checked={form.active}
                    onChange={(e) => set("active", e.target.checked)}
                  />
                  Active
                </label>

                <Button
                  className="w-full"
                  icon={editing ? <Pencil size={15} /> : <Plus size={15} />}
                  loading={saving}
                  disabled={noCenters}
                  onClick={() => void submit()}
                >
                  {editing ? "Update Farmer Record" : "Save Farmer Record"}
                </Button>
              </div>
            </Card>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Card>
            <CardHeader
              title={<CardTitle icon={Upload}>Farmer Import</CardTitle>}
            />
            <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
              <Field label="File Input">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setImportErrors([]);
                  }}
                  className="block w-full rounded-xl border border-line bg-panel text-sm file:mr-3 file:h-10 file:cursor-pointer file:border-0 file:bg-soft file:px-4 file:text-sm file:font-semibold hover:border-brand/50"
                />
              </Field>

              <div>
                <p className="text-sm font-bold">
                  Click Below To Download The Sample File
                </p>
                <button
                  type="button"
                  onClick={() => void sample()}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand underline underline-offset-2 hover:opacity-80"
                >
                  <Download size={15} />
                  Download Sample File
                </button>
              </div>

              {importErrors.length > 0 && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm"
                >
                  <p className="font-bold text-danger">
                    {importErrors.length} problem
                    {importErrors.length === 1 ? "" : "s"} found, nothing was
                    imported
                  </p>
                  <ul className="mt-1.5 max-h-48 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                    {importErrors.slice(0, 50).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                  {importErrors.length > 50 && (
                    <p className="mt-1 text-xs text-mute">
                      …and {importErrors.length - 50} more.
                    </p>
                  )}
                </div>
              )}

              <Button
                icon={<FileSpreadsheet size={16} />}
                loading={importing}
                disabled={!file || noCenters}
                onClick={() => void runImport()}
              >
                Import Farmer Excel
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.15}>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="brand">Record Count: {nf(shown.length)}</Badge>
              <div className="w-56">
                <Select
                  value={listCenter}
                  onChange={(e) => setListCenter(e.target.value)}
                  aria-label="Center"
                >
                  <option value={ALL}>All centers</option>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      {vlccOption(id)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-56">
                <Input
                  icon={<Search size={16} />}
                  placeholder="Name, code, mobile or account"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="soft"
                className="min-w-32"
                icon={<FileSpreadsheet size={15} />}
                disabled={loading || shown.length === 0}
                onClick={() => void exportList()}
              >
                Excel Export
              </Button>
              <Button
                className="min-w-32"
                loading={savingStatus}
                disabled={changed.length === 0}
                onClick={() => void saveStatus()}
              >
                Update Status{changed.length ? ` (${changed.length})` : ""}
              </Button>
            </div>
          </div>
          {loading ? (
            <MilkLoader variant="image" label="Loading farmers…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => void load()} />
          ) : (
            <DataTable
              columns={cols}
              rows={shown}
              rowKey={(r) => r.key}
              pageSize={DEFAULT_PAGE_SIZE}
              pageSizes={[10, 25, 50, 100, 250]}
              sizeLabel="Result per page"
              empty={
                <p className="px-6 py-10 text-center text-sm text-mute">
                  No farmers found.
                </p>
              }
            />
          )}
        </Card>
      </Reveal>

      <Modal
        open={!!toDelete}
        onClose={() => (deleting ? undefined : setToDelete(null))}
        title="Delete farmer?"
        subtitle={
          toDelete
            ? `${toDelete.name || "Farmer"} · code ${toDelete.farmerId} · ${vlccOption(toDelete.vlccid)}`
            : ""
        }
        footer={
          <>
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => setToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-mute">
          This removes the farmer from the portal. This cannot be undone.
        </p>
      </Modal>
    </ReportPage>
  );
};

export default FarmerMaster;
