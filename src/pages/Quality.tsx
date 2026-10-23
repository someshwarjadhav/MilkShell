import type * as React from 'react';
import { useMemo, useState } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { Droplet, FlaskConical, TriangleAlert } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useChartColors } from '../context/ThemeContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Segmented } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { KindChip } from '../components/KindChip';
import { LoadingBlock, Notice } from '../components/Widget';
import { vlccTitle } from '../services/vlcc/names';
import { flagOf, FLAG_META } from '../lib/quality';
import { addDays, nf, todayISO } from '../lib/format';
import { KIND_META, type Kind } from '../services/utils/milk';
import { isoFromTrdate } from '../services/utils/date';
import { sampleStamp } from '../services/farmer/farmerBook';
import { isLoadingQ, useSamples } from '../hooks/useSmartxData';
import type { FarmerRow } from '../services/mappers/farmer.mapper';
import type { Flag } from '../types';

interface Flagged { c: FarmerRow; flag: Flag }
interface Rank { id: string; name: string; samples: number; flagged: number; rate: number; fat: number; snf: number }

const Quality: React.FC = () => {
  const { thresholds } = useData();
  const cc = useChartColors();
  const [days, setDays] = useState<'1' | '7' | '30'>('7');
  const today = todayISO();
  const { q, rows: all } = useSamples(addDays(today, -29), today);

  const rows = useMemo(() => {
    const from = addDays(today, -(Number(days) - 1));
    return all.filter((r) => { const d = isoFromTrdate(r.date); return !!d && d >= from; });
  }, [all, days, today]);
  const flagged = useMemo<Flagged[]>(() => rows.map((c) => ({ c, flag: flagOf(c, thresholds) })).filter((x): x is Flagged => x.flag !== null).sort((a, b) => (sampleStamp(a.c) < sampleStamp(b.c) ? 1 : -1)), [rows, thresholds]);
  const count = (f: Flag) => flagged.filter((x) => x.flag === f).length;

  const ranks = useMemo<Rank[]>(() => {
    const bad = new Set(flagged.map((x) => x.c.key));
    const by = new Map<string, FarmerRow[]>();
    for (const r of rows) by.set(r.farmerKey, [...(by.get(r.farmerKey) ?? []), r]);
    return [...by.entries()].map(([id, rs]) => {
      const liter = rs.reduce((a, r) => a + r.liter, 0);
      const fl = rs.filter((r) => bad.has(r.key)).length;
      return { id, name: rs[0].farmerName, samples: rs.length, flagged: fl, rate: (fl / rs.length) * 100, fat: liter ? rs.reduce((a, r) => a + r.liter * r.fat, 0) / liter : 0, snf: liter ? rs.reduce((a, r) => a + r.liter * r.snf, 0) / liter : 0 };
    }).filter((r) => r.flagged > 0).sort((a, b) => b.rate - a.rate).slice(0, 8);
  }, [rows, flagged]);

  const kinds = (['cow', 'buffalo', 'mix', 'goat'] as Kind[]).filter((k) => rows.some((r) => r.milk === k));
  const scatter = useMemo(() => {
    const step = Math.max(1, Math.ceil(rows.length / 500));
    return kinds.map((k) => ({ k, data: rows.filter((c, i) => c.milk === k && c.fat > 0 && c.snf > 0 && i % step === 0).map((c) => ({ fat: c.fat, snf: c.snf })) }));
  }, [rows]);

  const fcols: Column<Flagged>[] = [
    { key: 'when', header: 'When', sort: (x) => sampleStamp(x.c), cell: (x) => `${x.c.date} · ${x.c.time}` },
    { key: 'f', header: 'Farmer', sort: (x) => x.c.farmerName, cell: (x) => <div><p className="font-semibold">{x.c.farmerName}</p><p className="text-xs text-mute">{vlccTitle(x.c.vlccid, x.c.village)}</p></div> },
    { key: 'milk', header: 'Milk', cell: (x) => <KindChip kind={x.c.milk} label={x.c.milkLabel} /> },
    { key: 'fat', header: 'Fat', align: 'right', sort: (x) => x.c.fat, cell: (x) => x.c.fat.toFixed(1) },
    { key: 'snf', header: 'SNF', align: 'right', sort: (x) => x.c.snf, cell: (x) => x.c.snf.toFixed(1) },
    { key: 'water', header: 'Water', align: 'right', sort: (x) => x.c.water, cell: (x) => x.c.water.toFixed(2) },
    { key: 'liter', header: 'Litres', align: 'right', sort: (x) => x.c.liter, cell: (x) => nf(x.c.liter, 1) },
    { key: 'flag', header: 'Reason', cell: (x) => <Badge tone={x.flag === 'water' || x.flag === 'adulterated' ? 'danger' : 'warn'} dot>{FLAG_META[x.flag].label}</Badge> },
  ];
  const rcols: Column<Rank>[] = [
    { key: 'n', header: 'Farmer', cell: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-mute">{r.id.split(':')[1]}</p></div> },
    { key: 'fl', header: 'Flagged', align: 'right', sort: (r) => r.flagged, cell: (r) => `${r.flagged} of ${r.samples}` },
    { key: 'rate', header: 'Rate', align: 'right', sort: (r) => r.rate, cell: (r) => <Badge tone={r.rate > 15 ? 'danger' : 'warn'}>{r.rate.toFixed(0)}%</Badge> },
    { key: 'fat', header: 'Avg fat', align: 'right', cell: (r) => r.fat.toFixed(2) },
    { key: 'snf', header: 'Avg SNF', align: 'right', cell: (r) => r.snf.toFixed(2) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Quality watch" subtitle="Real samples from the portal that look thin or watered. Limits are set in Settings." actions={<Segmented value={days} onChange={setDays} options={[{ value: '1', label: 'Today' }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />} />
      <Notice q={q} />
      {isLoadingQ(q) ? <LoadingBlock height="h-72" q={q} /> : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Water suspected" value={count('water')} icon={<Droplet size={18} />} tone="text-danger" hint="SNF far below the limit" />
            <StatCard label="Added water" value={count('adulterated')} icon={<Droplet size={18} />} tone="text-danger" hint={`Water above ${thresholds.water}`} />
            <StatCard label="Low fat" value={count('low-fat')} icon={<FlaskConical size={18} />} tone="text-cow" />
            <StatCard label="Low SNF" value={count('low-snf')} icon={<TriangleAlert size={18} />} tone="text-buffalo" hint={`${rows.length} samples checked`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Fat against SNF" subtitle="Each dot is a sample." />
              <div className="h-80 px-2 pb-4 pt-4 sm:px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                    <CartesianGrid stroke={cc.grid} />
                    <XAxis type="number" dataKey="fat" name="Fat" unit="%" domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fill: cc.tick, fontSize: 12 }} tickLine={false} axisLine={{ stroke: cc.line }} />
                    <YAxis type="number" dataKey="snf" name="SNF" unit="%" domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fill: cc.tick, fontSize: 12 }} tickLine={false} axisLine={{ stroke: cc.line }} width={44} />
                    <ZAxis range={[36, 36]} />
                    <Tooltip cursor={{ strokeDasharray: '4 4', stroke: cc.tick }} contentStyle={{ background: cc.panel, border: `1px solid ${cc.line}`, borderRadius: 12, fontSize: 12 }} />
                    {scatter.map((s) => <Scatter key={s.k} name={KIND_META[s.k].label} data={s.data} fill={KIND_META[s.k].hex} fillOpacity={0.7} animationDuration={800} />)}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 pb-5 text-xs font-semibold">{kinds.map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND_META[k].hex }} />{KIND_META[k].label}</span>)}</div>
            </Card>
            <Card>
              <CardHeader title="Farmers to talk to" subtitle="Highest share of flagged samples" />
              <div className="mt-3"><DataTable columns={rcols} rows={ranks} rowKey={(r) => r.id} pageSize={8} pageSizes={[8]} empty={<p className="px-6 py-10 text-center text-sm text-mute">No farmer has flagged samples in this period.</p>} /></div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Flagged samples" subtitle={`${flagged.length} in the selected period`} />
            <div className="mt-3"><DataTable columns={fcols} rows={flagged} rowKey={(x) => x.c.key} pageSize={10} /></div>
          </Card>
        </>
      )}
    </div>
  );
};

export default Quality;
