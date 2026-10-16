import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplets, FlaskConical, IndianRupee, RefreshCw, Users, Beaker, ArrowRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useChartColors } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { Segmented } from '../components/ui/Fields';
import { Badge } from '../components/ui/Badge';
import { DataTable, type Column } from '../components/ui/DataTable';
import { MilkTank } from '../components/MilkTank';
import { MilkTypeChip } from '../components/MilkTypeChip';
import { AnimalHead } from '../components/Illustrations';
import { ChartTip } from '../components/ChartTip';
import { PageHeader } from '../components/ui/PageHeader';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { addDays, fmtDate, fmtShort, inr, nf, todayISO } from '../lib/format';
import { dailySeries, groupBy, summarize } from '../lib/stats';
import type { MilkType } from '../types';

interface TopRow { id: string; name: string; code: string; liter: number; fat: number; amount: number; milk: MilkType[] }

const Dashboard: React.FC = () => {
  const { collections, farmerById, centers, syncAll } = useData();
  const { user } = useAuth();
  const toast = useToast();
  const cc = useChartColors();
  const [range, setRange] = useState<'7' | '14' | '30'>('30');
  const today = todayISO();

  const d = useMemo(() => {
    const todays = collections.filter((c) => c.date === today);
    const shifts = new Set(todays.map((c) => c.shift));
    const yest = collections.filter((c) => c.date === addDays(today, -1) && shifts.has(c.shift));
    const t = summarize(todays), y = summarize(yest);
    const series = dailySeries(collections, today, 30);
    const last14 = series.slice(-15, -1);
    const target = Math.round((last14.reduce((a, p) => a + p.total, 0) / Math.max(1, last14.length)) / 50) * 50;
    const byMilk = MILK_TYPES.map((m) => ({ m, ...summarize(todays.filter((c) => c.milk === m)) }));
    const centerRows = centers.map((c) => ({ c, ...summarize(todays.filter((x) => x.centerId === c.id)) }));
    const top: TopRow[] = [...groupBy(todays, (c) => c.farmerId)].map(([id, rows]) => {
      const f = farmerById.get(id)!;
      const s = summarize(rows);
      return { id, name: f.name, code: f.code, liter: s.liter, fat: s.avgFat, amount: s.amount, milk: Array.from(new Set(rows.map((r) => r.milk))) };
    }).sort((a, b) => b.liter - a.liter).slice(0, 8);
    const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
    return { t, y, series, target, byMilk, centerRows, top, dLiter: pct(t.liter, y.liter), dFat: pct(t.avgFat, y.avgFat), dSnf: pct(t.avgSnf, y.avgSnf), dAmt: pct(t.amount, y.amount) };
  }, [collections, centers, farmerById, today]);

  const series = d.series.slice(-Number(range));
  const spark = d.series.slice(-14);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const fill = d.target ? Math.min(100, (d.t.liter / d.target) * 100) : 0;
  const donut = d.byMilk.map((x) => ({ name: MILK_META[x.m].label, value: Math.round(x.liter), color: MILK_META[x.m].hex }));

  const cols: Column<TopRow>[] = [
    { key: 'rank', header: '#', cell: (r) => <span className="font-bold text-mute">{d.top.indexOf(r) + 1}</span>, className: 'w-10' },
    { key: 'name', header: 'Farmer', sort: (r) => r.name, cell: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-mute">ID {r.code}</p></div> },
    { key: 'milk', header: 'Milk', cell: (r) => <div className="flex gap-1">{r.milk.map((m) => <MilkTypeChip key={m} type={m} compact />)}</div> },
    { key: 'liter', header: 'Litres', align: 'right', sort: (r) => r.liter, cell: (r) => <span className="font-bold">{nf(r.liter, 1)}</span> },
    { key: 'fat', header: 'Avg fat', align: 'right', sort: (r) => r.fat, cell: (r) => r.fat.toFixed(2) },
    { key: 'amt', header: 'Amount', align: 'right', sort: (r) => r.amount, cell: (r) => inr(r.amount) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greet}, ${user?.name.split(' ')[0] ?? 'there'}`}
        subtitle={`${fmtDate(today)} · ${d.t.count} samples tested so far today across ${centers.length} centres.`}
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => { syncAll(); toast('Syncing all centres'); }}>Sync centres</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="Milk received today" subtitle={`Against a usual day of ${nf(d.target)} L`} action={<Badge tone={fill > 85 ? 'ok' : 'brand'} dot>{Math.round(fill)}% of usual</Badge>} />
          <div className="grid items-center gap-4 p-6 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto"><MilkTank percent={fill} height={290} /></div>
            <div className="space-y-4">
              <div>
                <p className="font-display text-5xl font-extrabold leading-none tnum">{nf(d.t.liter)}<span className="ml-1 text-xl font-bold text-mute">L</span></p>
                <p className="mt-1 text-sm text-mute">{nf(d.t.kg)} kg · {d.t.farmers} farmers</p>
              </div>
              <ul className="space-y-3">
                {d.byMilk.map((x) => (
                  <li key={x.m}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-semibold"><AnimalHead type={x.m} size={24} />{MILK_META[x.m].label} <span className="hidden text-xs font-normal text-mute 2xl:inline">{MILK_META[x.m].local}</span></span>
                      <span className="whitespace-nowrap tnum font-bold">{nf(x.liter)} L</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft"><div className={`h-full rounded-full ${MILK_META[x.m].bar} transition-all duration-1000`} style={{ width: `${d.t.liter ? (x.liter / d.t.liter) * 100 : 0}%` }} /></div>
                    <p className="mt-1 text-xs text-mute">Fat {x.avgFat.toFixed(2)} · SNF {x.avgSnf.toFixed(2)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="Average fat" value={d.t.avgFat} decimals={2} suffix="%" icon={<FlaskConical size={18} />} tone="text-cow" delta={d.dFat} spark={spark.map((p) => p.total)} hint="Weighted by litres, same shifts as yesterday" />
          <StatCard label="Average SNF" value={d.t.avgSnf} decimals={2} suffix="%" icon={<Beaker size={18} />} tone="text-buffalo" delta={d.dSnf} spark={spark.map((p) => p.buffalo + p.goat)} hint="Solids-not-fat across all milk" />
          <StatCard label="Farmers today" value={d.t.farmers} icon={<Users size={18} />} tone="text-goat" spark={spark.map((p) => p.goat + p.cow)} hint="Unique farmers who poured milk" />
          <StatCard label="Payable today" value={d.t.amount} prefix="₹" icon={<IndianRupee size={18} />} tone="text-brand" delta={d.dAmt} spark={spark.map((p) => p.total)} hint="At the current rate charts" />
        </div>
      </div>

      <Card>
        <CardHeader title="Collection trend" subtitle="Litres per day, split by milk type" action={<Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} />} />
        <div className="h-[320px] px-2 pb-4 pt-4 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 0, right: 12, top: 8 }}>
              <defs>{MILK_TYPES.map((m) => (<linearGradient key={m} id={`area-${m}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={MILK_META[m].hex} stopOpacity=".5" /><stop offset="1" stopColor={MILK_META[m].hex} stopOpacity=".04" /></linearGradient>))}</defs>
              <CartesianGrid stroke={cc.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fill: cc.tick, fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fill: cc.tick, fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTip format={(v) => `${nf(v)} L`} title={(l) => fmtDate(String(l))} />} />
              {MILK_TYPES.map((m) => <Area key={m} type="monotone" dataKey={m} name={MILK_META[m].label} stackId="1" stroke={MILK_META[m].hex} strokeWidth={2} fill={`url(#area-${m})`} animationDuration={900} />)}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Milk mix today" subtitle="Share of litres by type" />
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={60} outerRadius={86} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={900}>{donut.map((x) => <Cell key={x.name} fill={x.color} />)}</Pie>
                <Tooltip content={<ChartTip format={(v) => `${nf(v)} L`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-2xl font-extrabold tnum">{nf(d.t.liter)}</p><p className="text-xs text-mute">litres</p></div></div>
          </div>
          <div className="flex justify-center gap-4 pb-5 text-xs font-semibold">{donut.map((x) => <span key={x.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{x.name}</span>)}</div>
        </Card>

        <Card>
          <CardHeader title="Morning vs evening" subtitle="Last 7 days, litres" />
          <div className="h-60 px-2 pb-4 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.series.slice(-7)} margin={{ left: 0, right: 8 }} barGap={3}>
                <CartesianGrid stroke={cc.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fill: cc.tick, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: cc.tick, fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: cc.grid, opacity: 0.5 }} content={<ChartTip format={(v) => `${nf(v)} L`} title={(l) => fmtDate(String(l))} />} />
                <Bar dataKey="morning" name="Morning" fill={cc.brand} radius={[6, 6, 0, 0]} animationDuration={900} />
                <Bar dataKey="evening" name="Evening" fill="#F2C86B" radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Centres today" subtitle="Litres received per centre" action={<Link to="/centers" className="text-sm font-semibold text-brand">Manage</Link>} />
          <ul className="space-y-4 p-5 sm:p-6">
            {d.centerRows.map(({ c, liter }) => {
              const pct = Math.min(100, (liter / c.capacityL) * 100 * 3);
              return (
                <li key={c.id}>
                  <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${c.status === 'online' ? 'bg-ok' : c.status === 'syncing' ? 'bg-warn animate-pulse' : 'bg-danger'}`} />{c.name}</span><span className="tnum font-bold">{nf(liter)} L</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand transition-all duration-1000" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Top suppliers today" subtitle="Ranked by litres poured" action={<Link to="/collections" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">Full report <ArrowRight size={14} /></Link>} />
        <div className="mt-3 pb-2"><DataTable columns={cols} rows={d.top} rowKey={(r) => r.id} pageSize={8} pageSizes={[8]} empty={<div className="px-6 py-10 text-center text-sm text-mute"><Droplets className="mx-auto mb-2" />No collection yet today.</div>} /></div>
      </Card>
    </div>
  );
};

export default Dashboard;
