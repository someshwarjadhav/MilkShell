import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Droplets, GitCompareArrows, IndianRupee, Scale, Search } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Field, Input, Select } from '../../components/ui/Fields';
import { GroupTable, type GCol } from '../../components/ui/GroupTable';
import { StatCard } from '../../components/ui/StatCard';
import { KindChip } from '../../components/KindChip';
import { ErrorBlock, Notice } from '../../components/Widget';
import { MilkLoader } from '../../components/MilkLoader';
import { CardTitle, ReportBar, ReportDataBadge, ReportPage, Reveal, type ExportKind } from '../../components/ReportKit';
import { cn } from '../../lib/cn';
import { fmtDate, nf, todayISO } from '../../lib/format';
import { exportCSV, exportExcel, exportPDF, type ExportCol } from '../../lib/export';
import { DEFAULT_PAGE_SIZE } from '../../lib/global';
import { useQuery } from '../../hooks/useQuery';
import { useCenters } from '../../hooks/useSessionData';
import { fetchVlccCollection } from '../../services/vlcc/vlcc.api';
import { fetchFarmerCollection } from '../../services/farmer/farmer.api';
import { mapVlcc } from '../../services/mappers/vlcc.mapper';
import { mapFarmers } from '../../services/mappers/farmer.mapper';
import { variance, varianceTotals, type SideTotals, type VarianceRow } from '../../services/mappers/report.mapper';
import { getSession } from '../../services/session';
import { vlccOption, vlccTitle } from '../../services/vlcc/names';
import type { RawFarmerRow, RawVlccRow } from '../../services/types/raw';


const Diff: React.FC<{ v: number; d?: number }> = ({ v, d = 2 }) => (
  <span className={cn('font-semibold', v < 0 ? 'text-danger' : v > 0 ? 'text-warn' : 'text-mute')}>{v.toFixed(d)}</span>
);

const TotalsCell: React.FC<{ a: [string, number]; b: [string, number]; c: [string, number]; money?: boolean }> = ({ a, b, c, money }) => (
  <div className="space-y-0.5 text-center text-xs font-bold leading-snug tnum">
    {[a, b, c].map(([label, value]) => <p key={label}>{label} : {money ? nf(value, 2) : value.toFixed(2).replace(/\.00$/, '')}</p>)}
  </div>
);

const FootCell: React.FC<{ span: number; children: React.ReactNode }> = ({ span, children }) => (
  <td colSpan={span} className="border-b border-l border-line/70 bg-brand/[0.07] px-3 py-3 align-top">{children}</td>
);

