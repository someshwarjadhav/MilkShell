import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Download, FileSpreadsheet, FileText, Phone, RotateCcw, Search } from 'lucide-react';
import { useChartColors } from '../context/ThemeContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Drawer } from '../components/ui/Modal';
import { Field, Input, Select } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { KindChip, KindDot } from '../components/KindChip';
import { ChartTip } from '../components/ChartTip';
import { ErrorBlock, Notice } from '../components/Widget';
import { MilkLoader } from '../components/MilkLoader';
import { useToast } from '../context/ToastContext';
import { exportCSV, exportExcel, exportPDF, type ExportCol } from '../lib/export';
import { addDays, fmtDate, fmtShort, inr, nf, todayISO } from '../lib/format';
import { DEFAULT_PAGE_SIZE, GLOBALSMILK, GLOBALSSHIFT } from '../lib/global';
import { KIND_META, type Kind } from '../services/utils/milk';
import { buildFarmerBook, farmerDaily, sampleStamp, type BookFarmer } from '../services/farmer/farmerBook';
import { useCenters } from '../hooks/useSessionData';
import { isLoadingQ, useFarmerMaster } from '../hooks/useSmartxData';
import { mapFarmers } from '../services/mappers/farmer.mapper';
import { fetchFarmerCollection } from '../services/farmer/farmer.service';
import type { MilkCode, RawFarmerRow, ShiftCode } from '../services/types/raw';
import { getSession } from '../services/session';
import { vlccOption } from '../services/vlcc/names';
import { useQuery } from '../hooks/useQuery';

type Show = 'poured' | 'all' | 'nomilk' | 'inactive';
interface Applied { from: string; to: string; shift: ShiftCode; milk: MilkCode | 'ALL'; vlcc: string }

