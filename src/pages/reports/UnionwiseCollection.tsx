import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Building2, Droplets, FlaskConical, IndianRupee, Search, Users } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useData } from '../../context/DataContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Fields';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { QueryBoundary } from '../../components/Widget';
import { MilkLoader } from '../../components/MilkLoader';
import { CardTitle, ReportBar, ReportDataBadge, ReportPage, Reveal, type ExportKind } from '../../components/ReportKit';
import { fmtDate, nf, todayISO } from '../../lib/format';
import { exportExcel, exportPDF, type ExportCol } from '../../lib/export';
import { DEFAULT_PAGE_SIZE } from '../../lib/global';
import { useSamples } from '../../hooks/useSmartxData';
import { useCenters } from '../../hooks/useSessionData';
import { unionTotals, unionwise, type UnionRow } from '../../services/mappers/report.mapper';
import { vlccTitle } from '../../services/vlcc/names';
import { pick } from '../../services/utils/loose';

const UNION_KEYS = ['unionname', 'union', 'unitname', 'federationname', 'dairyunion'];

const UnionwiseCollection: React.FC = () => {
  const toast = useToast();
  const { dairyName } = useData();
  const centers = useCenters();
  const today = todayISO();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: today, to: today });

  const { q, rows } = useSamples(applied.from, applied.to, true, 0);


  const unionOf = (id: string) => {
    const raw = centers.find((c) => c.id === id)?.raw;
    return (raw && pick(raw, UNION_KEYS)) || dairyName;
  };

  const data = useMemo(() => unionwise(rows, unionOf, (id) => vlccTitle(id)),
    
    [rows, centers, dairyName]);
  const t = useMemo(() => unionTotals(data), [data]);

  const loading = q.status === 'loading' || (q.fetching && q.rows.length === 0);
  const err = q.status === 'error';
  const statError = err ? q.error?.message : undefined;

  const cols: Column<UnionRow>[] = [
    { key: 'union', header: 'Union', sort: (r) => r.union, cell: (r) => <span className="font-semibold">{r.union}</span> },
    { key: 'society', header: 'Society', sort: (r) => r.society, cell: (r) => r.society },
    { key: 'farmer', header: 'Farmer', align: 'right', sort: (r) => r.farmers, cell: (r) => r.farmers },
    { key: 'qty', header: 'Qty', align: 'right', sort: (r) => r.liter, cell: (r) => <span className="font-bold">{r.liter.toFixed(2)}</span> },
    { key: 'fat', header: 'Avg. Fat', align: 'right', sort: (r) => r.fat, cell: (r) => r.fat.toFixed(2) },
    { key: 'snf', header: 'Avg. SNF', align: 'right', sort: (r) => r.snf, cell: (r) => r.snf.toFixed(2) },
    { key: 'rate', header: 'Avg. Rate', align: 'right', sort: (r) => r.rate, cell: (r) => r.rate.toFixed(2) },
    { key: 'amount', header: 'Amount', align: 'right', sort: (r) => r.amount, cell: (r) => <span className="font-bold">{nf(r.amount, 2)}</span> },
  ];

  const exportCols: ExportCol<UnionRow>[] = [
    { header: 'Union', value: (r) => r.union },
    { header: 'Society', value: (r) => r.society },
    { header: 'Farmer', value: (r) => r.farmers },
    { header: 'Qty', value: (r) => r.liter.toFixed(2) },
    { header: 'Avg. Fat', value: (r) => r.fat.toFixed(2) },
    { header: 'Avg. SNF', value: (r) => r.snf.toFixed(2) },
    { header: 'Avg. Rate', value: (r) => r.rate.toFixed(2) },
    { header: 'Amount', value: (r) => r.amount.toFixed(2) },
  ];

  const run = (kind: ExportKind) => {
    const name = `unionwise-collection-${applied.from}-to-${applied.to}`;
    if (kind === 'pdf') {
      exportPDF(name, exportCols, data, {
        subtitle: `${fmtDate(applied.from)} to ${fmtDate(applied.to)}`,
        meta: [['From', fmtDate(applied.from)], ['To', fmtDate(applied.to)], ['Societies', String(t.societies)]],
        summary: [
          { label: 'Total litres', value: nf(t.liter, 2) },
          { label: 'Average fat', value: t.fat.toFixed(2) },
          { label: 'Farmers', value: nf(t.farmers) },
          { label: 'Amount', value: `₹ ${nf(t.amount, 2)}` },
        ],
        totals: [
          { text: 'Total :', span: 2 }, { text: t.farmers }, { text: t.liter.toFixed(2) },
          { text: t.fat.toFixed(2) }, { text: t.snf.toFixed(2) }, { text: t.rate.toFixed(2) }, { text: nf(t.amount, 2) },
        ],
      });
      toast('Print dialog opened — choose Save as PDF to download');
    } else {
      exportExcel(name, exportCols, data);
      toast('XLS file downloaded');
    }
  };

  const footer = data.length > 0 && (
    <tr className="bg-brand/[0.07] font-bold">
      <td className="border-b border-line/70 px-4 py-3" colSpan={2}>Total :</td>
      <td className="border-b border-line/70 px-4 py-3 text-right tnum">{t.farmers}</td>
      <td className="border-b border-line/70 px-4 py-3 text-right tnum">{t.liter.toFixed(2)}</td>
      <td className="border-b border-line/70 px-4 py-3 text-right tnum">{t.fat.toFixed(2)}</td>
      <td className="border-b border-line/70 px-4 py-3 text-right tnum">{t.snf.toFixed(2)}</td>
      <td className="border-b border-line/70 px-4 py-3 text-right tnum">{t.rate.toFixed(2)}</td>
      <td className="border-b border-line/70 px-4 py-3 text-right tnum">{nf(t.amount, 2)}</td>
    </tr>
  );

  return (
    <ReportPage title="Unionwise Collection" subtitle="Milk collected for each union and its societies: farmers, litres, average fat, SNF and rate, and the amount.">

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Total litres" value={t.liter} decimals={1} icon={<Droplets size={18} />} tone="text-brand" hint={`${t.societies} societies`} loading={loading} error={statError} onRetry={q.retry} compact />
        <StatCard label="Average fat" value={t.fat} decimals={2} suffix="%" icon={<FlaskConical size={18} />} tone="text-cow" hint="Weighted by litres" loading={loading} error={statError} onRetry={q.retry} compact />
        <StatCard label="Farmers" value={t.farmers} icon={<Users size={18} />} tone="text-goat" hint={`${t.societies} societies`} loading={loading} error={statError} onRetry={q.retry} compact />
        <StatCard label="Amount" value={t.amount} prefix="₹" icon={<IndianRupee size={18} />} tone="text-buffalo" loading={loading} error={statError} onRetry={q.retry} compact />
      </div>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={Building2}>Unionwise Collection</CardTitle>} subtitle="Pick the dates and press Submit. The portal can take up to a minute." />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[1fr_1fr_2fr]">
            <Field label="From Date">
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To Date">
              <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <Button className="w-full" icon={<Search size={16} />} loading={q.fetching && q.rows.length === 0} onClick={() => setApplied({ from, to })}>Submit</Button>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar count={data.length} hideCount={loading || err} disabled={loading || err || data.length === 0} kinds={['xls', 'pdf']} onExport={run} source={<ReportDataBadge state={{ fetching: q.fetching, stale: q.stale, updatedAt: q.updatedAt, failed: q.failed, total: q.total, error: q.error, hasData: q.rows.length > 0 }} />} />
          {loading ? (
            <MilkLoader label="Loading unionwise collection…" />
          ) : (
            <QueryBoundary q={q} skeleton={<MilkLoader label="Loading unionwise collection…" />} emptyTitle="No record for these dates" emptyHint="The portal says there is no collection between these dates.">
              <DataTable columns={cols} rows={data} rowKey={(r) => r.key} pageSize={DEFAULT_PAGE_SIZE} pageSizes={[10, 25, 50, 100, 250]} sizeLabel="Result per page" footerRow={footer} />
            </QueryBoundary>
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default UnionwiseCollection;