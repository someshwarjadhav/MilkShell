import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Phone, RefreshCw, Search } from 'lucide-react';
import { useChartColors } from '../context/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Drawer } from '../components/ui/Modal';
import { Field, Input, Select } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { KindChip, KindDot } from '../components/KindChip';
import { ChartTip } from '../components/ChartTip';
import { LoadingBlock, Notice } from '../components/Widget';
import { addDays, fmtDate, fmtShort, inr, nf, todayISO } from '../lib/format';
import { DEFAULT_PAGE_SIZE } from '../lib/global';
import { KIND_META, type Kind } from '../services/utils/milk';
import { buildFarmerBook, farmerDaily, sampleStamp, type BookFarmer } from '../services/farmer/farmerBook';
import { useCenters } from '../hooks/useSessionData';
import { isLoadingQ, useFarmerMaster, useSamples } from '../hooks/useSmartxData';
import { getSession } from '../services/session';
import { vlccOption } from '../services/vlcc/names';
import { refetchAll } from '../hooks/useQuery';

const PERIOD_DAYS = 30;

const Farmers: React.FC = () => {
  const cc = useChartColors();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const from = addDays(today, -(PERIOD_DAYS - 1));
  const vlccIds = getSession()?.vlccIds ?? [];
  const centers = useCenters(); // loaded once at sign-in (getCenter)
  const [q, setQ] = useState('');
  const [center, setCenter] = useState('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const master = useFarmerMaster();
  const samples = useSamples(from, today);
  const book = useMemo(() => buildFarmerBook(master.rows, samples.rows, today), [master.rows, samples.rows, today]);

  useEffect(() => { const o = params.get('open'); if (o) setOpenKey(o); }, [params]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return book
      .filter((f) => center === 'all' || f.vlccid === center)
      .filter((f) => status === 'all' || (status === 'inactive' ? f.active === false : f.active !== false))
      .filter((f) => !s || f.name.toLowerCase().includes(s) || f.farmerId.includes(s) || f.village.toLowerCase().includes(s) || f.phone.includes(s));
  }, [book, q, center, status]);

  const cols: Column<BookFarmer>[] = [
    { key: 'id', header: 'ID', sort: (f) => f.farmerId.padStart(8, '0'), cell: (f) => f.farmerId },
    { key: 'name', header: 'Farmer', sort: (f) => f.name, cell: (f) => <div><p className="font-semibold">{f.name}</p><p className="text-xs text-mute">{f.village || '—'}</p></div> },
    { key: 'vlcc', header: 'Centre (VLC)', sort: (f) => vlccOption(f.vlccid), cell: (f) => (f.vlccid ? vlccOption(f.vlccid) : '—') },
    { key: 'milk', header: 'Milk types', cell: (f) => <div className="flex gap-1">{f.milks.length ? f.milks.map((m) => <KindChip key={m} kind={m} compact />) : '—'}</div> },
    { key: 'week', header: 'Last 7 days', align: 'right', sort: (f) => f.week, cell: (f) => <span className="font-bold">{nf(f.week, 1)} L</span> },
    { key: 'period', header: `Last ${PERIOD_DAYS} days`, align: 'right', sort: (f) => f.period, cell: (f) => `${nf(f.period, 1)} L` },
    { key: 'amount', header: 'Amount', align: 'right', sort: (f) => f.amount, cell: (f) => inr(f.amount) },
    { key: 'status', header: 'Status', cell: (f) => f.active === false ? <Badge tone="neutral" dot>Inactive</Badge> : f.period > 0 ? <Badge tone="ok" dot>Pouring</Badge> : <Badge tone="warn" dot>No milk</Badge> },
  ];

  const open = book.find((f) => f.key === openKey) ?? null;
  const detail = useMemo(() => {
    if (!open) return null;
    const series = farmerDaily(open.samples, today, 14);
    const byKind = (['cow', 'buffalo', 'mix', 'goat'] as Kind[]).map((k) => {
      const rs = open.samples.filter((r) => r.milk === k);
      const liter = rs.reduce((a, r) => a + r.liter, 0);
      return { k, liter, amount: rs.reduce((a, r) => a + r.amount, 0), fat: liter ? rs.reduce((a, r) => a + r.liter * r.fat, 0) / liter : 0, snf: liter ? rs.reduce((a, r) => a + r.liter * r.snf, 0) / liter : 0 };
    }).filter((x) => x.liter > 0);
    const recent = [...open.samples].sort((a, b) => (sampleStamp(a) < sampleStamp(b) ? 1 : -1)).slice(0, 8);
    return { series, byKind, recent };
  }, [open, today]);

  const close = () => { setOpenKey(null); if (params.get('open')) setParams({}); };
  const loading = isLoadingQ(master.q) && isLoadingQ(samples.q);
  const fetching = master.q.fetching || samples.q.fetching;
  const masterNote = master.q.status === 'error' ? `The farmer master list could not be loaded (${master.q.error?.message ?? 'server error'}). Showing farmers found in the collection data only.` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmers"
        subtitle={loading ? 'Loading farmers from the SmartX portal…' : `${book.length} farmers across ${new Set(book.map((f) => f.vlccid)).size} centres. Open a farmer to see their last 30 days.`}
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} loading={fetching} onClick={refetchAll}>Refresh</Button>}
      />
      <Card>
        <div className="grid gap-4 border-b border-line p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[1.5fr_1.5fr_1fr]">
          <Field label="Search"><Input icon={<Search size={16} />} placeholder="Name, ID, village or phone" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <Field label="Centre (VLC)"><Select value={center} onChange={(e) => setCenter(e.target.value)}><option value="all">All centres</option>{centers.length ? centers.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.id}</option>) : vlccIds.map((id) => <option key={id} value={id}>{vlccOption(id)}</option>)}</Select></Field>
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'inactive')}><option value="all">All farmers</option><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
        </div>
        {masterNote && <p className="px-5 pt-3 text-xs text-mute sm:px-6">{masterNote}</p>}
        <Notice q={samples.q} />
        {loading
          ? <LoadingBlock height="h-72" q={samples.q} />
          : <DataTable columns={cols} rows={rows} rowKey={(f) => f.key} pageSize={DEFAULT_PAGE_SIZE} pageSizes={[10, 25, 50, 100, 250]} onRowClick={(f) => setOpenKey(f.key)} empty={<p className="px-6 py-10 text-center text-sm text-mute">No farmers found for these filters.</p>} />}
      </Card>

      <Drawer open={!!open} onClose={close} title={open?.name ?? ''} subtitle={open ? `Farmer ${open.farmerId} · ${vlccOption(open.vlccid)}${open.village ? ` · ${open.village}` : ''}` : ''}>
        {open && detail && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[{ l: `Litres (${PERIOD_DAYS} d)`, v: nf(open.period, 1) }, { l: 'Average fat', v: open.avgFat.toFixed(2) }, { l: `Earned (${PERIOD_DAYS} d)`, v: inr(open.amount) }].map((x) => (
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
