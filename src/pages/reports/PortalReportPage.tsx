import type * as React from 'react';
import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Building2, ListChecks, RotateCcw, Search } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Fields';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { QueryBoundary } from '../../components/Widget';
import { MilkLoader } from '../../components/MilkLoader';
import { ReportBar, ReportDataBadge, ReportPage, Reveal, type ExportKind } from '../../components/ReportKit';
import { exportCSV, exportExcel, exportPDF, type ExportCol } from '../../lib/export';
import { useToast } from '../../context/ToastContext';
import { addDays, fmtDate, nf, todayISO } from '../../lib/format';
import { DEFAULT_PAGE_SIZE, GLOBALLABELS } from '../../lib/global';
import { CentreField, SubmitButton } from '../../components/ReportFilters';
import { useQuery } from '../../hooks/useQuery';
import { useCenters } from '../../hooks/useSessionData';
import { getSession } from '../../services/session';
import { vlccTitle } from '../../services/vlcc/names';
import { fetchPortalReport, type PortalRow } from '../../services/report/portalReport.api';
import type { ShiftCode } from '../../services/types/raw';

interface Props {
  title: string;
  subtitle: string;

  endpoint: string;
  
  slug: string;
  icon: LucideIcon;
  note?: string;
  formTitle?: string;
  centreLabel?: string;
  allCentres?: boolean;
  withDates?: boolean;
  submitLabel?: string;
}

const ALL = 'ALL';

const headerOf = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const textOf = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).trim();
};


