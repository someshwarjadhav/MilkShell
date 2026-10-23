import type * as React from "react";
import { useMemo, useRef, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Field, Input, Segmented, Select } from "../../components/ui/Fields";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatCard } from "../../components/ui/StatCard";
import { KindChip } from "../../components/KindChip";
import { QueryBoundary } from "../../components/Widget";
import { MilkLoader } from "../../components/MilkLoader";
import { nf, todayISO } from "../../lib/format";
import { exportCSV, exportExcel, exportPDF, type ExportCol } from "../../lib/export";
import { ReportBar, ReportDataBadge, ReportPage } from "../../components/ReportKit";
import { GLOBALLABELS, GLOBALSMILK, GLOBALSSHIFT, DEFAULT_PAGE_SIZE, DEFAULT_MILK, DEFAULT_SHIFT, SHIFT_MORNING } from "../../lib/global";
import {
  farmerTotals,
  mapFarmers,
  type FarmerRow,
} from "../../services/mappers/farmer.mapper";
import {
  mapVlcc,
  totalsOf,
  type VlccRow,
} from "../../services/mappers/vlcc.mapper";
import {
  fetchFarmerCollection,
} from "../../services/farmer/farmer.api";
import { fetchVlccCollection } from "../../services/vlcc/vlcc.api";
import { vlccOption, vlccTitle } from "../../services/vlcc/names";
import type {
  MilkCode,
  RawFarmerRow,
  RawVlccRow,
  ShiftCode,
} from "../../services/types/raw";
import { useQuery } from "../../hooks/useQuery";
import { useFarmerMaster, useFarmersOf } from "../../hooks/useSmartxData";
import { ALL_CENTRES, useCentreIds, useFirstCentre } from "../../hooks/useCentres";
import { CentreField, PlantMccField, SubmitButton } from "../../components/ReportFilters";
import { useReportColumns } from "../../hooks/useSessionData";
import { Droplets, FlaskConical, IndianRupee, Users } from "lucide-react";

export type View = "vlcc" | "farmer" | "entry";
interface Applied {
  farmer: string;
  from: string;
  to: string;
  shift: ShiftCode;
  milk: MilkCode;
  vlcc: string;
  ids: string[];
}

interface FarmerwiseRow {
  key: string;
  farmerId: string;
  name: string;
  vlccid: string;
  samples: number;
  liter: number;
  kg: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
}
const sameFarmerId = (a: string, b: string) => a === b || (a.replace(/^0+/, "") !== "" && a.replace(/^0+/, "") === b.replace(/^0+/, ""));

const FARMER_COL_NAMES: Record<string, string[]> = {
  fid: ["farmerid", "farmercode", "farmerno"],
  name: ["farmername", "name"],
  centre: ["centre", "center", "vlc", "vlccid", "vlccname", "centrevlc"],
  sample: ["sampleno", "sample", "samplenumber"],
  time: ["time", "sampletime"],
  milk: ["milktype", "milk"],
  liter: ["liter", "litre", "qty", "quantity"],
  kg: ["kg", "weight"],
  fat: ["fat"],
  snf: ["snf"],
  clr: ["clr"],
  water: ["water"],
  rate: ["rate", "rtpl"],
  amt: ["amount", "amt", "totalamount"],
  village: ["village", "villagename", "villageagentaddress"],
  date: ["trdate", "date"],
  shift: ["shift"],
};

const PAGE_TEXT: Record<View, { title: string; subtitle: string }> = {
  vlcc: { title: "Vlcc Collection", subtitle: "Milk collected per VLC centre for the chosen dates, shift and milk type." },
  farmer: { title: "Farmer Collection", subtitle: "Every farmer sample collected at the selected centre." },
  entry: { title: "Farmerwise Collection", subtitle: "Farmer by farmer totals of the milk poured at the selected centre." },
};

