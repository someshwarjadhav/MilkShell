import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplets, FlaskConical, IndianRupee, RefreshCw, Users, Beaker, Info } from 'lucide-react';
import { useChartColors } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { Segmented, Select } from '../components/ui/Fields';
import { Badge } from '../components/ui/Badge';
import { DataTable, type Column } from '../components/ui/DataTable';
import { MilkTank } from '../components/MilkTank';
import { KindChip, KindDot } from '../components/KindChip';
import { ChartTip } from '../components/ChartTip';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingBlock, QueryBoundary } from '../components/Widget';
import { MILK_META } from '../lib/milk';
import { fmtDate, fmtShort, nf, todayISO } from '../lib/format';
import { KIND_META, type Kind } from '../services/utils/milk';
import { buildTrend, mapTop, type TopSupplier } from '../services/mappers/dashboard.mapper';
import { farmerTotals, mapFarmers } from '../services/mappers/farmer.mapper';
import { mapVlcc, totalsOf } from '../services/mappers/vlcc.mapper';
import { fetchFarmerCollection } from '../services/farmer/farmer.service';
import { fetchLineChart, fetchTopSuppliers } from '../services/dashboard/dashboard.service';
import { fetchVlccCollection } from '../services/vlcc/vlcc.service';
import { getSession } from '../services/session';
import { vlccName } from '../services/vlcc/names';
import { buildCenters } from '../services/mappers/center.mapper';
import { sampleDayCheck } from '../dev/selfcheck';
import { refetchAll, useQuery, type QueryState } from '../hooks/useQuery';
import type { RawFarmerRow, RawLinePoint, RawTopSupplier, RawVlccRow } from '../services/types/raw';