const PortalReportPage: React.FC<Props> = ({ title, subtitle, endpoint, slug, note, formTitle, centreLabel, allCentres = true, withDates = true, submitLabel }) => {
  const today = todayISO();
  const toast = useToast();
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];
  const allIds = centers.length ? centers.map((c) => c.id) : sessionIds;

  const weekAgo = addDays(today, -6);
  const [scope, setScope] = useState(allCentres ? ALL : '');
  const [shift, setShift] = useState<ShiftCode>('Z');
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [needle, setNeedle] = useState('');
  const [applied, setApplied] = useState<{ from: string; to: string; shift: ShiftCode; scope: string } | null>(null);

  const ids = applied ? (applied.scope === ALL ? allIds : [applied.scope]) : [];
  const key = applied ? `${slug}:${applied.from}:${applied.to}:${applied.shift}:${applied.scope}` : null;
  const q = useQuery<PortalRow>(key, (emit) =>
    fetchPortalReport(endpoint, { from: applied!.from, to: applied!.to, shift: applied!.shift, vlccIds: ids }, emit),
  );


  const keys = useMemo(() => {
    const seen: string[] = [];
    for (const r of q.rows) for (const k of Object.keys(r)) if (k !== 'vlccid' && !seen.includes(k)) seen.push(k);
    return seen.filter((k) => q.rows.some((r) => textOf(r[k]) !== ''));
  }, [q.rows]);

  const rows = useMemo(() => {
    const s = needle.trim().toLowerCase();
    if (!s) return q.rows;
    return q.rows.filter((r) => `${vlccTitle(textOf(r.vlccid))} ${Object.values(r).map(textOf).join(' ')}`.toLowerCase().includes(s));
  }, [q.rows, needle]);

  const centresSeen = useMemo(() => new Set(q.rows.map((r) => textOf(r.vlccid)).filter(Boolean)).size, [q.rows]);

  const columns: Column<PortalRow>[] = useMemo(
    () => [
      { key: '__centre', header: 'Centre', sort: (r) => vlccTitle(textOf(r.vlccid)), cell: (r) => <span className="font-semibold">{vlccTitle(textOf(r.vlccid))}</span> },
      ...keys.map<Column<PortalRow>>((k) => ({ key: k, header: headerOf(k), sort: (r) => textOf(r[k]), cell: (r) => textOf(r[k]) || '—' })),
    ],
    [keys],
  );

  const exportCols: ExportCol<PortalRow>[] = useMemo(
    () => [
      { header: 'Centre', value: (r) => vlccTitle(textOf(r.vlccid)) },
      ...keys.map<ExportCol<PortalRow>>((k) => ({ header: headerOf(k), value: (r) => textOf(r[k]) })),
    ],
    [keys],
  );

  const loading = q.status === 'loading' || (q.fetching && q.rows.length === 0);
  const err = q.status === 'error';
  const statError = err ? q.error?.message : undefined;
  const hasApplied = applied !== null;

  const submit = () => setApplied({ from, to, shift, scope });
  const reset = () => {
    setScope(allCentres ? ALL : '');
    setShift('Z');
    setFrom(weekAgo);
    setTo(today);
    setNeedle('');
    setApplied(null);
  };

  const run = (kind: ExportKind) => {
    if (!applied) return;
    const name = `${slug}-report-${applied.from}-to-${applied.to}`;
    if (kind === 'pdf') {
      exportPDF(name, exportCols, rows, {
        subtitle: `${title} · ${fmtDate(applied.from)} to ${fmtDate(applied.to)}`,
        meta: [
          ['Centre', applied.scope === ALL ? 'All centres' : vlccTitle(applied.scope)],
        ],
        summary: [
          { label: 'Records', value: nf(rows.length) },
          { label: 'Centres', value: nf(centresSeen) },
        ],
        note: note ?? 'Report rows are loaded from the SmartX portal using the selected filters.',
      });
      toast('Print dialog opened — choose Save as PDF to download');
    } else if (kind === 'csv') {
      exportCSV(name, exportCols, rows);
      toast('CSV file downloaded');
    } else {
      exportExcel(name, exportCols, rows);
      toast('XLS file downloaded');
    }
  };

  return (
    <ReportPage title={title} subtitle={subtitle}>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Records" value={q.rows.length} icon={<ListChecks size={18} />} tone="text-brand" hint={needle ? `${rows.length} match your search` : 'In the chosen dates'} loading={loading} error={statError} onRetry={q.retry} idle={!hasApplied} compact />
        <StatCard label="Centres" value={centresSeen} icon={<Building2 size={18} />} tone="text-goat" hint="With records" loading={loading} error={statError} onRetry={q.retry} idle={!hasApplied} compact />
      </div>

      <Reveal delay={0.05}>
        <Card>
          {formTitle && (
            <CardHeader
              title={formTitle}
              action={<Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={reset}>Reset</Button>}
            />
          )}
          <div className={`grid gap-x-4 gap-y-3 sm:grid-cols-2 ${formTitle ? 'px-5 pb-5 pt-3 sm:px-6 sm:pb-6' : 'p-5 sm:p-6'} ${withDates ? 'lg:grid-cols-4' : ''}`}>
            <CentreField
              className={withDates ? 'sm:col-span-2 lg:col-span-4' : undefined}
              label={centreLabel}
              allValue={allCentres ? ALL : undefined}
              value={scope}
              onChange={setScope}
            />
            {withDates && (
              <>
                <Field label={GLOBALLABELS.fromDate} className="lg:col-span-2"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
                <Field label={GLOBALLABELS.toDate} className="lg:col-span-2"><Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></Field>
              </>
            )}
            <SubmitButton
              label={submitLabel}
              className={withDates ? 'sm:col-span-2 lg:col-span-4' : undefined}
              loading={q.fetching && q.rows.length === 0}
              disabled={allIds.length === 0 || !scope || !from || !to}
              onClick={submit}
            />
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={rows.length}
            hideCount={loading || err || !hasApplied}
            disabled={loading || err || rows.length === 0}
            kinds={['xls', 'pdf', 'csv']}
            onExport={run}
            left={<div className="w-56 max-w-full"><Input icon={<Search size={16} />} placeholder="Search any column" value={needle} onChange={(e) => setNeedle(e.target.value)} /></div>}
            source={hasApplied ? <ReportDataBadge state={{ fetching: q.fetching, stale: q.stale, updatedAt: q.updatedAt, failed: q.failed, total: q.total, error: q.error, hasData: q.rows.length > 0 }} /> : undefined}
          />
          {!hasApplied ? (
            <p className="px-6 py-8 text-center text-sm text-mute">Choose the filters and press Submit to load the {title.toLowerCase()}.</p>
          ) : (
            <QueryBoundary q={q} skeleton={<MilkLoader label={`Loading ${title.toLowerCase()}…`} />} emptyTitle="No record for these filters" emptyHint="The portal has no records for these dates and centre.">
              {rows.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-mute">Nothing matches your search.</p>
              ) : (
                <DataTable columns={columns} rows={rows} rowKey={(r) => JSON.stringify(r)} pageSize={DEFAULT_PAGE_SIZE} pageSizes={[10, 25, 50, 100, 250]} sizeLabel="Result per page" />
              )}
            </QueryBoundary>
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default PortalReportPage;
