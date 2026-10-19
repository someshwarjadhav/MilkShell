import type * as React from "react";
import { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Search,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Field, Input, Segmented, Select } from "../components/ui/Fields";
import { DataTable, type Column } from "../components/ui/DataTable";
import { StatCard } from "../components/ui/StatCard";
import { PageHeader } from "../components/ui/PageHeader";
import { KindChip } from "../components/KindChip";
import { QueryBoundary } from "../components/Widget";
import { MilkLoader } from "../components/MilkLoader";
import { nf, todayISO } from "../lib/format";
import {
  exportCSV,
  exportExcel,
  exportPDF,
  type ExportCol,
} from "../lib/export";
import { GLOBALSMILK, GLOBALSSHIFT, DEFAULT_PAGE_SIZE } from "../lib/global";
import { ENV_RATE_ID } from "../services/config";
import { pickLoose } from "../services/farmer/farmerBook";
import {
  farmerTotals,
  mapFarmers,
  type FarmerRow,
} from "../services/mappers/farmer.mapper";
import {
  mapVlcc,
  totalsOf,
  type VlccRow,
} from "../services/mappers/vlcc.mapper";
import {
  fetchFarmerCollection,
  fetchFarmerMilkEntry,
} from "../services/farmer/farmer.service";
import { fetchVlccCollection } from "../services/vlcc/vlcc.service";
import { getSession } from "../services/session";
import { vlccOption, vlccTitle } from "../services/vlcc/names";
import type {
  MilkCode,
  RawFarmerRow,
  RawLoose,
  RawVlccRow,
  ShiftCode,
} from "../services/types/raw";
import { useQuery } from "../hooks/useQuery";
import { useFarmerMaster } from "../hooks/useSmartxData";
import { useCenters, useReportColumns } from "../hooks/useSessionData";
import { Droplets, FlaskConical, IndianRupee, Users } from "lucide-react";

type View = "vlcc" | "farmer" | "entry";
interface Applied {
  from: string;
  to: string;
  shift: ShiftCode;
  milk: MilkCode | "ALL";
  vlcc: string;
  rateId: string;
}

