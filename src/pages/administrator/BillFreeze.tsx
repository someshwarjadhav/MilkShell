import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LockOpen, RotateCcw, Snowflake } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Fields";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { ErrorBlock } from "../../components/Widget";
import { MilkLoader } from "../../components/MilkLoader";
import { CardTitle, ReportBar, ReportPage, Reveal } from "../../components/ReportKit";
import { CentreField, SubmitButton } from "../../components/ReportFilters";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_PAGE_SIZE } from "../../lib/global";
import { fmtDate } from "../../lib/format";
import { exportExcel, type ExportCol } from "../../lib/export";
import { useFirstCentre } from "../../hooks/useCentres";
import { ApiError } from "../../services/http/errors";
import { vlccLabel } from "../../services/vlcc/names";
import { pick, type Obj } from "../../services/utils/loose";
import { normaliseDate } from "../../services/account/voucher.common";
import {
  FREEZE_FIELDS,
  getBillFreezes,
  unfreezeBill,
} from "../../services/administrator/billFreeze.api";

interface FreezeRow {
  key: string;
  raw: Obj;
  no: string;
  vlcId: string;
  vlcName: string;
  start: string;
  end: string;
}

const dateText = (v: string) => {
  const iso = normaliseDate(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? fmtDate(iso) : v;
};

const toRow = (raw: Obj, vlc: string, i: number): FreezeRow => {
  const no = pick(raw, FREEZE_FIELDS.id);
  const vlcId = pick(raw, FREEZE_FIELDS.villageId) || vlc;
  return {
    key: `${no || "row"}:${i}`,
    raw,
    no,
    vlcId,
    vlcName: vlccLabel(vlcId, pick(raw, FREEZE_FIELDS.villageName)),
    start: dateText(pick(raw, FREEZE_FIELDS.start)),
    end: dateText(pick(raw, FREEZE_FIELDS.end)),
  };
};

const message = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

/** Administrator > Bill Unfreeze: the frozen 10-day bill periods of a VLC, with an Unfreeze button per period. */
const BillFreeze: React.FC = () => {
  const toast = useToast();
  const firstCentre = useFirstCentre();
  const [vlc, setVlc] = useState("");
  const [applied, setApplied] = useState("");
  const [rows, setRows] = useState<FreezeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");
  const [confirm, setConfirm] = useState<FreezeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const stamp = useRef(0);

  const vlcId = vlc || firstCentre;

  const load = useCallback(async (id: string) => {
    if (!id) return;
    const me = ++stamp.current;
    setLoading(true);
    setError(null);
    try {
      const got = await getBillFreezes(id);
      if (me === stamp.current) setRows(got.map((r, i) => toRow(r, id, i)));
    } catch (e) {
      if (me !== stamp.current) return;
      setRows([]);
      setError(message(e, "The frozen bills could not be loaded."));
    } finally {
      if (me === stamp.current) setLoading(false);
    }
  }, []);

  // the first centre is shown straight away, like the portal
  useEffect(() => {
    if (!applied && firstCentre) {
      setApplied(firstCentre);
      void load(firstCentre);
    }
  }, [applied, firstCentre, load]);

  const show = () => {
    if (!vlcId) return;
    setApplied(vlcId);
    void load(vlcId);
  };

  const doUnfreeze = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      await unfreezeBill(confirm.raw, applied);
      toast("Bill unfreezed");
      setConfirm(null);
      await load(applied);
    } catch (e) {
      toast(message(e, "The bill could not be unfreezed."), "warn");
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s
      ? rows.filter((r) =>
          `${r.no} ${r.vlcName} ${r.start} ${r.end}`.toLowerCase().includes(s),
        )
      : rows;
  }, [rows, needle]);

  const columns: Column<FreezeRow>[] = [
    { key: "no", header: "Sr No", sort: (r) => Number(r.no) || 0, cell: (r) => r.no || "—" },
    { key: "vlc", header: "VLC", sort: (r) => r.vlcName, cell: (r) => <span className="font-semibold">{r.vlcName}</span> },
    { key: "start", header: "Start Date", cell: (r) => r.start || "—" },
    { key: "end", header: "End Date", cell: (r) => r.end || "—" },
    {
      key: "act",
      header: "Action",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant="soft" icon={<LockOpen size={14} />} onClick={() => setConfirm(r)}>
          Unfreeze
        </Button>
      ),
    },
  ];
  const exportCols: ExportCol<FreezeRow>[] = [
    { header: "Sr No", value: (r) => r.no },
    { header: "VLC", value: (r) => r.vlcName },
    { header: "Start Date", value: (r) => r.start },
    { header: "End Date", value: (r) => r.end },
  ];

  return (
    <ReportPage title="Bill Unfreeze">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Snowflake}>Frozen bills</CardTitle>}
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={() => {
                  setVlc(firstCentre);
                  setNeedle("");
                }}
              >
                Reset
              </Button>
            }
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <CentreField className="lg:col-span-2" value={vlc || firstCentre} onChange={setVlc} />
            <SubmitButton label="Show" loading={loading} disabled={!vlcId} onClick={show} />
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
              onExport={() => exportExcel(`bill-unfreeze-${applied}`, exportCols, visible)}
              left={
                <div className="w-56 max-w-full">
                  <Input placeholder="Search" value={needle} onChange={(e) => setNeedle(e.target.value)} />
                </div>
              }
            />
            {loading ? (
              <MilkLoader label="Loading frozen bills…" />
            ) : error ? (
              <ErrorBlock message={error} onRetry={() => void load(applied)} />
            ) : visible.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-mute">
                {rows.length === 0
                  ? "No frozen bill for this VLC."
                  : "Nothing matches your search."}
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={visible}
                rowKey={(r) => r.key}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            )}
          </Card>
        </Reveal>
      )}

      <Modal
        open={!!confirm}
        onClose={() => (busy ? undefined : setConfirm(null))}
        title="Unfreeze this bill?"
        subtitle={confirm ? `${confirm.vlcName} · ${confirm.start} to ${confirm.end}` : undefined}
        footer={
          <>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button icon={<LockOpen size={15} />} loading={busy} onClick={() => void doUnfreeze()}>
              Unfreeze
            </Button>
          </>
        }
      >
        <p className="text-sm text-mute">
          The bill of this period will be opened again, so collections and deductions of these dates can be changed.
        </p>
      </Modal>
    </ReportPage>
  );
};

export default BillFreeze;
