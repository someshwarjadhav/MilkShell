import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileUp,
  Grid3x3,
  RefreshCw,
  Save,
  Search,
  Tags,
} from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field, Input, Select } from "../../components/ui/Fields";
import { ErrorBlock } from "../../components/Widget";
import { RateGridTable } from "../../components/RateGridTable";
import { CardTitle, ReportPage, Reveal } from "../../components/ReportKit";
import { useToast } from "../../context/ToastContext";
import { useCentreOptions } from "../../hooks/useCentres";
import { ApiError } from "../../services/http/errors";
import { todayISO } from "../../lib/format";
import {
  MILK_TYPES,
  emptyGrid,
  getSavedRateList,
  milkLabel,
  saveRateExcel,
  showRate,
  syncAsyncRate,
  toIsoDate,
  updateRate,
  type RateGrid,
  type SavedRate,
} from "../../services/master/rate.api";
import {
  SAMPLE_RATE_URL,
  downloadGrid,
  exportRateFileCsv,
  readRateFile,
  type RateFile,
} from "../../services/master/rate.excel";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const SHIFT_CODE = { morning: "1", evening: "2" } as const;
const SHIFT_DEFAULT = "1";
type ShiftPick = keyof typeof SHIFT_CODE;

const Check: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => (
  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
    <input
      type="checkbox"
      className="h-4 w-4 shrink-0 rounded border-line accent-brand"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    {label}
  </label>
);