const Collections: React.FC<{ only?: View }> = ({ only }) => {
  const toast = useToast();
  const today = todayISO();

  const firstCentre = useFirstCentre();
  const allIds = useCentreIds();

  const farmerAccess = useReportColumns("farmercollection");

  const [vlcc, setVlcc] = useState(only === "entry" ? firstCentre : ALL_CENTRES);
  const [farmer, setFarmer] = useState("");
  const [milk, setMilk] = useState<MilkCode>(DEFAULT_MILK);
  const [shift, setShift] = useState<ShiftCode>(DEFAULT_SHIFT);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>(only ?? "vlcc");
  const [applied, setApplied] = useState<Applied>({
    farmer: "",
    from: today,
    to: today,
    shift: DEFAULT_SHIFT,
    milk: DEFAULT_MILK,
    vlcc: "",
    ids: [],
  });
  const resultsRef = useRef<HTMLDivElement>(null);

  const hasAppliedCentre = applied.ids.length > 0;
  const ids = applied.ids;
  const key = `${applied.from}:${applied.to}:${applied.shift}:${applied.milk}:${ids.join(",")}`;
  const params = {
    from: applied.from,
    to: applied.to,
    shift: applied.shift,
    milk: applied.milk,
    vlccIds: ids,
  };

  const vlccQ = useQuery<RawVlccRow>(
    view === "vlcc" && hasAppliedCentre ? `vlccpage:${key}` : null,
    (emit) => fetchVlccCollection(params, emit),
  );

  const farmerQ = useQuery<RawFarmerRow>(
    hasAppliedCentre && view !== "vlcc"
      ? `farmerpage:${key}`
      : null,
    (emit) => fetchFarmerCollection(params, emit),
  );
  const active = view === "vlcc" ? vlccQ : farmerQ;

  const search = () => {
    const picked = vlcc === ALL_CENTRES ? allIds : [vlcc];
    if (!vlcc || !picked.length) return;
    setApplied({
      farmer,
      from,
      to,
      shift,
      milk,
      vlcc,
      ids: picked,
    });

    window.setTimeout(() => {
      const top = resultsRef.current?.getBoundingClientRect().top;
      if (top !== undefined && top > window.innerHeight * 0.55) {
        window.scrollBy({ top: top - 140, behavior: "smooth" });
      }
    }, 60);
  };
  const reset = () => {
    setVlcc(view === "entry" ? firstCentre : ALL_CENTRES);
    setFarmer("");
    setMilk(DEFAULT_MILK);
    setShift(DEFAULT_SHIFT);
    setFrom(today);
    setTo(today);
    setQ("");
    setApplied({
      farmer: "",
      from: today,
      to: today,
      shift: DEFAULT_SHIFT,
      milk: DEFAULT_MILK,
      vlcc: "",
      ids: [],
    });
  };

  const needle = q.trim().toLowerCase();
  const vlccRows = useMemo(
    () =>
      mapVlcc(vlccQ.rows).filter(
        (r) =>
          !needle ||
          r.village.toLowerCase().includes(needle) ||
          r.vlccid.includes(needle),
      ),
    [vlccQ.rows, needle],
  );

  const master = useFarmerMaster(view !== "vlcc");
  const farmers = useFarmersOf(vlcc === ALL_CENTRES ? "" : vlcc, view === "entry");
  const masterNames = useMemo(
    () =>
      new Map(
        master.rows
          .filter((m) => m.name)
          .map((m) => [`${m.vlccid}:${m.farmerId}`, m.name]),
      ),
    [master.rows],
  );
  const farmerRows = useMemo(
    () =>
      mapFarmers(farmerQ.rows)
        .map((r) =>
          r.farmerName.startsWith("Farmer #") && masterNames.has(r.farmerKey)
            ? { ...r, farmerName: masterNames.get(r.farmerKey)! }
            : r,
        )
        .filter((r) => view !== "entry" || !applied.farmer || sameFarmerId(r.farmerId, applied.farmer))
        .filter(
          (r) =>
            !needle ||
            r.farmerName.toLowerCase().includes(needle) ||
            r.farmerId.includes(needle),
        ),
    [farmerQ.rows, needle, masterNames, view, applied.farmer],
  );

  const farmerwiseAll = useMemo<FarmerwiseRow[]>(() => {
    const by = new Map<string, FarmerwiseRow & { fw: number; sw: number }>();
    for (const r of farmerRows) {
      const b = by.get(r.farmerKey) ?? {
        key: r.farmerKey,
        farmerId: r.farmerId,
        name: r.farmerName,
        vlccid: r.vlccid,
        samples: 0,
        liter: 0,
        kg: 0,
        fat: 0,
        snf: 0,
        rate: 0,
        amount: 0,
        fw: 0,
        sw: 0,
      };
      b.samples += 1;
      b.liter += r.liter;
      b.kg += r.kg;
      b.amount += r.amount;
      b.fw += r.liter * r.fat;
      b.sw += r.liter * r.snf;
      if (!b.name.startsWith("Farmer #") || r.farmerName.startsWith("Farmer #"))
        b.name = b.name || r.farmerName;
      else b.name = r.farmerName;
      by.set(r.farmerKey, b);
    }
    return [...by.values()]
      .map((b) => ({
        ...b,
        fat: b.liter ? b.fw / b.liter : 0,
        snf: b.liter ? b.sw / b.liter : 0,
        rate: b.liter ? b.amount / b.liter : 0,
      }))
      .sort((a, b) => b.liter - a.liter);
  }, [farmerRows]);
  const farmerwise = useMemo(
    () =>
      farmerwiseAll.filter(
        (r) =>
          !needle ||
          r.name.toLowerCase().includes(needle) ||
          r.farmerId.includes(needle) ||
          vlccTitle(r.vlccid).toLowerCase().includes(needle),
      ),
    [farmerwiseAll, needle],
  );

  const vt = useMemo(() => totalsOf(vlccRows), [vlccRows]);
  const ft = useMemo(() => farmerTotals(farmerRows), [farmerRows]);
  const sum =
    view === "vlcc"
      ? {
          liter: vt.liter,
          kg: vt.kg,
          avgFat: vt.avgFat,
          amount: vt.amount,
          count: vt.count,
          farmers: undefined as number | undefined,
          vlcs: vt.vlcCount,
        }
      : view === "farmer"
        ? {
            liter: ft.liter,
            kg: ft.kg,
            avgFat: ft.avgFat,
            amount: ft.amount,
            count: ft.count,
            farmers: ft.farmers,
            vlcs: undefined as number | undefined,
          }
        : {
            liter: ft.liter,
            kg: ft.kg,
            avgFat: ft.avgFat,
            amount: ft.amount,
            count: farmerwise.length,
            farmers: ft.farmers,
            vlcs: undefined as number | undefined,
          };
  const loading =
    active.status === "loading" ||
    (active.fetching && active.rows.length === 0);

  const loaderLabel =
    view === "vlcc"
      ? "Loading VLC collection…"
      : view === "farmer"
        ? "Loading farmer collection…"
        : "Loading farmerwise collection…";

  const vlccCols: Column<VlccRow>[] = [
    {
      key: "village",
      header: "Village",
      sort: (r) => r.village,
      cell: (r) => (
        <span className="font-semibold">{vlccTitle(r.vlccid, r.village)}</span>
      ),
    },
    { key: "date", header: "Date", cell: (r) => r.date },
    {
      key: "liter",
      header: "Liter",
      align: "right",
      sort: (r) => r.liter,
      cell: (r) => r.liter.toFixed(2),
    },
    {
      key: "kg",
      header: "Kg",
      align: "right",
      sort: (r) => r.kg,
      cell: (r) => r.kg.toFixed(2),
    },
    {
      key: "fat",
      header: "Fat",
      align: "right",
      sort: (r) => r.fat,
      cell: (r) => r.fat.toFixed(1),
    },
    {
      key: "snf",
      header: "SNF",
      align: "right",
      sort: (r) => r.snf,
      cell: (r) => r.snf.toFixed(1),
    },
    {
      key: "clr",
      header: "CLR",
      align: "right",
      sort: (r) => r.clr,
      cell: (r) => r.clr.toFixed(1),
    },
    {
      key: "milk",
      header: "Milk Type",
      cell: (r) => <KindChip kind={r.milk} label={r.milkLabel} />,
    },
    {
      key: "shift",
      header: "Shift",
      cell: (r) => (
        <Badge tone={r.shift === SHIFT_MORNING ? "warn" : "brand"}>
          {r.shift ?? r.shiftLabel}
        </Badge>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      sort: (r) => r.rate,
      cell: (r) => r.rate.toFixed(2),
    },
    {
      key: "amt",
      header: "Amount",
      align: "right",
      sort: (r) => r.amount,
      cell: (r) => <span className="font-bold">{nf(r.amount, 2)}</span>,
    },
  ];

  const farmerColsAll: Column<FarmerRow>[] = [
    {
      key: "fid",
      header: "Farmer Id",
      sort: (r) => r.farmerId.padStart(8, "0"),
      cell: (r) => r.farmerId,
    },
    {
      key: "name",
      header: "Farmer Name",
      sort: (r) => r.farmerName,
      cell: (r) => <span className="font-semibold">{r.farmerName}</span>,
    },
    {
      key: "centre",
      header: "Centre (VLC)",
      sort: (r) => vlccOption(r.vlccid),
      cell: (r) => vlccOption(r.vlccid),
    },
    { key: "date", header: "Date", sort: (r) => r.date, cell: (r) => r.date },
    {
      key: "shift",
      header: "Shift",
      cell: (r) =>
        r.shift ? (
          <Badge tone={r.shift === SHIFT_MORNING ? "warn" : "brand"}>
            {r.shift}
          </Badge>
        ) : (
          ""
        ),
    },
    {
      key: "sample",
      header: "Sample No",
      sort: (r) => Number(r.sampleNo) || 0,
      cell: (r) => r.sampleNo,
    },
    { key: "time", header: "Time", cell: (r) => r.time },
    {
      key: "milk",
      header: "Milk Type",
      cell: (r) => <KindChip kind={r.milk} label={r.milkLabel} />,
    },
    {
      key: "liter",
      header: "Liter",
      align: "right",
      sort: (r) => r.liter,
      cell: (r) => r.liter.toFixed(2),
    },
    {
      key: "kg",
      header: "Kg",
      align: "right",
      sort: (r) => r.kg,
      cell: (r) => r.kg.toFixed(2),
    },
    {
      key: "fat",
      header: "Fat",
      align: "right",
      sort: (r) => r.fat,
      cell: (r) => r.fat.toFixed(1),
    },
    {
      key: "snf",
      header: "SNF",
      align: "right",
      sort: (r) => r.snf,
      cell: (r) => r.snf.toFixed(1),
    },
    {
      key: "clr",
      header: "CLR",
      align: "right",
      sort: (r) => r.clr,
      cell: (r) => r.clr.toFixed(1),
    },
    {
      key: "water",
      header: "Water",
      align: "right",
      sort: (r) => r.water,
      cell: (r) => r.water.toFixed(2),
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      sort: (r) => r.rate,
      cell: (r) => r.rate.toFixed(2),
    },
    {
      key: "amt",
      header: "Amount",
      align: "right",
      sort: (r) => r.amount,
      cell: (r) => <span className="font-bold">{nf(r.amount, 2)}</span>,
    },
    {
      key: "village",
      header: "Village",
      sort: (r) => r.village,
      cell: (r) => r.village,
    },
  ];

  const farmerCols = farmerAccess.arrange(
    farmerColsAll,
    (c) => c.key,
    FARMER_COL_NAMES,
  );

  const farmerwiseCols: Column<FarmerwiseRow>[] = [
    {
      key: "fid",
      header: "Farmer Id",
      sort: (r) => r.farmerId.padStart(8, "0"),
      cell: (r) => r.farmerId,
    },
    {
      key: "name",
      header: "Farmer Name",
      sort: (r) => r.name,
      cell: (r) => <span className="font-semibold">{r.name}</span>,
    },
    {
      key: "centre",
      header: "Centre (VLC)",
      sort: (r) => vlccOption(r.vlccid),
      cell: (r) => vlccOption(r.vlccid),
    },
    {
      key: "n",
      header: "Samples",
      align: "right",
      sort: (r) => r.samples,
      cell: (r) => r.samples,
    },
    {
      key: "liter",
      header: "Liter",
      align: "right",
      sort: (r) => r.liter,
      cell: (r) => <span className="font-bold">{r.liter.toFixed(2)}</span>,
    },
    {
      key: "kg",
      header: "Kg",
      align: "right",
      sort: (r) => r.kg,
      cell: (r) => r.kg.toFixed(2),
    },
    {
      key: "fat",
      header: "Avg Fat",
      align: "right",
      sort: (r) => r.fat,
      cell: (r) => r.fat.toFixed(2),
    },
    {
      key: "snf",
      header: "Avg SNF",
      align: "right",
      sort: (r) => r.snf,
      cell: (r) => r.snf.toFixed(2),
    },
    {
      key: "rate",
      header: "Avg Rate",
      align: "right",
      sort: (r) => r.rate,
      cell: (r) => r.rate.toFixed(2),
    },
    {
      key: "amt",
      header: "Amount",
      align: "right",
      sort: (r) => r.amount,
      cell: (r) => <span className="font-bold">{nf(r.amount, 2)}</span>,
    },
  ];
  const farmerwiseExport: ExportCol<FarmerwiseRow>[] = [
    { header: "Farmer Id", value: (r) => r.farmerId },
    { header: "Farmer Name", value: (r) => r.name },
    { header: "Centre", value: (r) => vlccTitle(r.vlccid) },
    { header: "VLC Id", value: (r) => r.vlccid },
    { header: "Samples", value: (r) => r.samples },
    { header: "Liter", value: (r) => r.liter },
    { header: "Kg", value: (r) => r.kg },
    { header: "Avg Fat", value: (r) => r.fat },
    { header: "Avg SNF", value: (r) => r.snf },
    { header: "Avg Rate", value: (r) => r.rate },
    { header: "Amount", value: (r) => r.amount },
  ];

  const vlccExport: ExportCol<VlccRow>[] = [
    { header: "Village", value: (r) => r.village },
    { header: "Date", value: (r) => r.date },
    { header: "Liter", value: (r) => r.liter },
    { header: "Kg", value: (r) => r.kg },
    { header: "Fat", value: (r) => r.fat },
    { header: "SNF", value: (r) => r.snf },
    { header: "CLR", value: (r) => r.clr },
    { header: "Milk Type", value: (r) => r.milkLabel },
    { header: "Shift", value: (r) => r.shiftLabel },
    { header: "Rate", value: (r) => r.rate },
    { header: "Amount", value: (r) => r.amount },
  ];
  const farmerExportAll: Array<ExportCol<FarmerRow> & { key: string }> = [
    { key: "fid", header: "Farmer Id", value: (r) => r.farmerId },
    { key: "name", header: "Farmer Name", value: (r) => r.farmerName },
    { key: "centre", header: "Centre", value: (r) => vlccTitle(r.vlccid) },
    { key: "sample", header: "Sample No", value: (r) => r.sampleNo },
    { key: "date", header: "Date", value: (r) => r.date },
    { key: "shift", header: "Shift", value: (r) => r.shift ?? "" },
    { key: "time", header: "Time", value: (r) => r.time },
    { key: "milk", header: "Milk Type", value: (r) => r.milkLabel },
    { key: "liter", header: "Liter", value: (r) => r.liter },
    { key: "kg", header: "Kg", value: (r) => r.kg },
    { key: "fat", header: "Fat", value: (r) => r.fat },
    { key: "snf", header: "SNF", value: (r) => r.snf },
    { key: "clr", header: "CLR", value: (r) => r.clr },
    { key: "water", header: "Water", value: (r) => r.water },
    { key: "rate", header: "Rate", value: (r) => r.rate },
    { key: "amt", header: "Amount", value: (r) => r.amount },
    { key: "village", header: "Village", value: (r) => r.village },
  ];

  const farmerExport = farmerAccess.arrange(
    farmerExportAll,
    (c) => c.key,
    FARMER_COL_NAMES,
  );

  const name = `${view === "vlcc" ? "vlc-collection" : view === "farmer" ? "farmer-collection" : "farmerwise-collection"}-${applied.from}-to-${applied.to}`;
  const run = (kind: "csv" | "xls" | "pdf") => {
    const meta: Array<[string, string]> = [
      ["Centre", applied.vlcc === ALL_CENTRES ? GLOBALLABELS.allCentres : vlccTitle(applied.vlcc)],
      ["Milk", GLOBALSMILK.milkOptions.find((m) => m.Id === applied.milk)?.Name ?? applied.milk],
      ["Shift", GLOBALSSHIFT.shiftOptions.find((s) => s.Id === applied.shift)?.Name ?? applied.shift],
      ["From", applied.from],
      ["To", applied.to],
    ];
    const summary = [
      { label: "Records", value: nf(sum.count) },
      { label: "Total litres", value: nf(sum.liter, 2) },
      { label: "Total kg", value: nf(sum.kg, 2) },
      { label: "Amount", value: `₹ ${nf(sum.amount, 2)}` },
    ];
    const note = "Report rows are loaded from the SmartX portal using the selected report tab and filters.";
    if (kind === "pdf") {
      const options = { subtitle: `${applied.from} to ${applied.to}`, meta, summary, note };
      if (view === "vlcc") exportPDF(name, vlccExport, vlccRows, options);
      else if (view === "farmer") exportPDF(name, farmerExport, farmerRows, options);
      else exportPDF(name, farmerwiseExport, farmerwise, options);
      toast("Print dialog opened — choose Save as PDF to download");
      return;
    }
    if (view === "vlcc") {
      if (kind === "csv") exportCSV(name, vlccExport, vlccRows);
      else exportExcel(name, vlccExport, vlccRows);
    } else if (view === "farmer") {
      if (kind === "csv") exportCSV(name, farmerExport, farmerRows);
      else exportExcel(name, farmerExport, farmerRows);
    } else if (kind === "csv") exportCSV(name, farmerwiseExport, farmerwise);
    else exportExcel(name, farmerwiseExport, farmerwise);
    toast(`${kind.toUpperCase()} file downloaded`);
  };

  const err = active.status === "error";
  const statError = err ? active.error?.message : undefined;

  return (
    <ReportPage
      title={only ? PAGE_TEXT[only].title : "Farmer Collection"}
      subtitle={only ? PAGE_TEXT[only].subtitle : "Milk collected at your VLCs, totals per centre, every farmer sample, or the farmerwise entries."}
    >

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total litres"
          value={sum.liter}
          decimals={1}
          icon={<Droplets size={18} />}
          tone="text-brand"
          hint={`${nf(sum.kg, 1)} kg`}
          loading={loading}
          error={statError}
          onRetry={active.retry}
          idle={!hasAppliedCentre}
          compact
        />
        <StatCard
          label="Average fat"
          value={sum.avgFat}
          decimals={2}
          suffix="%"
          icon={<FlaskConical size={18} />}
          tone="text-cow"
          loading={loading}
          error={statError}
          onRetry={active.retry}
          hint="Weighted by litres"
          idle={!hasAppliedCentre}
          compact
        />
        {view !== "vlcc" ? (
          <StatCard
            label="Farmers"
            value={sum.farmers ?? 0}
            icon={<Users size={18} />}
            tone="text-goat"
            hint={`${sum.count} samples`}
            loading={loading}
            error={statError}
            onRetry={active.retry}
            idle={!hasAppliedCentre}
            compact
          />
        ) : (
          <StatCard
            label="VLC / centres"
            value={sum.vlcs ?? 0}
            icon={<Users size={18} />}
            tone="text-goat"
            hint={`${sum.count} records`}
            loading={loading}
            error={statError}
            onRetry={active.retry}
            idle={!hasAppliedCentre}
            compact
          />
        )}
        <StatCard
          label="Amount"
          value={sum.amount}
          prefix="₹"
          icon={<IndianRupee size={18} />}
          tone="text-buffalo"
          loading={loading}
          error={statError}
          onRetry={active.retry}
          idle={!hasAppliedCentre}
          compact
        />
      </div>

      <Card>
        <CardHeader
          title="User Info"
          action={
            <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={reset}>
              Reset
            </Button>
          }
        />
        <div className="grid gap-x-4 gap-y-3 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:grid-cols-2 lg:grid-cols-12">
          {view !== "vlcc" && <PlantMccField className={view === "entry" ? "lg:col-span-4" : "lg:col-span-3"} />}
          <CentreField
            className={view === "vlcc" ? "lg:col-span-6" : view === "entry" ? "lg:col-span-4" : "lg:col-span-3"}
            value={vlcc}
            allValue={view === "entry" ? undefined : ALL_CENTRES}
            onChange={(id) => {
              setVlcc(id);
              setFarmer("");
            }}
          />
          {view === "entry" && (
            <Field label={GLOBALLABELS.farmerName} className="lg:col-span-4">
              <Select value={farmer} onChange={(e) => setFarmer(e.target.value)}>
                <option value="">{GLOBALLABELS.allFarmers}</option>
                {farmers.rows.map((m) => (
                  <option key={m.farmerId} value={m.farmerId}>
                    {m.name ? `${m.farmerId} | ${m.name}` : m.farmerId}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={GLOBALLABELS.milkType} className="lg:col-span-3">
            <Select value={milk} onChange={(e) => setMilk(e.target.value as MilkCode)}>
              {GLOBALSMILK.milkOptions.map((m) => (
                <option key={m.Id} value={m.Id}>
                  {m.Name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={GLOBALLABELS.shift} className="lg:col-span-3">
            <Select value={shift} onChange={(e) => setShift(e.target.value as ShiftCode)}>
              {GLOBALSSHIFT.shiftOptions.map((m) => (
                <option key={m.Id} value={m.Id}>
                  {m.Name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={GLOBALLABELS.fromDate} className="lg:col-span-3">
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={GLOBALLABELS.toDate} className="lg:col-span-3">
            <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <SubmitButton
            className={view === "entry" ? "sm:col-span-2 lg:col-span-12" : "sm:col-span-2 lg:col-span-6"}
            disabled={!vlcc}
            loading={active.fetching && active.rows.length === 0}
            onClick={search}
          />
        </div>
      </Card>

      <div ref={resultsRef}>
      <Card>
        <ReportBar
          count={sum.count}
          hideCount={loading || err}
          disabled={loading || err || sum.count === 0}
          kinds={["xls", "csv", "pdf"]}
          onExport={run}
          left={
            <>
              {!only && (
                <div className="max-w-full overflow-x-auto">
                  <Segmented
                    value={view}
                    onChange={setView}
                    options={[
                      { value: "vlcc", label: "VLC collection" },
                      { value: "farmer", label: "Farmer collection" },
                      { value: "entry", label: "Farmerwise collection" },
                    ]}
                  />
                </div>
              )}
              <div className="w-56 max-w-full">
                <Input icon={<Search size={16} />} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </>
          }
          source={<ReportDataBadge state={{ fetching: active.fetching, stale: active.stale, updatedAt: active.updatedAt, failed: active.failed, total: active.total, error: active.error, hasData: active.rows.length > 0 }} />}
        />
        {!hasAppliedCentre ? (
          <p className="px-6 py-8 text-center text-sm text-mute">
            Select a centre and press Submit to load its collection.
          </p>
        ) : loading ? (
          <MilkLoader label={loaderLabel} />
        ) : (
          <QueryBoundary
            q={active}
            skeleton={<MilkLoader label={loaderLabel} />}
            emptyTitle="No record for these filters"
            emptyHint="The portal says there is no collection for this date, shift and milk type."
          >
            {view === "vlcc" ? (
              <DataTable
                columns={vlccCols}
                rows={vlccRows}
                rowKey={(r) => r.key}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            ) : view === "farmer" ? (
              <DataTable
                columns={farmerCols}
                rows={farmerRows}
                rowKey={(r) => r.key}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            ) : (
              <DataTable
                columns={farmerwiseCols}
                rows={farmerwise}
                rowKey={(r) => r.key}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            )}
          </QueryBoundary>
        )}
      </Card>
      </div>
    </ReportPage>
  );
};

export default Collections;
