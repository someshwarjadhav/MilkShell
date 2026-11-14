import type * as React from "react";
import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Select } from "../../components/ui/Fields";
import {
  DataTable,
  type Column,
} from "../../components/ui/DataTable";
import { MilkLoader } from "../../components/MilkLoader";
import {
  CardTitle,
  ReportBar,
  ReportPage,
  Reveal,
} from "../../components/ReportKit";
import { ErrorBlock } from "../../components/Widget";
import { useCentreOptions } from "../../hooks/useCentres";
import { useToast } from "../../context/ToastContext";
import {
  getSyncMembers,
  updateSyncMembers,
  type SyncMember,
} from "../../services/administrator/dpuSyncAsync.api";
import { ApiError } from "../../services/http/errors";

const box = "h-4 w-4 cursor-pointer accent-brand disabled:cursor-not-allowed";

const DpuSyncAsync: React.FC = () => {
  const options = useCentreOptions();
  const toast = useToast();

  const [picked, setPicked] = useState("");
  const vlc = picked || options[0]?.id || "";

  // centre whose farmers are on screen now
  const [applied, setApplied] = useState<string | null>(null);
  const [rows, setRows] = useState<SyncMember[]>([]);
  // true once a tick was changed on screen and not yet sent to the server
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Submit:
   *  1. update API  -> only when ticks were changed on screen: sends the ticked farmer ids of the centre shown
   *  2. get API     -> fills the table below with the saved values
   */
  const submit = async () => {
    if (loading || !vlc) return;
    setLoading(true);
    setError(null);

    let sent: string[] | null = null;
    let updateFailed = false;

    if (dirty && applied) {
      sent = rows.filter((r) => r.synced).map((r) => r.id);
      try {
        await updateSyncMembers(applied, sent);
      } catch (e) {
        updateFailed = true;
        toast(
          e instanceof ApiError
            ? e.message
            : "The Sync/Async status could not be saved.",
          "warn",
        );
      }
    }

    try {
      let list = await getSyncMembers(vlc);
      // The list reply has no recognisable Sync column: keep the ticks the user just saved
      if (sent && !updateFailed && applied === vlc && !list.some((r) => r.flagKnown)) {
        const keep = new Set(sent);
        list = list.map((r) => ({ ...r, synced: keep.has(r.id) }));
      }
      setApplied(vlc);
      setRows(list);
      setDirty(false);

      if (sent && !updateFailed) {
        const ids = sent;
        const savedOn = new Set(list.filter((r) => r.synced).map((r) => r.id));
        const mismatch =
          applied === vlc &&
          list.some((r) => r.flagKnown) &&
          (ids.some((id) => !savedOn.has(id)) ||
            [...savedOn].some((id) => !ids.includes(id)));
        if (mismatch) {
          toast(
            "The server did not save every tick. The table now shows the saved values.",
            "warn",
          );
        } else {
          toast("Sync/Async updated successfully");
        }
      }
    } catch (e) {
      setRows([]);
      setApplied(vlc);
      setDirty(false);
      setError(
        e instanceof ApiError
          ? e.message
          : "The farmer list could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ticking only changes the screen; the server is called when Submit is pressed
  const tick = (ids: string[], on: boolean) => {
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, synced: on } : r)),
    );
    setDirty(true);
  };

  const allOn = rows.length > 0 && rows.every((r) => r.synced);
  const someOn = rows.some((r) => r.synced);

  const columns: Column<SyncMember>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Farmer Id",
        sort: (r) => Number(r.id) || r.id,
        cell: (r) => r.id,
      },
      {
        key: "name",
        header: "Farmer Name",
        sort: (r) => r.name.toLowerCase(),
        cell: (r) => r.name || "—",
      },
      {
        key: "sync",
        align: "center",
        header: (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <span>Sync/Async</span>
            <input
              type="checkbox"
              className={box}
              aria-label="Select all farmers"
              checked={allOn}
              disabled={rows.length === 0 || loading}
              ref={(el) => {
                if (el) el.indeterminate = someOn && !allOn;
              }}
              onChange={(e) =>
                tick(
                  rows.map((r) => r.id),
                  e.target.checked,
                )
              }
            />
          </label>
        ),
        cell: (r) => (
          <input
            type="checkbox"
            className={box}
            aria-label={`Sync farmer ${r.id}`}
            checked={r.synced}
            disabled={loading}
            onChange={(e) => tick([r.id], e.target.checked)}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, allOn, someOn, loading],
  );

  return (
    <ReportPage
      title="Member Sync Async"
      subtitle="Choose the centre and press Submit. Tick the farmers, then press Submit again to save."
    >
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={RefreshCw}>User Info</CardTitle>}
          />
          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Center Name">
              <Select
                value={vlc}
                onChange={(e) => setPicked(e.target.value)}
                disabled={options.length === 0}
              >
                {options.length === 0 && (
                  <option value="">Loading centres…</option>
                )}
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                icon={<Search size={16} />}
                loading={loading}
                disabled={!vlc}
                onClick={() => void submit()}
              >
                Submit
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={applied ? rows.length : 0}
            hideCount={loading}
            disabled
            kinds={[]}
            onExport={() => undefined}
            left={
              dirty ? (
                <span className="text-sm font-semibold text-brand">
                  Ticks changed. Press Submit to save.
                </span>
              ) : undefined
            }
          />
          {loading ? (
            <MilkLoader label="Loading farmers…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => void submit()} />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              pageSize={100}
              empty={
                <p className="px-6 py-10 text-center text-sm text-mute">
                  {applied
                    ? "No farmers found for this centre."
                    : "Choose a centre and press Submit to see its farmers."}
                </p>
              }
            />
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default DpuSyncAsync;