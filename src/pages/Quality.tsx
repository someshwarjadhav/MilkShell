import type * as React from 'react';
import { useMemo, useState } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { Droplet, FlaskConical, Thermometer, TriangleAlert } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useChartColors } from '../context/ThemeContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Segmented } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { MilkTypeChip } from '../components/MilkTypeChip';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { flagOf, FLAG_META } from '../lib/quality';
import { addDays, fmtDate, nf, todayISO } from '../lib/format';
import { groupBy, summarize } from '../lib/stats';
import type { Collection, Flag } from '../types';

interface Flagged { c: Collection; flag: Flag }
interface Rank { id: string; name: string; code: string; samples: number; flagged: number; rate: number; fat: number; snf: number }

const Quality: React.FC = () => {
  const { collections, thresholds, farmerById, centerById } = useData();
  const cc = useChartColors();
  const [days, setDays] = useState<'1' | '7' | '30'>('7');
  const today = todayISO();

  const rows = useMemo(() => collections.filter((c) => c.date >= addDays(today, -(Number(days) - 1))), [collections, days, today]);
  const flagged = useMemo<Flagged[]>(() => rows.map((c) => ({ c, flag: flagOf(c, thresholds) })).filter((x): x is Flagged => x.flag !== null).sort((a, b) => (a.c.date + a.c.time < b.c.date + b.c.time ? 1 : -1)), [rows, thresholds]);
  const count = (f: Flag) => flagged.filter((x) => x.flag === f).length;

  const ranks = useMemo<Rank[]>(() => {
    const bad = new Set(flagged.map((x) => x.c.id));
    return [...groupBy(rows, (c) => c.farmerId)].map(([id, rs]) => {
      const f = farmerById.get(id);
      const s = summarize(rs);
      const fl = rs.filter((c) => bad.has(c.id)).length;
      return { id, name: f?.name ?? id, code: f?.code ?? '', samples: rs.length, flagged: fl, rate: rs.length ? (fl / rs.length) * 100 : 0, fat: s.avgFat, snf: s.avgSnf };
    }).filter((r) => r.flagged > 0).sort((a, b) => b.rate - a.rate).slice(0, 8);
  }, [rows, flagged, farmerById]);

  const scatter = useMemo(() => {
    const step = Math.max(1, Math.ceil(rows.length / 500));
    return MILK_TYPES.map((m) => ({ m, data: rows.filter((c, i) => c.milk === m && i % step === 0).map((c) => ({ fat: c.fat, snf: c.snf })) }));
  }, [rows]);

  const fcols: Column<Flagged>[] = [
    { key: 'when', header: 'When', sort: (x) => x.c.date + x.c.time, cell: (x) => `${fmtDate(x.c.date)} · ${x.c.time}` },
    { key: 'f', header: 'Farmer', sort: (x) => farmerById.get(x.c.farmerId)?.name ?? '', cell: (x) => <div><p className="font-semibold">{farmerById.get(x.c.farmerId)?.name}</p><p className="text-xs text-mute">{centerById.get(x.c.centerId)?.name}</p></div> },
    { key: 'milk', header: 'Milk', cell: (x) => <MilkTypeChip type={x.c.milk} /> },
    { key: 'fat', header: 'Fat', align: 'right', sort: (x) => x.c.fat, cell: (x) => x.c.fat.toFixed(1) },
    { key: 'snf', header: 'SNF', align: 'right', sort: (x) => x.c.snf, cell: (x) => x.c.snf.toFixed(1) },
    { key: 'temp', header: 'Temp °C', align: 'right', cell: (x) => x.c.temp.toFixed(1) },
    { key: 'liter', header: 'Litres', align: 'right', sort: (x) => x.c.liter, cell: (x) => nf(x.c.liter, 1) },
    { key: 'flag', header: 'Reason', cell: (x) => <Badge tone={x.flag === 'water' ? 'danger' : 'warn'} dot>{FLAG_META[x.flag].label}</Badge> },
  ];
  const rcols: Column<Rank>[] = [
    { key: 'n', header: 'Farmer', cell: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-mute">ID {r.code}</p></div> },
    { key: 'fl', header: 'Flagged', align: 'right', sort: (r) => r.flagged, cell: (r) => `${r.flagged} of ${r.samples}` },
    { key: 'rate', header: 'Rate', align: 'right', sort: (r) => r.rate, cell: (r) => <Badge tone={r.rate > 15 ? 'danger' : 'warn'}>{r.rate.toFixed(0)}%</Badge> },
    { key: 'fat', header: 'Avg fat', align: 'right', cell: (r) => r.fat.toFixed(2) },
    { key: 'snf', header: 'Avg SNF', align: 'right', cell: (r) => r.snf.toFixed(2) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Quality watch" subtitle="Samples that look thin, watered or warm are flagged the moment the analyzer reports them. Limits are set in Settings." actions={<Segmented value={days} onChange={setDays} options={[{ value: '1', label: 'Today' }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Water suspected" value={count('water')} icon={<Droplet size={18} />} tone="text-danger" hint="SNF far below normal" />
        <StatCard label="Low fat" value={count('low-fat')} icon={<FlaskConical size={18} />} tone="text-cow" />
        <StatCard label="Low SNF" value={count('low-snf')} icon={<TriangleAlert size={18} />} tone="text-buffalo" />
        <StatCard label="Warm samples" value={count('high-temp')} icon={<Thermometer size={18} />} tone="text-warn" hint={`Above ${thresholds.temp}°C`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Fat against SNF" subtitle="Each dot is a sample. Buffalo sits high on fat, cow and goat cluster lower." />
          <div className="h-80 px-2 pb-4 pt-4 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={cc.grid} />
                <XAxis type="number" dataKey="fat" name="Fat" unit="%" domain={[2.5, 10]} tick={{ fill: cc.tick, fontSize: 12 }} tickLine={false} axisLine={{ stroke: cc.line }} />
                <YAxis type="number" dataKey="snf" name="SNF" unit="%" domain={[6.5, 10.5]} tick={{ fill: cc.tick, fontSize: 12 }} tickLine={false} axisLine={{ stroke: cc.line }} width={44} />
                <ZAxis range={[36, 36]} />
                <Tooltip cursor={{ strokeDasharray: '4 4', stroke: cc.tick }} contentStyle={{ background: cc.panel, border: `1px solid ${cc.line}`, borderRadius: 12, fontSize: 12 }} />
                {scatter.map((s) => <Scatter key={s.m} name={MILK_META[s.m].label} data={s.data} fill={MILK_META[s.m].hex} fillOpacity={0.7} animationDuration={800} />)}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 pb-5 text-xs font-semibold">{MILK_TYPES.map((m) => <span key={m} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: MILK_META[m].hex }} />{MILK_META[m].label}</span>)}</div>
        </Card>
        <Card>
          <CardHeader title="Farmers to talk to" subtitle="Highest share of flagged samples" />
          <div className="mt-3"><DataTable columns={rcols} rows={ranks} rowKey={(r) => r.id} pageSize={8} pageSizes={[8]} empty={<p className="px-6 py-10 text-center text-sm text-mute">No farmer has flagged samples in this period.</p>} /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Flagged samples" subtitle={`${flagged.length} in the selected period`} />
        <div className="mt-3"><DataTable columns={fcols} rows={flagged} rowKey={(x) => x.c.id} pageSize={10} /></div>
      </Card>
    </div>
  );
};

export default Quality;
