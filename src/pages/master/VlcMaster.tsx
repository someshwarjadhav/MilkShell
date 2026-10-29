import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Download,
  Eye,
  EyeOff,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
} from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Field, Input, Select } from "../../components/ui/Fields";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { ErrorBlock } from "../../components/Widget";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportPage, Reveal } from "../../components/ReportKit";
import { useToast } from "../../context/ToastContext";
import { getSession } from "../../services/session";
import { ApiError } from "../../services/http/errors";
import { GLOBALS } from "../../lib/global";
import { cn } from "../../lib/cn";
import {
  assertConfigured,
  createVillage,
  emptyVlc,
  getMaxVlcc,
  getMccRoute,
  getVillageById,
  getVillageDetails,
  updateVillage,
  VLC_TYPES,
  type VlcInput,
  type VlcRecord,
  type VlcRoute,
  type VlcSlots,
} from "../../services/master/vlcMaster.api";
import { exportVlcMaster } from "../../services/master/vlcMaster.excel";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const randomPass = () => String(Math.floor(100000 + Math.random() * 900000));

const Err: React.FC<{ text?: string }> = ({ text }) =>
  text ? (
    <span className="mt-1 block text-xs font-semibold text-danger">{text}</span>
  ) : null;

const invalid = (e?: string) =>
  e ? "border-danger focus:border-danger focus:ring-danger/20" : "";

const Stat: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <div className="min-w-[5.5rem]">
    <div className="text-sm font-semibold">{label}</div>
    <div className="mt-2 h-10 text-2xl font-extrabold text-ok">
      {value || ""}
    </div>
  </div>
);

const PassInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
}> = ({ value, onChange, disabled, label }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        inputMode="numeric"
        aria-label={label}
        autoComplete="new-password"
        disabled={disabled}
        value={value}
        className="pr-10"
        onChange={(e) => onChange(digits(e.target.value, 10))}
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const VlcMaster: React.FC = () => {
  const toast = useToast();
  const sess = getSession();

  const mccid =
    sess?.mccLoginId ||
    GLOBALS.mccLoginId ||
    sess?.mccId ||
    GLOBALS.mccid ||
    "";
  const plantid = GLOBALS.plantid || "";
  const userId = GLOBALS.userid || "";

  const [routes, setRoutes] = useState<VlcRoute[]>([]);
  const [routeId, setRouteId] = useState("");
  const [slots, setSlots] = useState<VlcSlots | null>(null);
  const [rows, setRows] = useState<VlcRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [form, setForm] = useState<VlcInput>(emptyVlc());
  const [editing, setEditing] = useState<VlcRecord | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [size, setSize] = useState(100);
  const formRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof VlcInput>(k: K, v: VlcInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    setError(null);
    (async () => {
      try {
        assertConfigured(mccid, plantid);
        const [r, s] = await Promise.all([
          getMccRoute(mccid, plantid),
          getMaxVlcc(mccid, plantid).catch(() => null),
        ]);
        if (!alive) return;
        setRoutes(r);
        setSlots(s);
        setRouteId((cur) =>
          r.some((x) => x.routeId === cur) ? cur : (r[0]?.routeId ?? ""),
        );
      } catch (e) {
        if (alive)
          setError(msg(e, "The MCC / route list could not be loaded."));
      }
    })();
    return () => {
      alive = false;
    };
  }, [mccid, plantid, tick]);

  useEffect(() => {
    if (!routeId) {
      setRows([]);
      setListLoading(false);
      return;
    }
    let alive = true;
    setListLoading(true);
    getVillageDetails(mccid, routeId)
      .then((l) => alive && setRows(l))
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        toast(msg(e, "The VLC list could not be loaded."), "warn");
      })
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
  }, [mccid, routeId, tick]);

  const idFromServer = !!slots?.nextVillageId;
  useEffect(() => {
    if (editing) return;
    setForm((f) => ({ ...f, villageId: slots?.nextVillageId ?? f.villageId }));
  }, [slots?.nextVillageId, editing]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof VlcInput, string>> = {};
    if (!form.villageId.trim()) e.villageId = "VLC id is required";
    else if (
      !editing &&
      rows.some((r) => r.villageId === form.villageId.trim())
    )
      e.villageId = "This VLC id already exists";
    if (!form.villageName.trim()) e.villageName = "VLC name is required";
    if (form.contact && !/^\d{10}$/.test(form.contact))
      e.contact = "Enter a 10 digit number";
    if (form.passApply) {
      if (!/^\d{4,10}$/.test(form.newPass))
        e.newPass = "Enter the new password (digits only)";
    }
    return e;
  }, [form, rows, editing]);
  const shown = (k: keyof VlcInput) => (submitted ? errors[k] : undefined);

  const resetForm = useCallback(() => {
    setEditing(null);
    setSubmitted(false);
    setForm(emptyVlc(slots?.nextVillageId ?? ""));
  }, [slots?.nextVillageId]);

  const refresh = () => setTick((t) => t + 1);

  const submit = async () => {
    setSubmitted(true);
    const first = Object.values(errors)[0];
    if (first) return toast(first, "warn");
    if (!routeId) return toast("Select the MCC / BMC first", "warn");
    if (saving) return;
    setSaving(true);
    try {
      const ctx = {
        mccid,
        routeid: routeId,
        userId,
        rateId: editing?.rateId,
      };
      if (editing) await updateVillage(form, ctx);
      else await createVillage(form, ctx);
      toast(editing ? "VLC updated successfully!" : "VLC saved successfully!");
      setEditing(null);
      setSubmitted(false);
      setForm(emptyVlc());

      refresh();
    } catch (e) {
      toast(msg(e, "The VLC could not be saved"), "warn");
    } finally {
      setSaving(false);
    }
  };

  const edit = async (r: VlcRecord) => {
    setOpening(r.key);
    let rec = r;
    try {
      const got = await getVillageById(r.villageId);
      if (got)
        rec = {
          ...r,
          ...Object.fromEntries(
            Object.entries(got).filter(([, v]) => v !== ""),
          ),
        } as VlcRecord;
    } catch {}
    setOpening(null);
    setEditing(r);
    setSubmitted(false);
    setForm({
      villageId: rec.villageId,
      villageName: rec.villageName,
      type: rec.type || VLC_TYPES[0],
      active: rec.active,
      agentName: rec.agentName,
      contact: rec.contact,
      pcbNo: rec.pcbNo,
      currentPass: rec.ekoPass,
      newPass: "",
      passApply: false,
    });
    window.setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const exportList = async () => {
    if (!rows.length) return toast("There is nothing to export", "warn");
    await exportVlcMaster(rows, "VillageMaster");
    toast("Excel file downloaded");
  };

  const cols: Column<VlcRecord>[] = [
    {
      key: "id",
      header: "Village Id",
      sort: (r) => Number(r.villageId) || 0,
      cell: (r) => r.displayId || r.villageId || "—",
    },
    {
      key: "name",
      header: "Village Name",
      sort: (r) => r.villageName,
      cell: (r) => r.villageName || "—",
    },
    { key: "agent", header: "Agent Name", cell: (r) => r.agentName || "—" },
    { key: "contact", header: "Contact", cell: (r) => r.contact || "—" },
    {
      key: "st",
      header: "Status",
      cell: (r) =>
        r.active ? (
          <Badge tone="ok" dot>
            Active
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Inactive
          </Badge>
        ),
    },
    { key: "pcb", header: "PCB No", cell: (r) => r.pcbNo || "—" },
    { key: "pass", header: "EUP Pass", cell: (r) => r.ekoPass || "—" },
    {
      key: "act",
      header: "Action",
      cell: (r) => (
        <button
          aria-label={`Edit ${r.villageName}`}
          title="Edit"
          disabled={opening === r.key}
          onClick={() => void edit(r)}
          className="text-brand hover:opacity-70 disabled:opacity-40"
        >
          <Pencil size={16} />
        </button>
      ),
    },
  ];

  return (
    <ReportPage title="VLC Master">
      {error ? (
        <Card>
          <ErrorBlock message={error} onRetry={refresh} />
        </Card>
      ) : (
        <>
          <Reveal delay={0.05}>
            <div ref={formRef} className="scroll-mt-4">
              <Card>
                <CardHeader
                  title={
                    <CardTitle icon={Building2}>
                      {editing
                        ? `Edit VLC ${editing.villageId}`
                        : "VLC (Village Level Center)"}
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
                <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
                  <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                    <Field
                      label="MCC/BMC Name"
                      className="w-full max-w-md flex-1"
                    >
                      <Select
                        value={routeId}
                        disabled={!!editing}
                        onChange={(e) => setRouteId(e.target.value)}
                      >
                        {routes.length === 0 && (
                          <option value="">-- no MCC / BMC --</option>
                        )}
                        {routes.map((r) => (
                          <option key={r.routeId} value={r.routeId}>
                            {r.routeName || r.routeId}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Stat
                      label="Allocated Station Id"
                      value={slots?.allocated}
                    />
                    <Stat label="Used Station Id" value={slots?.used} />
                    <Stat
                      label="Available Station Id"
                      value={slots?.available}
                    />
                  </div>

                  <div className="grid items-end gap-4 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,16rem)_auto]">
                    <Field label="VLC ID">
                      <Input
                        inputMode="numeric"
                        readOnly={!!editing || idFromServer}
                        value={form.villageId}
                        className={cn(
                          (!!editing || idFromServer) && "bg-brand/5",
                          invalid(shown("villageId")),
                        )}
                        onChange={(e) =>
                          set("villageId", digits(e.target.value, 9))
                        }
                      />
                      <Err text={shown("villageId")} />
                    </Field>
                    <Field label="VLC Name">
                      <Input
                        value={form.villageName}
                        maxLength={60}
                        className={invalid(shown("villageName"))}
                        onChange={(e) => set("villageName", e.target.value)}
                      />
                      <Err text={shown("villageName")} />
                    </Field>
                    <Field label="VLC Type">
                      <Select
                        value={form.type}
                        onChange={(e) => set("type", e.target.value)}
                      >
                        {!VLC_TYPES.includes(form.type) && form.type && (
                          <option value={form.type}>{form.type}</option>
                        )}
                        {VLC_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <label className="flex h-10 cursor-pointer items-center gap-2.5 text-sm font-semibold">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-line accent-brand"
                        checked={form.active}
                        onChange={(e) => set("active", e.target.checked)}
                      />
                      VLC Active
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Contact Person">
                      <Input
                        value={form.agentName}
                        maxLength={60}
                        onChange={(e) => set("agentName", e.target.value)}
                      />
                    </Field>
                    <Field label="Contact">
                      <Input
                        inputMode="numeric"
                        value={form.contact}
                        className={invalid(shown("contact"))}
                        onChange={(e) =>
                          set("contact", digits(e.target.value, 10))
                        }
                      />
                      <Err text={shown("contact")} />
                    </Field>
                  </div>

                  <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Field label="PCB SerialNo">
                      <Input
                        inputMode="numeric"
                        value={form.pcbNo}
                        maxLength={15}
                        onChange={(e) =>
                          set("pcbNo", digits(e.target.value, 15))
                        }
                      />
                    </Field>
                    <Field label="Current Password">
                      <PassInput
                        label="Current password"
                        value={form.currentPass}
                        onChange={(v) => set("currentPass", v)}
                      />
                    </Field>
                    <Field label="New Password">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <PassInput
                            label="New password"
                            disabled={!form.passApply}
                            value={form.newPass}
                            onChange={(v) => set("newPass", v)}
                          />
                        </div>
                        <button
                          type="button"
                          title="Generate password"
                          aria-label="Generate password"
                          disabled={!form.passApply}
                          onClick={() => set("newPass", randomPass())}
                          className="text-brand hover:opacity-70 disabled:opacity-40"
                        >
                          <RefreshCw size={18} />
                        </button>
                      </div>
                      <Err text={shown("newPass")} />
                    </Field>
                    <label className="flex h-10 cursor-pointer items-center gap-2.5 text-sm font-semibold">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-line accent-brand"
                        checked={form.passApply}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            passApply: e.target.checked,
                            newPass: e.target.checked ? f.newPass : "",
                          }))
                        }
                      />
                      Password Apply
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Button
                      className="w-full"
                      icon={<Save size={15} />}
                      loading={saving}
                      disabled={!routeId}
                      onClick={() => void submit()}
                    >
                      {editing ? "Update" : "Submit"}
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      icon={<RotateCcw size={15} />}
                      onClick={resetForm}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span>
                    <b>Record Count:</b>{" "}
                    {rows.length
                      ? `1 - ${Math.min(size, rows.length)} of ${rows.length}`
                      : "0"}
                  </span>
                  <label className="flex items-center gap-2">
                    <b>Result per page:</b>
                    <Select
                      value={String(size)}
                      className="w-24"
                      onChange={(e) => setSize(Number(e.target.value))}
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                <Button
                  icon={<Download size={15} />}
                  onClick={() => void exportList()}
                >
                  Excel Export
                </Button>
              </div>
              {listLoading ? (
                <div className="px-5 pb-8 sm:px-6">
                  <MilkLoader variant="image" label="Loading VLC list…" />
                </div>
              ) : (
                <DataTable
                  key={`${routeId}-${size}`}
                  columns={cols}
                  rows={rows}
                  rowKey={(r) => r.key}
                  pageSize={size}
                  pageSizes={[10, 25, 50, 100]}
                />
              )}
            </Card>
          </Reveal>
        </>
      )}
    </ReportPage>
  );
};

export default VlcMaster;