const VarianceReport: React.FC = () => {
  const toast = useToast();
  const today = todayISO();
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];

  const [vlcc, setVlcc] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: today, to: today, vlcc: '' });

  const hasAppliedCentre = Boolean(applied.vlcc);
  const ids = hasAppliedCentre ? [applied.vlcc] : [];
  const key = `${applied.from}:${applied.to}:${ids.join(',')}`;
  const params = { from: applied.from, to: applied.to, shift: 'Z' as const, milk: 'ALL' as const, vlccIds: ids, priority: 0 as const };


  const vq = useQuery<RawVlccRow>(hasAppliedCentre ? `variance-doc:${key}` : null, (emit) => fetchVlccCollection(params, emit));
  const fq = useQuery<RawFarmerRow>(hasAppliedCentre ? `variance-vlc:${key}` : null, (emit) => fetchFarmerCollection(params, emit));

  const rows = useMemo(() => variance(mapVlcc(vq.rows), mapFarmers(fq.rows)), [vq.rows, fq.rows]);
  const t = useMemo(() => varianceTotals(rows), [rows]);

  const err = vq.status === 'error' || fq.status === 'error';
  const waiting = vq.fetching || fq.fetching;
  const loading = !err && (vq.status === 'loading' || fq.status === 'loading' || (waiting && (vq.rows.length === 0 || fq.rows.length === 0)));
  const statError = err ? (vq.error ?? fq.error)?.message : undefined;
  const retry = () => { vq.retry(); fq.retry(); };

  const shiftText = (r: VarianceRow) => r.shift ?? '';
  const cols: GCol<VarianceRow>[] = [
    { key: 'id', header: 'VLCC Id', cell: (r) => r.vlccid },
    { key: 'village', header: 'Village Name', cell: (r) => <span className="font-semibold">{vlccTitle(r.vlccid, r.village)}</span> },
    { key: 'date', header: 'Date', cell: (r) => r.date },
    { key: 'shift', header: 'Shift', cell: (r) => (r.shift ? <Badge tone={r.shift === 'Morning' ? 'warn' : 'brand'}>{r.shift}</Badge> : '') },
    { key: 'milk', header: 'Milk Type', cell: (r) => <KindChip kind={r.milk} label={r.milkLabel} /> },

    { key: 'vq', group: 'DOC Collection', header: 'Vendor Qty', align: 'right', cell: (r) => r.vendor.qty.toFixed(2) },
    { key: 'vf', group: 'DOC Collection', header: 'Vendor Fat', align: 'right', cell: (r) => r.vendor.fat.toFixed(2) },
    { key: 'vs', group: 'DOC Collection', header: 'Vendor SNF', align: 'right', cell: (r) => r.vendor.snf.toFixed(2) },
    { key: 'vr', group: 'DOC Collection', header: 'Vendor Rate', align: 'right', cell: (r) => r.vendor.rate.toFixed(2) },
    { key: 'va', group: 'DOC Collection', header: 'Vendor Amount', align: 'right', cell: (r) => <span className="font-bold">{nf(r.vendor.amount, 2)}</span> },

    { key: 'fq', group: 'VLC Collection', header: 'Farmer Qty', align: 'right', cell: (r) => r.farmer.qty.toFixed(2) },
    { key: 'ff', group: 'VLC Collection', header: 'Farmer Fat', align: 'right', cell: (r) => r.farmer.fat.toFixed(2) },
    { key: 'fs', group: 'VLC Collection', header: 'Farmer SNF', align: 'right', cell: (r) => r.farmer.snf.toFixed(2) },
    { key: 'fr', group: 'VLC Collection', header: 'Farmer Rate', align: 'right', cell: (r) => r.farmer.rate.toFixed(2) },
    { key: 'fa', group: 'VLC Collection', header: 'Farmer Amount', align: 'right', cell: (r) => <span className="font-bold">{nf(r.farmer.amount, 2)}</span> },

    { key: 'dq', group: 'Difference', header: 'Qty Diff', align: 'right', cell: (r) => <Diff v={r.diff.qty} /> },
    { key: 'df', group: 'Difference', header: 'Fat Diff', align: 'right', cell: (r) => <Diff v={r.diff.fat} /> },
    { key: 'ds', group: 'Difference', header: 'SNF Diff', align: 'right', cell: (r) => <Diff v={r.diff.snf} /> },
    { key: 'da', group: 'Difference', header: 'Amount Diff', align: 'right', cell: (r) => <Diff v={r.diff.amount} /> },
  ];

  const exportCols: ExportCol<VarianceRow>[] = [
    { header: 'VLCC Id', value: (r) => r.vlccid },
    { header: 'Village Name', value: (r) => vlccTitle(r.vlccid, r.village) },
    { header: 'Date', value: (r) => r.date },
    { header: 'Shift', value: shiftText },
    { header: 'Milk Type', value: (r) => r.milkLabel },
    { header: 'Vendor Qty', value: (r) => r.vendor.qty.toFixed(2) },
    { header: 'Vendor Fat', value: (r) => r.vendor.fat.toFixed(2) },
    { header: 'Vendor SNF', value: (r) => r.vendor.snf.toFixed(2) },
    { header: 'Vendor Rate', value: (r) => r.vendor.rate.toFixed(2) },
    { header: 'Vendor Amount', value: (r) => r.vendor.amount.toFixed(2) },
    { header: 'Farmer Qty', value: (r) => r.farmer.qty.toFixed(2) },
    { header: 'Farmer Fat', value: (r) => r.farmer.fat.toFixed(2) },
    { header: 'Farmer SNF', value: (r) => r.farmer.snf.toFixed(2) },
    { header: 'Farmer Rate', value: (r) => r.farmer.rate.toFixed(2) },
    { header: 'Farmer Amount', value: (r) => r.farmer.amount.toFixed(2) },
    { header: 'Qty Diff', value: (r) => r.diff.qty.toFixed(2) },
    { header: 'Fat Diff', value: (r) => r.diff.fat.toFixed(2) },
    { header: 'SNF Diff', value: (r) => r.diff.snf.toFixed(2) },
    { header: 'Amount Diff', value: (r) => r.diff.amount.toFixed(2) },
  ];

  const run = (kind: ExportKind) => {
    const name = `variance-report-${applied.from}-to-${applied.to}`;
    if (kind === 'pdf') {
      const side = (s: SideTotals, d = false) => [
        { text: `C ${d ? 'Diff' : 'Lit'} : ${s.cowLit.toFixed(2)}\nAmt : ${nf(s.cowAmt, 2)}\nTot Lit : ${s.totLit.toFixed(2)}`, span: 3, align: 'center' as const },
        { text: `B ${d ? 'Diff' : 'Lit'} : ${s.buffLit.toFixed(2)}\nAmt : ${nf(s.buffAmt, 2)}\nTot Amt : ${nf(s.totAmt, 2)}`, span: 2, align: 'center' as const },
      ];
      exportPDF(name, exportCols, rows, {
        subtitle: `DOC collection against VLC collection · ${fmtDate(applied.from)} to ${fmtDate(applied.to)}`,
        meta: [['VLC', vlccTitle(applied.vlcc)], ['From', fmtDate(applied.from)], ['To', fmtDate(applied.to)]],
        summary: [
          { label: 'DOC litres', value: nf(t.vendor.totLit, 2) },
          { label: 'VLC litres', value: nf(t.farmer.totLit, 2) },
          { label: 'Litre difference', value: nf(t.diff.totLit, 2), tone: t.diff.totLit < 0 ? 'danger' : t.diff.totLit > 0 ? 'warn' : 'ok' },
          { label: 'Amount difference', value: `₹ ${nf(t.diff.totAmt, 2)}`, tone: t.diff.totAmt < 0 ? 'danger' : t.diff.totAmt > 0 ? 'warn' : 'ok' },
        ],
        groups: [{ label: '', span: 5 }, { label: 'DOC Collection', span: 5 }, { label: 'VLC Collection', span: 5 }, { label: 'Difference', span: 4 }],
        totals: [
          { text: 'Total :', span: 5, align: 'center' },
          ...side(t.vendor),
          ...side(t.farmer),
          { text: `C Diff : ${t.diff.cowLit.toFixed(2)}\nAmt : ${nf(t.diff.cowAmt, 2)}\nTot Lit : ${t.diff.totLit.toFixed(2)}`, span: 2, align: 'center' },
          { text: `B Diff : ${t.diff.buffLit.toFixed(2)}\nAmt : ${nf(t.diff.buffAmt, 2)}\nTot Amt : ${nf(t.diff.totAmt, 2)}`, span: 2, align: 'center' },
        ],
        landscape: true,
        note: 'Difference = DOC (vendor) minus VLC (farmer).',
      });
      toast('Print dialog opened — choose Save as PDF to download');
    } else {
      (kind === 'csv' ? exportCSV : exportExcel)(name, exportCols, rows);
      toast(`${kind === 'xls' ? 'XLS' : 'CSV'} file downloaded`);
    }
  };

  const block = (s: SideTotals, diff = false) => (
    <>
      <FootCell span={3}><TotalsCell a={[`C ${diff ? 'Diff' : 'Lit'}`, s.cowLit]} b={['Amt', s.cowAmt]} c={['Tot Lit', s.totLit]} /></FootCell>
      <FootCell span={2}><TotalsCell a={[`B ${diff ? 'Diff' : 'Lit'}`, s.buffLit]} b={['Amt', s.buffAmt]} c={['Tot Amt', s.totAmt]} money /></FootCell>
    </>
  );
  const footer = (
    <tr>
      <td colSpan={5} className="border-b border-line/70 bg-brand/[0.07] px-4 py-3 text-center font-display text-base font-extrabold">Total :</td>
      {block(t.vendor)}
      {block(t.farmer)}
      {block(t.diff, true)}
    </tr>
  );

  const nothing = rows.length === 0;

  return (
    <ReportPage title="Variance Report" subtitle="DOC collection against VLC collection for every centre, day, shift and milk type, with the difference between them.">

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="DOC litres" value={t.vendor.totLit} decimals={1} icon={<Droplets size={18} />} tone="text-brand" hint={`₹${nf(t.vendor.totAmt)} amount`} loading={loading} error={statError} onRetry={retry} idle={!hasAppliedCentre} compact />
        <StatCard label="VLC litres" value={t.farmer.totLit} decimals={1} icon={<Scale size={18} />} tone="text-goat" hint={`₹${nf(t.farmer.totAmt)} amount`} loading={loading} error={statError} onRetry={retry} idle={!hasAppliedCentre} compact />
        <StatCard label="Litre difference" value={t.diff.totLit} decimals={2} icon={<GitCompareArrows size={18} />} tone={t.diff.totLit < 0 ? 'text-danger' : 'text-warn'} hint="DOC minus VLC" loading={loading} error={statError} onRetry={retry} idle={!hasAppliedCentre} compact />
        <StatCard label="Amount difference" value={t.diff.totAmt} decimals={2} prefix="₹" icon={<IndianRupee size={18} />} tone={t.diff.totAmt < 0 ? 'text-danger' : 'text-buffalo'} hint="DOC minus VLC" loading={loading} error={statError} onRetry={retry} idle={!hasAppliedCentre} compact />
      </div>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={GitCompareArrows}>Variance Report</CardTitle>} subtitle="Press Submit to compare. The portal can take up to a minute." />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[2fr_1fr_1fr]">
            <Field label="VLC Name" className="sm:col-span-2 lg:col-span-1">
              <Select value={vlcc} onChange={(e) => setVlcc(e.target.value)}>
                <option value="">Select a centre</option>
                {centers.length
                  ? centers.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.id}</option>)
                  : sessionIds.map((id) => <option key={id} value={id}>{vlccOption(id)}</option>)}
              </Select>
            </Field>
            <Field label="From Date"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To Date"><Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button className="w-full" icon={<Search size={16} />} loading={waiting && nothing} disabled={!vlcc} onClick={() => setApplied({ from, to, vlcc })}>Submit</Button>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar count={rows.length} hideCount={loading || err} disabled={loading || err || nothing} kinds={['xls', 'pdf', 'csv']} onExport={run} source={<ReportDataBadge state={{ fetching: waiting, stale: vq.stale || fq.stale, updatedAt: vq.updatedAt !== null && fq.updatedAt !== null ? Math.max(vq.updatedAt, fq.updatedAt) : null, failed: vq.failed + fq.failed, total: vq.total + fq.total, error: err ? (vq.error ?? fq.error) : null, hasData: vq.rows.length > 0 && fq.rows.length > 0 }} />} />
          {!hasAppliedCentre ? (
            <p className="px-6 py-8 text-center text-sm text-mute">Select a centre and press Submit to compare its collections.</p>
          ) : loading ? (
            <MilkLoader label="Comparing DOC and VLC collection…" />
          ) : err ? (
            <ErrorBlock message={statError ?? 'The variance report could not be loaded.'} onRetry={retry} busy={waiting} />
          ) : (
            <>
              <Notice q={vq.fetching ? vq : fq} />
              <GroupTable columns={cols} rows={rows} rowKey={(r) => r.key} pageSize={DEFAULT_PAGE_SIZE} sizeLabel="Result per page" footer={footer} />
              {!nothing && <p className="px-5 pb-4 text-xs text-mute sm:px-6">Difference = DOC (vendor) minus VLC (farmer). Red: the plant got less than the centre collected. Amber: it got more.</p>}
            </>
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default VarianceReport;