const UploadCard: React.FC<{
  chart: RateGrid;
  setChart: (g: RateGrid) => void;
  onSaved: (centreIds: string[]) => void;
}> = ({ chart, setChart, onSaved }) => {
  const toast = useToast();
  const centres = useCentreOptions();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<RateFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(todayISO());
  const [currentRate, setCurrentRate] = useState("0");
  const [milk, setMilk] = useState<Record<string, boolean>>({
    C: false,
    B: false,
    M: false,
  });
  const [shiftWise, setShiftWise] = useState(false);
  const [shiftPick, setShiftPick] = useState<ShiftPick>("morning");
  const [saving, setSaving] = useState(false);

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return t
      ? centres.filter((c) => c.label.toLowerCase().includes(t))
      : centres;
  }, [centres, search]);
  const canSave = MILK_TYPES.some((m) => milk[m.code]);
  const allShown = shown.length > 0 && shown.every((c) => picked.has(c.id));

  const toggleAll = (on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      shown.forEach((c) => (on ? n.add(c.id) : n.delete(c.id)));
      return n;
    });
  const toggleOne = (id: string, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = await readRateFile(f);
      setFile(parsed);
      setFileName(f.name);
      setChart(emptyGrid());
    } catch (e) {
      setFile(null);
      setFileName("");
      setChart(emptyGrid());
      if (fileRef.current) fileRef.current.value = "";
      toast(msg(e, "This file could not be read."), "warn");
    }
  };

  const needFile = () => {
    if (!file) toast("Choose the rate Excel file first", "warn");
    return !!file;
  };

  const show = () => {
    if (needFile() && file) setChart(file.grid);
    else setChart(emptyGrid());
  };

  const download = () => {
    if (!chart.rows.length)
      return toast("There is no rate chart to download", "warn");
    void downloadGrid(chart, `RateChart_${date}`);
  };

  const exportFile = () => {
    if (!chart.rows.length)
      return toast("There is no rate chart to export", "warn");
    exportRateFileCsv(chart, `RateFile_${date}`);
  };

  const saveAll = async () => {
    if (!needFile() || !file || saving) return;
    const types = MILK_TYPES.filter((m) => milk[m.code]).map((m) => m.code);
    if (!picked.size) return toast("Select at least one VLC", "warn");
    if (!types.length) return toast("Select Cow, Buffalo or Mix", "warn");
    if (!date) return toast("Choose the rate effective date", "warn");

    setSaving(true);
    let done = 0;
    const failed: string[] = [];
    const savedCentres = new Set<string>();
    let reason = "";
    for (const id of picked) {
      for (const type of types) {
        try {
          await saveRateExcel({
            stationid: id,
            json: file.json,
            milktype: type,
            shift: shiftWise ? SHIFT_CODE[shiftPick] : SHIFT_DEFAULT,
            effectivedate: date,
            ...(Number(currentRate) > 0 ? { currentrate: currentRate } : {}),
          });
          done++;
          savedCentres.add(id);
        } catch (e) {
          failed.push(`${id}/${type}`);
          reason = msg(e, "The rate chart could not be saved.");
        }
      }
    }
    setSaving(false);
    if (savedCentres.size) onSaved([...savedCentres]);
    if (!failed.length) {
      setFile(null);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      setPicked(new Set());
      setSearch("");
      setDate(todayISO());
      setCurrentRate("0");
      setMilk({ C: false, B: false, M: false });
      setShiftWise(false);
      setShiftPick("morning");
      setChart(emptyGrid());
      toast("Rate Uploaded successfully!");
    } else if (!done) {
      toast("Failed to Upload the Rate", "error", reason);
    } else {
      toast(
        `Rate uploaded for ${done}, failed for ${failed.length}`,
        "error",
        reason,
      );
    }
  };

  return (
    <Card>
      <CardHeader
        title={<CardTitle icon={FileUp}>Excel Rate Upload</CardTitle>}
      />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex min-w-0 flex-1 basis-72 cursor-pointer items-center overflow-hidden rounded-xl border border-line bg-panel text-sm hover:border-brand/50">
            <span className="shrink-0 border-r border-line bg-soft px-3 py-2.5 font-semibold">
              Choose File
            </span>
            <span className="min-w-0 flex-1 truncate px-3 text-mute">
              {fileName || "No file chosen"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
          <p className="text-sm">
            <span className="font-semibold">
              Click Here To Download Sample File{" "}
            </span>
            <a
              href={SAMPLE_RATE_URL}
              download="Rate.xlsx"
              className="font-semibold text-brand underline"
            >
              Download Sample File
            </a>
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_10rem]">
          <div className="max-h-36 overflow-y-scroll rounded-xl border border-line [scrollbar-color:rgb(var(--mute))_rgb(var(--soft))] [scrollbar-width:auto]">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-soft px-3 py-2">
              <input
                type="checkbox"
                aria-label="Select all VLC"
                className="h-4 w-4 accent-brand"
                checked={allShown}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              <span className="text-sm font-bold">Select VLC</span>
              <div className="min-w-0 flex-1">
                <Input
                  icon={<Search size={14} />}
                  className="h-8 text-xs"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ul>
              {shown.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-soft/60">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={picked.has(c.id)}
                      onChange={(e) => toggleOne(c.id, e.target.checked)}
                    />
                    {c.label}
                  </label>
                </li>
              ))}
              {!shown.length && (
                <li className="px-3 py-4 text-center text-xs text-mute">
                  No centre found
                </li>
              )}
            </ul>
          </div>

          <Field label="Rate Effective Date">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Current Rate">
            <Input
              inputMode="decimal"
              className="text-center"
              value={currentRate}
              onChange={(e) =>
                setCurrentRate(e.target.value.replace(/[^\d.]/g, ""))
              }
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-3">
          {MILK_TYPES.map((m) => (
            <Check
              key={m.code}
              label={m.label}
              checked={milk[m.code]}
              onChange={(v) => setMilk((s) => ({ ...s, [m.code]: v }))}
            />
          ))}
          <Check
            label="Shift wise"
            checked={shiftWise}
            onChange={setShiftWise}
          />
          {shiftWise && (
            <div
              className="flex items-center gap-x-8"
              role="radiogroup"
              aria-label="Shift"
            >
              {(Object.keys(SHIFT_CODE) as ShiftPick[]).map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold"
                >
                  <input
                    type="radio"
                    name="rate-shift"
                    className="h-4 w-4 shrink-0 accent-brand"
                    checked={shiftPick === k}
                    onChange={() => setShiftPick(k)}
                  />
                  {k === "morning" ? "Morning" : "Evening"}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button onClick={show}>Show</Button>
          <Button icon={<Download />} onClick={download}>
            Download
          </Button>
          <Button
            icon={<Save />}
            loading={saving}
            disabled={!canSave}
            onClick={() => void saveAll()}
            className="!bg-ok !text-white hover:!opacity-90 disabled:!opacity-50 disabled:hover:!opacity-50"
          >
            Save All
          </Button>
          <Button
            variant="danger"
            icon={<FileSpreadsheet />}
            onClick={exportFile}
          >
            Export Rate File
          </Button>
        </div>
      </div>
    </Card>
  );
};

const ChartCard: React.FC<{ grid: RateGrid }> = ({ grid }) => {
  const ref = useRef<HTMLDivElement>(null);
  const shown = grid.rows.length > 0;
  useEffect(() => {
    if (shown)
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [grid, shown]);
  if (!shown) return null;
  return (
    <div ref={ref}>
      <Card>
        <CardHeader
          title={<CardTitle icon={Grid3x3}>Rate Chart</CardTitle>}
          subtitle="Fat x SNF rate per litre from the chosen Excel file. Darker cell = higher rate."
        />
        <div className="px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
          <RateGridTable grid={grid} />
        </div>
      </Card>
    </div>
  );
};

const CentreSelect: React.FC<{
  centres: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}> = ({ centres, value, onChange }) => (
  <Select value={value} onChange={(e) => onChange(e.target.value)}>
    {centres.map((c) => (
      <option key={c.id} value={c.id}>
        {c.label}
      </option>
    ))}
  </Select>
);

type Action = "update" | null;

const ShowRatesCard: React.FC<{
  savedCentreId: string;
  savedVersion: number;
}> = ({ savedCentreId, savedVersion }) => {
  const toast = useToast();
  const centres = useCentreOptions();
  const first = centres[0]?.id ?? "";

  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState("1");
  const [list, setList] = useState<SavedRate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [milk, setMilk] = useState("");
  const [rangeType, setRangeType] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const [grid, setGrid] = useState<RateGrid>(emptyGrid);
  const [showing, setShowing] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const [gridNote, setGridNote] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [working, setWorking] = useState(false);
  const [synced, setSynced] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!source && first) setSource(first);
    if (!target && first) setTarget(first);
  }, [first, source, target]);

  useEffect(() => {
    if (savedCentreId) setSource(savedCentreId);
  }, [savedCentreId]);

  useEffect(() => {
    if (!source) return;
    let alive = true;
    setLoadingList(true);
    setListError(null);
    setGrid(emptyGrid());
    setGridNote(null);
    getSavedRateList(source, status)
      .then((rows) => {
        if (!alive) return;
        setList(rows);
        const firstMilk = rows[0]?.milkType ?? "";
        setMilk(firstMilk);
        setRangeType(
          rows.find((r) => r.milkType === firstMilk)?.rangeType ?? "",
        );
      })
      .catch((e) => {
        if (!alive) return;
        setList([]);
        setMilk("");
        setRangeType("");
        setListError(msg(e, "The saved rates could not be loaded."));
      })
      .finally(() => alive && setLoadingList(false));
    return () => {
      alive = false;
    };
  }, [source, status, tick, savedVersion]);

  const milkOptions = useMemo(
    () => [...new Set(list.map((r) => r.milkType))],
    [list],
  );
  const dateOptions = useMemo(
    () => list.filter((r) => r.milkType === milk),
    [list, milk],
  );
  const chosen = dateOptions.find((r) => r.rangeType === rangeType);

  const pickMilk = (m: string) => {
    setMilk(m);
    setRangeType(list.find((r) => r.milkType === m)?.rangeType ?? "");
    setGrid(emptyGrid());
    setGridNote(null);
  };

  const show = useCallback(async () => {
    if (!chosen) return toast("Choose a milk type and a rate date", "warn");
    setShowing(true);
    setGridNote(null);
    try {
      const g = await showRate(
        source,
        toIsoDate(chosen.date),
        chosen.milkType,
        chosen.rangeType,
      );
      setGrid(g);
      if (!g.rows.length)
        setGridNote("No rate chart was returned for this selection.");
    } catch (e) {
      setGrid(emptyGrid());
      setGridNote(msg(e, "The rate chart could not be loaded."));
    } finally {
      setShowing(false);
    }
  }, [chosen, source, toast]);

  const needChosen = (): boolean => {
    if (!chosen) toast("Choose a milk type and a rate date", "warn");
    return !!chosen;
  };

  const askUpdate = () => {
    if (!needChosen()) return;
    if (!target) return toast("Choose the target center", "warn");
    if (!from || !to || from > to)
      return toast("From Date must not be after To Date", "warn");
    setAction("update");
  };

  const runUpdate = async () => {
    if (!chosen) return;
    setWorking(true);
    try {
      const reply = await updateRate({
        vlccid: target,
        rateDate: toIsoDate(chosen.date),
        type: chosen.milkType,
        rateid: chosen.rangeType,
        fromdate: from,
        todate: to,
      });
      void reply;
      toast("Updated successfully");
      setAction(null);
    } catch (e) {
      toast(
        "Failed to Update the Rate",
        "error",
        msg(e, "The collection rate could not be updated."),
      );
    } finally {
      setWorking(false);
    }
  };

  const syncKey = chosen
    ? `${source}|${chosen.milkType}|${chosen.rangeType}`
    : "";
  const isSynced = !!synced[syncKey];

  const toggleSync = async (sync: boolean) => {
    if (!chosen || syncing) return;
    setSyncing(true);
    setSynced((s) => ({ ...s, [syncKey]: sync }));
    try {
      await syncAsyncRate({
        status: sync ? "1" : "0",
        villageid: source,
        rateid: chosen.rangeType,
        type: chosen.milkType,
      });
      toast(sync ? "Rate synced successfully" : "Rate asynced successfully");
    } catch (e) {
      setSynced((s) => ({ ...s, [syncKey]: !sync }));
      toast(
        sync ? "Failed to Sync the Rate" : "Failed to Async the Rate",
        "error",
        msg(e, "The rate could not be synced."),
      );
    } finally {
      setSyncing(false);
    }
  };

  const download = () => {
    if (!grid.rows.length) return toast("Press Show first", "warn");
    void downloadGrid(
      grid,
      `Rate_${source}_${chosen?.milkType ?? ""}_${chosen ? toIsoDate(chosen.date) : ""}`,
    );
  };

  useEffect(() => {
    if (grid.rows.length)
      chartRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [grid]);

  const busy = loadingList || showing;
  const centreLabel = (id: string) =>
    centres.find((c) => c.id === id)?.label ?? id;

  return (
    <Card>
      <CardHeader title={<CardTitle icon={Tags}>Show Rates</CardTitle>} />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <Field label="Source Center">
            <CentreSelect
              centres={centres}
              value={source}
              onChange={setSource}
            />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </Select>
          </Field>
          <Field label="Date">
            <Select
              value={rangeType}
              disabled={!dateOptions.length}
              onChange={(e) => {
                setRangeType(e.target.value);
                setGrid(emptyGrid());
                setGridNote(null);
              }}
            >
              {!dateOptions.length && <option value="" />}
              {dateOptions.map((r) => (
                <option key={r.rangeType} value={r.rangeType}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Milk Type">
            <Select
              value={milk}
              disabled={!milkOptions.length}
              onChange={(e) => pickMilk(e.target.value)}
            >
              {!milkOptions.length && <option value="" />}
              {milkOptions.map((m) => (
                <option key={m} value={m}>
                  {milkLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-2.5">
            <Check
              label="Rate Synced"
              checked={isSynced}
              disabled={!chosen || busy || syncing}
              onChange={(v) => void toggleSync(v)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Target Center">
            <CentreSelect
              centres={centres}
              value={target}
              onChange={setTarget}
            />
          </Field>
          <Field label="From Date">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To Date">
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>

        {listError && (
          <ErrorBlock
            compact
            message={listError}
            onRetry={() => setTick((t) => t + 1)}
          />
        )}
        {!listError && !loadingList && source && !list.length && (
          <p className="text-sm text-mute">
            No {status === "1" ? "active" : "inactive"} rate is saved for this
            centre.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            loading={showing}
            disabled={busy || !chosen}
            onClick={() => void show()}
          >
            Show
          </Button>
          <Button
            icon={<Download />}
            disabled={!grid.rows.length}
            onClick={download}
          >
            Download Excel
          </Button>
          <Button
            disabled={busy || !chosen}
            onClick={askUpdate}
            className="!bg-ok !text-white hover:!opacity-90 disabled:!opacity-50 disabled:hover:!opacity-50"
          >
            Update
          </Button>
          <Button
            variant="danger"
            icon={<RefreshCw />}
            loading={syncing}
            disabled={busy || !chosen || syncing}
            onClick={() => void toggleSync(isSynced)}
          >
            Sync/Async Rate
          </Button>
        </div>

        {gridNote && <p className="text-sm text-mute">{gridNote}</p>}
        {showing && (
          <div
            className="h-48 animate-pulse rounded-2xl bg-soft"
            aria-label="Loading rate chart"
          />
        )}
        {!showing && grid.rows.length > 0 && (
          <div
            ref={chartRef}
            className="space-y-3 rounded-2xl border border-line bg-soft/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-base font-bold">
                Rate Chart
                {chosen && (
                  <span className="ml-2 text-sm font-semibold text-mute">
                    {centreLabel(source)} · {milkLabel(chosen.milkType)} ·{" "}
                    {chosen.label}
                  </span>
                )}
              </p>
            </div>
            <RateGridTable grid={grid} />
          </div>
        )}
      </div>

      <Modal
        open={action === "update"}
        onClose={() => !working && setAction(null)}
        title="Update collection rate?"
        subtitle="Collections already saved in this period are recalculated with this rate chart."
        footer={
          <>
            <Button
              variant="outline"
              disabled={working}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>
            <Button loading={working} onClick={() => void runUpdate()}>
              Update
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-mute">Rate</dt>
          <dd className="font-semibold">
            {chosen ? `${milkLabel(chosen.milkType)} · ${chosen.label}` : ""}
          </dd>
          <dt className="text-mute">Target center</dt>
          <dd className="font-semibold">{centreLabel(target)}</dd>
          <dt className="text-mute">Period</dt>
          <dd className="font-semibold">
            {from} to {to}
          </dd>
        </dl>
      </Modal>
    </Card>
  );
};

const RateMaster: React.FC = () => {
  const [chart, setChart] = useState<RateGrid>(emptyGrid);
  const [savedCentreId, setSavedCentreId] = useState("");
  const [savedVersion, setSavedVersion] = useState(0);
  return (
    <ReportPage title="Rate Master">
      <Reveal delay={0.05}>
        <UploadCard
          chart={chart}
          setChart={setChart}
          onSaved={(centreIds) => {
            setSavedCentreId(centreIds[0] ?? "");
            setSavedVersion((version) => version + 1);
          }}
        />
      </Reveal>
      <Reveal delay={0.08}>
        <ChartCard grid={chart} />
      </Reveal>
      <Reveal delay={0.1}>
        <ShowRatesCard
          savedCentreId={savedCentreId}
          savedVersion={savedVersion}
        />
      </Reveal>
    </ReportPage>
  );
};

export default RateMaster;