const Farmers: React.FC = () => {
  const cc = useChartColors();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const sessionIds = getSession()?.vlccIds ?? [];
  const centers = useCenters(); 


  const [vlcc, setVlcc] = useState('all');
  const [milk, setMilk] = useState<'all' | MilkCode>('all');
  const [shift, setShift] = useState<ShiftCode>('Z');
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState<Applied | null>(null);

  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('poured');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const ids = applied ? (applied.vlcc === 'all' ? sessionIds : [applied.vlcc]) : [];
  const key = applied ? `farmerspage:${applied.from}:${applied.to}:${applied.shift}:${applied.milk}:${ids.join(',')}` : null;
  const samplesQ = useQuery<RawFarmerRow>(key, (emit) =>
    fetchFarmerCollection({ from: applied!.from, to: applied!.to, shift: applied!.shift, milk: applied!.milk, vlccIds: ids, priority: 0 }, emit));
  const samples = useMemo(() => mapFarmers(samplesQ.rows), [samplesQ.rows]);
  const master = useFarmerMaster(applied !== null);
  const end = applied?.to ?? today;
  const book = useMemo(() => (applied ? buildFarmerBook(master.rows, samples, end) : []), [applied, master.rows, samples, end]);

  const submit = () => {
    const next: Applied = { from, to, shift, milk: milk === 'all' ? 'ALL' : milk, vlcc };
    const same = applied && applied.from === next.from && applied.to === next.to && applied.shift === next.shift && applied.milk === next.milk && applied.vlcc === next.vlcc;
    if (same) samplesQ.retry(); 
    else setApplied(next);
  };
  const reset = () => { setVlcc('all'); setMilk('all'); setShift('Z'); setFrom(addDays(today, -6)); setTo(today); setQ(''); setShow('poured'); setApplied(null); };

  useEffect(() => { const o = params.get('open'); if (o) setOpenKey(o); }, [params]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return book
      .filter((f) => applied?.vlcc === 'all' || !applied || f.vlccid === applied.vlcc)
      .filter((f) => show === 'all' || (show === 'poured' ? f.period > 0 : show === 'nomilk' ? f.period === 0 && f.active !== false : f.active === false))
      .filter((f) => !s || f.name.toLowerCase().includes(s) || f.farmerId.includes(s) || f.village.toLowerCase().includes(s) || f.phone.includes(s));
  }, [book, q, show, applied]);

  const rangeLabel = applied ? `${fmtShort(applied.from)} – ${fmtShort(applied.to)}` : '';

  const cols: Column<BookFarmer>[] = [
    { key: 'id', header: 'ID', sort: (f) => f.farmerId.padStart(8, '0'), cell: (f) => f.farmerId },
    { key: 'name', header: 'Farmer', sort: (f) => f.name, cell: (f) => <div><p className="font-semibold">{f.name}</p><p className="text-xs text-mute">{f.village || '—'}</p></div> },
    { key: 'vlcc', header: 'Centre (VLC)', sort: (f) => vlccOption(f.vlccid), cell: (f) => (f.vlccid ? vlccOption(f.vlccid) : '—') },
    { key: 'milk', header: 'Milk types', cell: (f) => <div className="flex gap-1">{f.milks.length ? f.milks.map((m) => <KindChip key={m} kind={m} compact />) : '—'}</div> },
    { key: 'week', header: 'Last 7 days of range', align: 'right', sort: (f) => f.week, cell: (f) => <span className="font-bold">{nf(f.week, 1)} L</span> },
    { key: 'period', header: 'Litres (range)', align: 'right', sort: (f) => f.period, cell: (f) => `${nf(f.period, 1)} L` },
    { key: 'amount', header: 'Amount', align: 'right', sort: (f) => f.amount, cell: (f) => inr(f.amount) },
    { key: 'status', header: 'Status', cell: (f) => f.active === false ? <Badge tone="neutral" dot>Inactive</Badge> : f.period > 0 ? <Badge tone="ok" dot>Pouring</Badge> : <Badge tone="warn" dot>No milk</Badge> },
  ];

  const open = book.find((f) => f.key === openKey) ?? null;
  const detail = useMemo(() => {
    if (!open) return null;
    const series = farmerDaily(open.samples, end, 14);
    const byKind = (['cow', 'buffalo', 'mix', 'goat'] as Kind[]).map((k) => {
      const rs = open.samples.filter((r) => r.milk === k);
      const liter = rs.reduce((a, r) => a + r.liter, 0);
      return { k, liter, amount: rs.reduce((a, r) => a + r.amount, 0), fat: liter ? rs.reduce((a, r) => a + r.liter * r.fat, 0) / liter : 0, snf: liter ? rs.reduce((a, r) => a + r.liter * r.snf, 0) / liter : 0 };
    }).filter((x) => x.liter > 0);
    const recent = [...open.samples].sort((a, b) => (sampleStamp(a) < sampleStamp(b) ? 1 : -1)).slice(0, 8);
    return { series, byKind, recent };
  }, [open, end]);

  const close = () => { setOpenKey(null); if (params.get('open')) setParams({}); };
  const loading = applied !== null && (isLoadingQ(samplesQ) || (isLoadingQ(master.q) && samplesQ.rows.length === 0));
  const fetching = samplesQ.fetching;
  const failed = applied !== null && samplesQ.status === 'error';
  const masterNote = master.q.status === 'error' ? `The farmer master list could not be loaded (${master.q.error?.message ?? 'server error'}). Showing farmers found in the collection data only.` : null;
  const ready = applied !== null && !loading && !failed;

  const exportCols: ExportCol<BookFarmer>[] = [
    { header: 'Farmer Id', value: (f) => f.farmerId }, { header: 'Farmer', value: (f) => f.name }, { header: 'Village', value: (f) => f.village },
    { header: 'Centre', value: (f) => (f.vlccid ? vlccOption(f.vlccid) : '') }, { header: 'Milk types', value: (f) => f.milks.map((m) => KIND_META[m].label).join(', ') },
    { header: 'Last 7 days of range (L)', value: (f) => f.week }, { header: 'Litres (range)', value: (f) => f.period }, { header: 'Avg Fat', value: (f) => f.avgFat }, { header: 'Avg SNF', value: (f) => f.avgSnf }, { header: 'Amount', value: (f) => f.amount },
  ];
  const run = (kind: 'csv' | 'xls' | 'pdf') => {
    const fn = kind === 'csv' ? exportCSV : kind === 'xls' ? exportExcel : exportPDF;
    fn(`farmers-${applied?.from}-to-${applied?.to}`, exportCols, rows);
    toast(kind === 'pdf' ? 'Print dialog opened — choose Save as PDF to download' : `${kind.toUpperCase()} file downloaded`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmers"
        subtitle={!applied ? 'Choose the centre, milk type, shift and dates, then press Submit.' : loading ? 'Loading farmers from the SmartX portal…' : `${rows.length} farmers for ${rangeLabel}. Open a farmer to see their milk in this range.`}
      />

      <Card>
        <CardHeader title="User Info" subtitle="The portal can take up to a minute to answer." action={<Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={reset}>Reset</Button>} />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <Field label="VLC Name"><Select value={vlcc} onChange={(e) => setVlcc(e.target.value)}><option value="all">All centres</option>{centers.length ? centers.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.id}</option>) : sessionIds.map((id) => <option key={id} value={id}>{vlccOption(id)}</option>)}</Select></Field>
          <Field label="Milk Type"><Select value={milk} onChange={(e) => setMilk(e.target.value as 'all' | MilkCode)}><option value="all">All milk</option>{GLOBALSMILK.milkOptions.map((m) => <option key={m.Id} value={m.Id}>{m.Name}</option>)}</Select></Field>
          <Field label="Shift"><Select value={shift} onChange={(e) => setShift(e.target.value as ShiftCode)}>{GLOBALSSHIFT.shiftOptions.map((m) => <option key={m.Id} value={m.Id}>{m.Name}</option>)}</Select></Field>
          <Field label="Show"><Select value={show} onChange={(e) => setShow(e.target.value as Show)}><option value="poured">Farmers who poured milk</option><option value="all">All registered farmers</option><option value="nomilk">Active, no milk</option><option value="inactive">Inactive</option></Select></Field>
          <Field label="From Date"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To Date"><Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="flex items-end sm:col-span-2"><Button className="w-full" icon={<Search size={16} />} onClick={submit} loading={fetching && samplesQ.rows.length === 0} disabled={!from || !to}>Submit</Button></div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            {ready ? <Badge tone="brand">Record Count: {nf(rows.length)}</Badge> : <span className="text-sm text-mute">Record Count: 0</span>}
            {ready && <div className="w-full min-w-[220px] sm:w-72"><Input icon={<Search size={16} />} placeholder="Name, ID, village or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" icon={<FileSpreadsheet size={15} />} onClick={() => run('xls')} disabled={!ready || rows.length === 0}>Excel</Button>
            <Button size="sm" variant="soft" icon={<Download size={15} />} onClick={() => run('csv')} disabled={!ready || rows.length === 0}>CSV</Button>
            <Button size="sm" variant="soft" icon={<FileText size={15} />} onClick={() => run('pdf')} disabled={!ready || rows.length === 0}>Print / PDF</Button>
          </div>
        </div>
        {masterNote && <p className="px-5 pt-3 text-xs text-mute sm:px-6">{masterNote}</p>}
        {applied && <Notice q={samplesQ} />}
        {!applied
          ? <p className="px-6 py-14 text-center text-sm text-mute">Press Submit to load the farmers.</p>
          : loading
            ? <MilkLoader variant="image" label="Loading farmers…" />
            : failed
              ? <ErrorBlock message={samplesQ.error?.message ?? 'The farmers could not be loaded.'} onRetry={samplesQ.retry} busy={fetching} />
              : <DataTable columns={cols} rows={rows} rowKey={(f) => f.key} pageSize={DEFAULT_PAGE_SIZE} pageSizes={[10, 25, 50, 100, 250]} sizeLabel="Result per page" onRowClick={(f) => setOpenKey(f.key)} empty={<p className="px-6 py-10 text-center text-sm text-mute">No farmers found for these filters.</p>} />}
      </Card>

      <Drawer open={!!open} onClose={close} title={open?.name ?? ''} subtitle={open ? `Farmer ${open.farmerId} · ${vlccOption(open.vlccid)}${open.village ? ` · ${open.village}` : ''}` : ''}>
        {open && detail && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[{ l: `Litres`, v: nf(open.period, 1) }, { l: 'Average fat', v: open.avgFat.toFixed(2) }, { l: `Earned`, v: inr(open.amount) }].map((x) => (
                <div key={x.l} className="rounded-2xl bg-soft p-3"><p className="text-xs text-mute">{x.l}</p><p className="font-display text-xl font-extrabold tnum">{x.v}</p></div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Last 14 days</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={detail.series}>
                    <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fill: cc.tick, fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={16} />
                    <Tooltip cursor={{ fill: cc.grid, opacity: 0.5 }} content={<ChartTip format={(v) => `${nf(v, 1)} L`} title={(l) => fmtDate(String(l))} />} />
                    {(['cow', 'buffalo', 'mix', 'goat'] as Kind[]).map((k) => <Bar key={k} dataKey={k} name={KIND_META[k].label} stackId="a" fill={KIND_META[k].hex} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">By milk type</p>
              {detail.byKind.length === 0 && <p className="text-sm text-mute">No milk in this period.</p>}
              <ul className="space-y-2">
                {detail.byKind.map((x) => (
                  <li key={x.k} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                    <KindDot kind={x.k} size={36} />
                    <div className="flex-1"><p className="font-semibold">{KIND_META[x.k].label}</p><p className="text-xs text-mute">Fat {x.fat.toFixed(2)} · SNF {x.snf.toFixed(2)}</p></div>
                    <div className="text-right"><p className="font-bold tnum">{nf(x.liter, 1)} L</p><p className="text-xs text-mute tnum">{inr(x.amount)}</p></div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Recent samples</p>
              <ul className="divide-y divide-line/70 text-sm">
                {detail.recent.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2 py-2"><span>{c.date} · {c.time} · {c.milk ? KIND_META[c.milk].label : c.milkLabel}</span><span className="tnum text-mute">{c.liter} L · {c.fat}/{c.snf}</span><span className="font-bold tnum">{inr(c.amount)}</span></li>
                ))}
              </ul>
            </div>
            {open.bank || open.account ? <div className="rounded-2xl bg-soft p-4 text-sm"><p className="text-xs text-mute">Bank</p><p className="font-semibold">{open.bank || '—'} · {open.account || '—'}</p>{open.ifsc && <p className="text-xs text-mute">IFSC {open.ifsc}</p>}</div> : null}
            {open.phone && <div className="flex items-center gap-3 rounded-2xl bg-soft p-4 text-sm"><Phone size={15} className="text-mute" />+91 {open.phone}</div>}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Farmers;