const isLoading = (q: QueryState<unknown>) => q.status === 'loading' || (q.fetching && q.rows.length === 0);
const errorOf = (q: QueryState<unknown>) => (q.status === 'error' ? q.error?.message ?? 'This data could not be loaded.' : undefined);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const cc = useChartColors();
  const [range, setRange] = useState<'7' | '14' | '30'>('30');
  const [center, setCenter] = useState<string>('ALL');
  const today = todayISO();
  const ids = getSession()?.vlccIds ?? [];
  const idKey = ids.join(',');

  // Every widget loads on its own, so one slow endpoint never blocks the others.
  // Priorities: 0 = what the top card shows, 1 = the chart, 2 = background (top suppliers, farmer count).
  const lineQ = useQuery<RawLinePoint>(`line:${idKey}`, (emit) => fetchLineChart(ids, emit, 1));
  // One VLC picked in the dropdown has its own request; "All" reuses lineQ.
  const centerLineQ = useQuery<RawLinePoint>(center === 'ALL' ? null : `line:${center}`, (emit) => fetchLineChart([center], emit, 0));
  const chartQ = center === 'ALL' ? lineQ : centerLineQ;
  const topQ = useQuery<RawTopSupplier>(`top:${idKey}`, (emit) => fetchTopSuppliers(ids, emit, 2));

  // Today's totals are asked for IMMEDIATELY (one request), in parallel with the chart. Only when today has no milk yet
  // (before the first morning collection) the card falls back to the latest day that has collection, taken from the line chart.
  const vlccToday = useQuery<RawVlccRow>(`vlcc:${today}:${today}:Z:ALL:${idKey}`, (emit) =>
    fetchVlccCollection({ from: today, to: today, shift: 'Z', milk: 'ALL', vlccIds: ids, priority: 0 }, emit));
  const todayHasMilk = useMemo(() => mapVlcc(vlccToday.rows).some((r) => r.liter > 0), [vlccToday.rows]);
  const todayDone = (vlccToday.status === 'ready' && !vlccToday.fetching) || vlccToday.status === 'error';
  const needFallback = todayDone && !todayHasMilk;

  const trend30 = useMemo(() => buildTrend(lineQ.rows, today, 30), [lineQ.rows, today]);
  const latest = useMemo(() => [...trend30.days].reverse().find((d) => d.total > 0)?.date, [trend30]);
  // "Settled" = every centre has answered (or saved data from the last visit is on screen). A half-loaded chart must not pick the day.
  const lineSettled = (lineQ.status === 'ready' && (!lineQ.fetching || lineQ.stale)) || lineQ.status === 'error';
  const day: string | null = !needFallback ? today : lineSettled ? latest ?? today : null;
  const pending = day === null;
  const isToday = day === today;
  const when = isToday || !day ? 'today' : `on ${fmtShort(day)}`;

  const vlccPrev = useQuery<RawVlccRow>(day && day !== today ? `vlcc:${day}:${day}:Z:ALL:${idKey}` : null, (emit) =>
    fetchVlccCollection({ from: day!, to: day!, shift: 'Z', milk: 'ALL', vlccIds: ids, priority: 0 }, emit));
  const vlccQ: QueryState<RawVlccRow> = pending ? { ...vlccToday, status: 'loading', rows: [] } : day === today ? vlccToday : vlccPrev;
  const farmerQ = useQuery<RawFarmerRow>(day ? `farmer:${day}:${day}:Z:ALL:${idKey}` : null, (emit) =>
    fetchFarmerCollection({ from: day!, to: day!, shift: 'Z', milk: 'ALL', vlccIds: ids, priority: 2 }, emit));

  const vlccRows = useMemo(() => mapVlcc(vlccQ.rows), [vlccQ.rows]);
  const t = useMemo(() => totalsOf(vlccRows), [vlccRows]);
  const farmerRows = useMemo(() => mapFarmers(farmerQ.rows), [farmerQ.rows]);
  const farmers = useMemo(() => farmerTotals(farmerRows).farmers, [farmerRows]);

  useEffect(() => {
    if (!import.meta.env.DEV || vlccQ.fetching || farmerQ.fetching) return;
    const res = sampleDayCheck(vlccRows, farmerRows);
    if (res) console.table(res.map((r) => ({ check: r.name, expected: r.expected, actual: Number(r.actual.toFixed(2)), result: r.ok ? 'PASS' : 'FAIL' })));
  }, [vlccRows, farmerRows, vlccQ.fetching, farmerQ.fetching]);
  const trend = useMemo(() => buildTrend(chartQ.rows, today, Number(range)), [chartQ.rows, today, range]);
  const centers = useMemo(() => buildCenters(ids, getSession()?.vlccNames ?? {}, vlccRows), [idKey, vlccRows]); // eslint-disable-line react-hooks/exhaustive-deps
  const centerLabel = center === 'ALL' ? 'All centres' : centers.find((c) => c.id === center)?.label ?? center;
  const top = useMemo(() => mapTop(topQ.rows, 10), [topQ.rows]);

  // "A usual day" = average of the 14 days before today, from the same line-chart data.
  const target = useMemo(() => {
    const last14 = trend30.days.slice(-15, -1);
    const avg = last14.reduce((a, p) => a + Math.max(0, p.total), 0) / Math.max(1, last14.length);
    return Math.round(avg / 50) * 50;
  }, [trend30]);
  const fill = target ? Math.min(100, (t.liter / target) * 100) : 0;

  const kinds: Kind[] = ['cow', 'buffalo', 'goat', ...(t.byKind.mix > 0 ? (['mix'] as Kind[]) : [])];
  const donut = (['cow', 'buffalo', 'goat', 'mix'] as Kind[])
    .filter((k) => t.byKind[k] > 0)
    .map((k) => ({ name: KIND_META[k].label, value: Math.round(t.byKind[k]), color: KIND_META[k].hex }));

  const shiftBars = useMemo(() => {
    const list: Kind[] = ['cow', 'buffalo', 'mix'];
    if (vlccRows.some((r) => r.milk === 'goat')) list.splice(2, 0, 'goat');
    return list.map((k) => ({
      name: KIND_META[k].label,
      morning: Math.round(vlccRows.filter((r) => r.milk === k && r.shift === 'Morning').reduce((a, r) => a + r.liter, 0)),
      evening: Math.round(vlccRows.filter((r) => r.milk === k && r.shift === 'Evening').reduce((a, r) => a + r.liter, 0)),
    }));
  }, [vlccRows]);

  const centres = useMemo(() => {
    const byId = new Map<string, { name: string; liter: number }>();
    const known = getSession()?.vlccNames ?? {};
    ids.forEach((id) => byId.set(id, { name: vlccName(id) || known[id] || `VLC ${id}`, liter: 0 }));
    for (const r of vlccRows) {
      const c = byId.get(r.vlccid) ?? { name: vlccName(r.vlccid) || known[r.vlccid] || `VLC ${r.vlccid}`, liter: 0 };
      if (r.village) c.name = r.village;
      c.liter += r.liter;
      byId.set(r.vlccid, c);
    }
    return [...byId.entries()].map(([id, c]) => ({ id, ...c }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vlccRows, idKey]);
  const maxCentre = Math.max(1, ...centres.map((c) => c.liter));

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const vlccLoading = isLoading(vlccQ);
  const vlccError = errorOf(vlccQ);

  const cols: Column<TopSupplier>[] = [
    { key: 'rank', header: 'Sr No', cell: (r) => <span className="font-bold text-mute">{top.indexOf(r) + 1}</span>, className: 'w-10' },
    { key: 'name', header: 'Farmer', sort: (r) => r.farmerName, cell: (r) => <div><p className="font-semibold">{r.farmerName}</p><p className="text-xs text-mute">ID {r.farmerId}</p></div> },
    { key: 'village', header: 'Village', sort: (r) => r.village, cell: (r) => r.village },
    { key: 'milk', header: 'Milk', cell: (r) => <KindChip kind={r.milk} label={r.milkLabel} compact /> },
    { key: 'liter', header: 'Litres', align: 'right', sort: (r) => r.liter, cell: (r) => <span className="font-bold">{nf(r.liter, 1)}</span> },
    { key: 'fat', header: 'Fat', align: 'right', sort: (r) => r.fat, cell: (r) => r.fat.toFixed(2) },
    { key: 'snf', header: 'SNF', align: 'right', sort: (r) => r.snf, cell: (r) => r.snf.toFixed(2) },
  ];

  const subtitle = !day || vlccLoading
    ? `${fmtDate(today)} · Loading the latest collection…`
    : isToday
      ? `${fmtDate(today)} · ${t.count} samples tested so far today across ${t.vlcCount} centres.`
      : `${fmtDate(today)} · No milk collected yet today. Showing the latest day with collection, ${fmtDate(day)}: ${t.count} samples across ${t.vlcCount} centres.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greet}, ${user?.name.split(' ')[0] ?? 'there'}`}
        subtitle={subtitle}
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => { refetchAll(); toast('Refreshing all widgets'); }}>Refresh data</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title={`Milk received ${when}`}
            subtitle={target ? `Against a usual day of ${nf(target)} L` : 'Usual day not available yet'}
            action={<Badge tone={fill > 85 ? 'ok' : 'brand'} dot>{Math.round(fill)}% of usual</Badge>}
          />
          <QueryBoundary q={vlccQ} showWhenEmpty skeleton={<LoadingBlock height="h-72" q={vlccQ} />}>
            <div className="grid items-center gap-4 p-6 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto"><MilkTank percent={fill} height={290} /></div>
              <div className="space-y-4">
                <div>
                  <p className="font-display text-5xl font-extrabold leading-none tnum">{nf(t.liter)}<span className="ml-1 text-xl font-bold text-mute">L</span></p>
                  <p className="mt-1 text-sm text-mute">{nf(t.kg)} kg · {farmerQ.status === 'ready' ? `${farmers} farmers` : 'farmers loading…'}</p>
                </div>
                <ul className="space-y-3">
                  {kinds.map((k) => (
                    <li key={k}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-semibold"><KindDot kind={k} />{KIND_META[k].label} {k !== 'mix' && <span className="hidden text-xs font-normal text-mute 2xl:inline">{MILK_META[k].local}</span>}</span>
                        <span className="whitespace-nowrap tnum font-bold">{nf(t.byKind[k])} L</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft"><div className={`h-full rounded-full ${KIND_META[k].bar} transition-all duration-1000`} style={{ width: `${t.liter ? (t.byKind[k] / t.liter) * 100 : 0}%` }} /></div>
                      <p className="mt-1 text-xs text-mute">Fat {t.byKindFat[k].toFixed(2)} · SNF {t.byKindSnf[k].toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </QueryBoundary>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="Average fat" value={t.avgFat} decimals={2} suffix="%" icon={<FlaskConical size={18} />} tone="text-cow" loading={vlccLoading} error={vlccError} onRetry={vlccQ.retry} hint="Weighted by litres" />
          <StatCard label="Average SNF" value={t.avgSnf} decimals={2} suffix="%" icon={<Beaker size={18} />} tone="text-buffalo" loading={vlccLoading} error={vlccError} onRetry={vlccQ.retry} hint="Weighted by litres, across all milk" />
          <StatCard label={`Farmers ${when}`} value={farmers} icon={<Users size={18} />} tone="text-goat" loading={isLoading(farmerQ)} error={errorOf(farmerQ)} onRetry={farmerQ.retry} hint="Unique farmers who poured milk" />
          <StatCard label={`Payable ${when}`} value={t.amount} prefix="₹" icon={<IndianRupee size={18} />} tone="text-brand" loading={vlccLoading} error={vlccError} onRetry={vlccQ.retry} hint="At the portal's rates" />
        </div>
      </div>

      <Card>
        <CardHeader
          title="Monthly collection"
          subtitle={`Litres per day, split by milk type · ${centerLabel}`}
          action={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Select aria-label="Centre" value={center} onChange={(e) => setCenter(e.target.value)} className="min-w-[220px]">
                <option value="ALL">All</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
              <Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} />
            </div>
          }
        />
        <QueryBoundary q={chartQ} skeleton={<LoadingBlock height="h-[320px]" />} emptyTitle="No collection in this period" emptyHint="The portal returned no days with milk for this selection.">
          <div className="h-[320px] px-2 pb-4 pt-4 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.days} margin={{ left: 0, right: 12, top: 8 }}>
                <defs>{(['cow', 'buffalo', 'mix'] as const).map((k) => (<linearGradient key={k} id={`area-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={KIND_META[k].hex} stopOpacity=".5" /><stop offset="1" stopColor={KIND_META[k].hex} stopOpacity=".04" /></linearGradient>))}</defs>
                <CartesianGrid stroke={cc.grid} vertical={false} />
                <XAxis dataKey="label" tickFormatter={(l: string) => l.slice(0, 6)} tick={{ fill: cc.tick, fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis domain={[0, 'auto']} allowDataOverflow tick={{ fill: cc.tick, fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip format={(v) => `${nf(v, 1)} L`} />} />
                {(['cow', 'buffalo', 'mix'] as const).map((k) => <Area key={k} type="monotone" dataKey={k} name={KIND_META[k].label} stackId="1" stroke={KIND_META[k].hex} strokeWidth={2} fill={`url(#area-${k})`} animationDuration={900} />)}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {trend.hasNegative && (
            <p className="flex items-center gap-1.5 px-5 pb-4 text-xs text-mute sm:px-6"><Info size={13} />Some days have a negative litre total (stock corrections). The chart starts at 0; the exact values are in the tooltip data.</p>
          )}
        </QueryBoundary>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={`Milk mix ${when}`} subtitle="Share of litres by type" />
          <QueryBoundary q={vlccQ} showWhenEmpty skeleton={<LoadingBlock height="h-48" />}>
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" innerRadius={60} outerRadius={86} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={900}>{donut.map((x) => <Cell key={x.name} fill={x.color} />)}</Pie>
                  <Tooltip content={<ChartTip format={(v) => `${nf(v)} L`} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-2xl font-extrabold tnum">{nf(t.liter)}</p><p className="text-xs text-mute">litres</p></div></div>
            </div>
            <div className="flex justify-center gap-4 pb-5 text-xs font-semibold">{donut.map((x) => <span key={x.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{x.name}</span>)}</div>
          </QueryBoundary>
        </Card>

        <Card>
          <CardHeader title="Morning vs evening" subtitle={`${isToday ? 'Today' : fmtDate(day!)}, litres by milk type`} />
          <QueryBoundary q={vlccQ} skeleton={<LoadingBlock height="h-48" />} emptyTitle={`No collection ${when}`}>
            <div className="h-60 px-2 pb-4 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shiftBars} margin={{ left: 0, right: 8 }} barGap={3}>
                  <CartesianGrid stroke={cc.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: cc.tick, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: cc.tick, fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip cursor={{ fill: cc.grid, opacity: 0.5 }} content={<ChartTip format={(v) => `${nf(v)} L`} />} />
                  <Bar dataKey="morning" name="Morning" fill={cc.brand} radius={[6, 6, 0, 0]} animationDuration={900} />
                  <Bar dataKey="evening" name="Evening" fill="#F2C86B" radius={[6, 6, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </QueryBoundary>
        </Card>

        <Card>
          <CardHeader
            title={`Centres ${when}`}
            subtitle="Litres received per centre"
            action={
              centres.length > 5 ? (
                <Link
                  to="/centers"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  View all 
                </Link>
              ) : undefined
            }
          />
          <QueryBoundary q={vlccQ} showWhenEmpty skeleton={<LoadingBlock height="h-48" />}>
            <ul className="space-y-4 p-5 sm:p-6">
              {centres.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${c.liter > 0 ? 'bg-ok' : 'bg-mute/40'}`} />{c.name}</span><span className="tnum font-bold">{nf(c.liter)} L</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand transition-all duration-1000" style={{ width: `${(c.liter / maxCentre) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
            {centres.length > 5 && (
              <div className="border-t border-line px-5 py-3 sm:px-6">
                <Link
                  to="/centers"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-mute transition-colors hover:bg-soft hover:text-ink"
                >
                  View all centres →
                </Link>
              </div>
            )}
          </QueryBoundary>
        </Card>
      </div>

      <Card>
        <CardHeader title="Top suppliers" subtitle="Ranked by litres poured" />
        <div className="mt-3 pb-2">
          <QueryBoundary q={topQ} emptyTitle="No supplier data yet" emptyHint="The portal returned no suppliers for your centres.">
            <DataTable columns={cols} rows={top} rowKey={(r) => r.key} pageSize={10} pageSizes={[10]} empty={<div className="px-6 py-10 text-center text-sm text-mute"><Droplets className="mx-auto mb-2" />No suppliers yet.</div>} />
          </QueryBoundary>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