type EntryRow = Record<string, string>;
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
const prettyKey = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
const asText = (v: unknown) =>
  v === null || v === undefined
    ? ""
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v).trim();
const toNum = (v: string) => {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const HIDDEN_KEYS = new Set(["maxid"]);

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

const Collections: React.FC = () => {
  const toast = useToast();
  const today = todayISO();
  const sessionIds = getSession()?.vlccIds ?? [];

  const centers = useCenters();

  const farmerAccess = useReportColumns("farmercollection");

  const [vlcc, setVlcc] = useState("all");
  const [milk, setMilk] = useState<"all" | MilkCode>("all");
  const [shift, setShift] = useState<ShiftCode>("Z");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("vlcc");
  const [rateId, setRateId] = useState(ENV_RATE_ID);
  const [applied, setApplied] = useState<Applied>({
    from: today,
    to: today,
    shift: "Z",
    milk: "ALL",
    vlcc: "all",
    rateId: ENV_RATE_ID,
  });

  const ids = applied.vlcc === "all" ? sessionIds : [applied.vlcc];
  const key = `${applied.from}:${applied.to}:${applied.shift}:${applied.milk}:${ids.join(",")}`;
  const params = {
    from: applied.from,
    to: applied.to,
    shift: applied.shift,
    milk: applied.milk,
    vlccIds: ids,
  };

  const vlccQ = useQuery<RawVlccRow>(
    view === "vlcc" ? `vlccpage:${key}` : null,
    (emit) => fetchVlccCollection(params, emit),
  );

  const entryQ = useQuery<RawLoose>(
    view === "entry" && applied.rateId
      ? `entrypage:${key}:${applied.rateId}`
      : null,
    (emit) => fetchFarmerMilkEntry({ ...params, rateId: applied.rateId }, emit),
  );
  const portalEntry =
    view === "entry" && !!applied.rateId && entryQ.status !== "error";
  const farmerQ = useQuery<RawFarmerRow>(
    view === "farmer" || (view === "entry" && !portalEntry)
      ? `farmerpage:${key}`
      : null,
    (emit) => fetchFarmerCollection(params, emit),
  );
  const active =
    view === "vlcc"
      ? vlccQ
      : view === "farmer"
        ? farmerQ
        : portalEntry
          ? entryQ
          : farmerQ;

  const search = () =>
    setApplied({
      from,
      to,
      shift,
      milk: milk === "all" ? "ALL" : milk,
      vlcc,
      rateId: rateId.trim(),
    });
  const reset = () => {
    setVlcc("all");
    setMilk("all");
    setShift("Z");
    setFrom(today);
    setTo(today);
    setQ("");
    setRateId(ENV_RATE_ID);
    setApplied({
      from: today,
      to: today,
      shift: "Z",
      milk: "ALL",
      vlcc: "all",
      rateId: ENV_RATE_ID,
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
        .filter(
          (r) =>
            !needle ||
            r.farmerName.toLowerCase().includes(needle) ||
            r.farmerId.includes(needle),
        ),
    [farmerQ.rows, needle, masterNames],
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

  const entryRows = useMemo<EntryRow[]>(() => {
    const rows = entryQ.rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, asText(v)])),
    );
    return needle
      ? rows.filter((r) =>
          Object.values(r).some((v) => v.toLowerCase().includes(needle)),
        )
      : rows;
  }, [entryQ.rows, needle]);
  const entryKeys = useMemo(() => {
    const keys: string[] = [];
    for (const r of entryRows)
      for (const k of Object.keys(r))
        if (!keys.includes(k) && !HIDDEN_KEYS.has(k.toLowerCase()))
          keys.push(k);
    return keys;
  }, [entryRows]);

  const vt = useMemo(() => totalsOf(vlccRows), [vlccRows]);
  const ft = useMemo(() => farmerTotals(farmerRows), [farmerRows]);
  const et = useMemo(() => {
    let liter = 0,
      kg = 0,
      amount = 0,
      fw = 0;
    const ids = new Set<string>();
    for (const r of entryRows) {
      const q = toNum(pickLoose(r, ["qty", "liter", "litre"]));
      liter += q;
      kg += toNum(pickLoose(r, ["kg"]));
      amount += toNum(pickLoose(r, ["amount", "totalamount"]));
      fw += q * toNum(pickLoose(r, ["fat"]));
      const id = pickLoose(r, ["farmerid", "farmercode"]);
      if (id) ids.add(`${pickLoose(r, ["vlccid"])}:${id}`);
    }
    return {
      count: entryRows.length,
      liter,
      kg,
      amount,
      avgFat: liter ? fw / liter : 0,
      farmers: ids.size,
    };
  }, [entryRows]);
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
        : portalEntry
          ? {
              liter: et.liter,
              kg: et.kg,
              avgFat: et.avgFat,
              amount: et.amount,
              count: et.count,
              farmers: et.farmers,
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
        <Badge tone={r.shift === "Morning" ? "warn" : "brand"}>
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
          <Badge tone={r.shift === "Morning" ? "warn" : "brand"}>
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

  const entryCols: Column<EntryRow>[] = entryKeys.map((k) => ({
    key: k,
    header: prettyKey(k),
    sort: (r: EntryRow) =>
      r[k] !== "" && !Number.isNaN(Number(r[k].replace(/,/g, "")))
        ? toNum(r[k])
        : (r[k] ?? ""),
    cell: (r: EntryRow) => r[k] ?? "",
  }));
  const entryExport: ExportCol<EntryRow>[] = entryKeys.map((k) => ({
    header: prettyKey(k),
    value: (r: EntryRow) => r[k] ?? "",
  }));

  const name = `${view === "vlcc" ? "vlc-collection" : view === "farmer" ? "farmer-collection" : "farmerwise-collection"}-${applied.from}-to-${applied.to}`;
  const run = (kind: "csv" | "xls" | "pdf") => {
    const fn =
      kind === "csv" ? exportCSV : kind === "xls" ? exportExcel : exportPDF;
    if (view === "vlcc") fn(name, vlccExport, vlccRows);
    else if (view === "farmer") fn(name, farmerExport, farmerRows);
    else if (portalEntry) fn(name, entryExport, entryRows);
    else fn(name, farmerwiseExport, farmerwise);
    toast(
      kind === "pdf"
        ? "Print dialog opened — choose Save as PDF to download"
        : `${kind.toUpperCase()} file downloaded`,
    );
  };

  const err = active.status === "error";
  const statError = err ? active.error?.message : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        subtitle="Milk collected at your VLCs, totals per centre, every farmer sample, or the farmerwise entries."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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
        />
      </div>

      <Card>
        <CardHeader
          title="Filters"
          subtitle="Press Search to load. The portal can take up to a minute."
          action={
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw size={14} />}
              onClick={reset}
            >
              Reset
            </Button>
          }
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-6">
          <Field label="Centre" className="lg:col-span-2">
            <Select value={vlcc} onChange={(e) => setVlcc(e.target.value)}>
              <option value="all">All centres</option>
              {centers.length
                ? centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} · {c.id}
                    </option>
                  ))
                : sessionIds.map((id) => (
                    <option key={id} value={id}>
                      {vlccOption(id)}
                    </option>
                  ))}
            </Select>
          </Field>
          <Field label="Milk type">
            <Select
              value={milk}
              onChange={(e) => setMilk(e.target.value as "all" | MilkCode)}
            >
              <option value="all">All milk</option>
              {GLOBALSMILK.milkOptions.map((m) => (
                <option key={m.Id} value={m.Id}>
                  {m.Name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shift">
            <Select
              value={shift}
              onChange={(e) => setShift(e.target.value as ShiftCode)}
            >
              {GLOBALSSHIFT.shiftOptions.map((m) => (
                <option key={m.Id} value={m.Id}>
                  {m.Name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          {view === "entry" && (
            <Field
              label="Rate ID"
              hint="Optional: only for the portal's own farmerwise report"
              className="lg:col-span-2"
            >
              <Input
                value={rateId}
                onChange={(e) => setRateId(e.target.value)}
                placeholder="Leave empty to use farmer samples"
              />
            </Field>
          )}
          <Field
            label={
              view === "vlcc"
                ? "Village or VLC id"
                : view === "farmer"
                  ? "Farmer name or ID"
                  : "Search any column"
            }
            className={
              view === "entry"
                ? "sm:col-span-2 lg:col-span-3"
                : "sm:col-span-2 lg:col-span-5"
            }
          >
            <Input
              icon={<Search size={16} />}
              placeholder="Start typing"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Field>

          <div className="flex items-end sm:col-span-2 lg:col-span-1 lg:items-start lg:self-start lg:mt-7">
            <Button
              className="w-full whitespace-nowrap"
              icon={<Search size={16} />}
              onClick={search}
              loading={active.fetching && active.rows.length === 0}
            >
              Search
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto">
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
            {!loading && !err && (
              <Badge tone="brand">Record Count: {nf(sum.count)}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="soft"
              icon={<FileSpreadsheet size={15} />}
              onClick={() => run("xls")}
              disabled={loading || err || sum.count === 0}
            >
              Excel
            </Button>
            <Button
              size="sm"
              variant="soft"
              icon={<Download size={15} />}
              onClick={() => run("csv")}
              disabled={loading || err || sum.count === 0}
            >
              CSV
            </Button>
            <Button
              size="sm"
              variant="soft"
              icon={<FileText size={15} />}
              onClick={() => run("pdf")}
              disabled={loading || err || sum.count === 0}
            >
              Print / PDF
            </Button>
          </div>
        </div>
        {view === "entry" && !portalEntry && (
          <p className="border-b border-line bg-soft/60 px-5 py-3 text-xs text-mute sm:px-6">
            {applied.rateId && entryQ.status === "error"
              ? `The portal refused its farmerwise report for Rate ID ${applied.rateId}. Showing each farmer's totals worked out from the farmer samples instead.`
              : "Each farmer's totals worked out from the farmer samples. To use the portal's own farmerwise report, type its Rate ID above and press Search."}
          </p>
        )}
        {loading ? (
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
            ) : !portalEntry ? (
              <DataTable
                columns={farmerwiseCols}
                rows={farmerwise}
                rowKey={(r) => r.key}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            ) : (
              <DataTable
                columns={entryCols}
                rows={entryRows}
                rowKey={(r) => JSON.stringify(r)}
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            )}
          </QueryBoundary>
        )}
      </Card>
    </div>
  );
};

export default Collections;
