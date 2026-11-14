import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { Field, Select } from "./ui/Fields";
import { PageBar } from "./ui/PageBar";
import { EmptyState } from "./EmptyState";
import { ErrorBlock } from "./Widget";
import { MilkLoader } from './MilkLoader';
import { CardTitle, ReportBar, ReportPage } from "./ReportKit";
import { useCenters } from "../hooks/useSessionData";
import { vlccOption } from "../services/vlcc/names";
import { exportExcel, type ExportCol } from "../lib/export";
import { ekoNorm, ekoText, ekoValue, type EkoField, type EkoRow } from "../services/report/ekoShared";
import { clipTitle } from '../lib/clipTitle';

interface Props {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Columns of the report, in order. */
  fields: EkoField[];
  load: (stationId: string) => Promise<EkoRow[]>;
}

interface Col { label: string; get: (row: EkoRow) => string }

const SIZES = [100, 200, 300];
const labelOf = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();

/** Shared Eko report screen (Eko Calibration + Eko Correction): VLC picker, Show, count, Excel, table, pages. */
export default function EkoDataReport({ title, subtitle, icon: Icon, fields, load }: Props) {
  const centers = useCenters();
  const ids = useMemo(() => [...new Set(centers.map((c) => c.stationId || c.id).filter(Boolean))], [centers]);
  const [station, setStation] = useState("");
  const [rows, setRows] = useState<EkoRow[]>([]);
  const [loaded, setLoaded] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [size, setSize] = useState(100);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!station && ids.length) setStation(ids[0]!);
  }, [ids, station]);

  // The report's own columns. If the reply uses none of the expected names, every field of the reply is shown instead.
  const columns = useMemo<Col[]>(() => {
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const matched = keys.some((k) => fields.some((f) => f.aliases.some((a) => ekoNorm(a) === ekoNorm(k))));
    if (rows.length && !matched) return keys.map((k) => ({ label: labelOf(k), get: (r: EkoRow) => ekoText(r[k]) }));
    return fields.map((f) => ({ label: f.label, get: (r: EkoRow) => ekoText(ekoValue(r, f.aliases)) }));
  }, [rows, fields]);

  const show = async () => {
    if (!station || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await load(station);
      setRows(result);
      setPage(1);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : `${title} could not be loaded.`);
    } finally {
      setLoaded(station);
      setLoading(false);
    }
  };

  const exportReport = async () => {
    if (!rows.length) return;
    const cols: ExportCol<EkoRow>[] = columns.map((c) => ({ header: c.label, value: (r) => c.get(r) }));
    await exportExcel(`${title} - ${vlccOption(loaded)}`, cols, rows);
  };

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages);
  const visible = rows.slice((cur - 1) * size, cur * size);

  return (
    <ReportPage title={title} subtitle={subtitle}>
      <Card>
        <CardHeader title={<CardTitle icon={Icon}>{title}</CardTitle>} />
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1.45fr)] sm:items-end sm:px-5">
          <Field label="VLC Name">
            <Select value={station} onChange={(e) => setStation(e.target.value)}>
              <option value="">Select VLC</option>
              {ids.map((id) => <option key={id} value={id}>{vlccOption(id)}</option>)}
            </Select>
          </Field>
          <Button type="button" className="w-full" icon={<RefreshCw size={16} />} loading={loading} disabled={!station || loading} onClick={show}>Show</Button>
        </div>
      </Card>

      <Card>
        <ReportBar
          count={rows.length}
          disabled={loading || rows.length === 0}
          kinds={["xls"]}
          labels={{ xls: "Excel Export" }}
          onExport={() => { void exportReport(); }}
          left={
            <label className="flex items-center gap-2 text-sm text-mute">
              <span className="whitespace-nowrap font-semibold">Result per page:</span>
              <span className="w-24"><Select className="h-9" value={String(size)} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
                {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select></span>
            </label>
          }
        />

        {error && <div className="p-4"><ErrorBlock compact message={error} onRetry={() => void show()} /></div>}
        {loading ? (
          <MilkLoader label={`Loading ${title}…`} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="clip-cells w-full border-separate border-spacing-0 text-[13px]" onMouseOver={clipTitle}>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.label} scope="col" className="sticky top-0 whitespace-nowrap border-b border-line bg-soft/70 px-3 py-3 text-left text-xs font-semibold text-mute first:rounded-tl-xl last:rounded-tr-xl">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, i) => (
                    <tr key={(cur - 1) * size + i} className="transition-colors hover:bg-brand/[0.06]">
                      {columns.map((c) => <td key={c.label} className="tnum whitespace-nowrap border-b border-line/70 px-3 py-3">{c.get(row)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && !error && (
              loaded
                ? <EmptyState title="No record" hint={`No ${title} record found for ${vlccOption(loaded)}.`} />
                : <EmptyState title="No record" hint="Select a VLC and press Show." />
            )}
            {rows.length > 0 && <PageBar total={rows.length} page={cur} size={size} onPage={setPage} />}
          </>
        )}
      </Card>
    </ReportPage>
  );
}
