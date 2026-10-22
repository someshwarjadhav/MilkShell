import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Segmented } from '../components/ui/Fields';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { KindDot } from '../components/KindChip';
import { LoadingBlock, Notice } from '../components/Widget';
import { addDays, inr, todayISO } from '../lib/format';
import { cn } from '../lib/cn';
import { KIND_META, type Kind } from '../services/utils/milk';
import { isLoadingQ, useSamples } from '../hooks/useSmartxData';
import { EmptyState } from '../components/EmptyState';

const step = (v: number, s: number) => Math.round(v / s) * s;


const RateChart: React.FC = () => {
  const today = todayISO();
  const [days, setDays] = useState<'7' | '30'>('30');
  const [kind, setKind] = useState<Kind>('cow');
  const { q, rows } = useSamples(addDays(today, -29), today);

  const inRange = useMemo(() => {
    const from = addDays(today, -(Number(days) - 1));
    return rows.filter((r) => { const d = new Date(r.date); return !Number.isNaN(d.getTime()) && d >= new Date(from + 'T00:00:00'); });
  }, [rows, days, today]);

  const perKind = useMemo(() => (['cow', 'buffalo', 'mix', 'goat'] as Kind[]).map((k) => {
    const rs = inRange.filter((r) => r.milk === k && r.rate > 0);
    const liter = rs.reduce((a, r) => a + r.liter, 0);
    return { k, count: rs.length, avg: liter ? rs.reduce((a, r) => a + r.rate * r.liter, 0) / liter : 0, min: rs.length ? Math.min(...rs.map((r) => r.rate)) : 0, max: rs.length ? Math.max(...rs.map((r) => r.rate)) : 0 };
  }).filter((x) => x.count > 0), [inRange]);

  const active = perKind.find((x) => x.k === kind) ?? perKind[0];
  const matrix = useMemo(() => {
    if (!active) return null;
    const rs = inRange.filter((r) => r.milk === active.k && r.rate > 0 && r.fat > 0 && r.snf > 0);
    const cells = new Map<string, { sum: number; n: number }>();
    const fats = new Set<number>(), snfs = new Set<number>();
    for (const r of rs) {
      const f = step(r.fat, 0.5), s = step(r.snf, 0.5);
      fats.add(f); snfs.add(s);
      const c = cells.get(`${f}|${s}`) ?? { sum: 0, n: 0 };
      c.sum += r.rate; c.n++;
      cells.set(`${f}|${s}`, c);
    }
    const F = [...fats].sort((a, b) => a - b), S = [...snfs].sort((a, b) => a - b);
    const vals = [...cells.values()].map((c) => c.sum / c.n);
    return { F, S, cells, lo: Math.min(...vals), hi: Math.max(...vals) };
  }, [inRange, active]);

  if (isLoadingQ(q)) return <div className="space-y-6"><PageHeader title="Rate chart" subtitle="Loading the rates the portal applied…" /><LoadingBlock height="h-72" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Rate chart" subtitle="The rates the SmartX portal actually paid, taken from every sample: average per milk type and the rate for each fat and SNF combination." actions={<Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />} />
      <Notice q={q} />

      {perKind.length === 0 ? <Card><EmptyState title="No rated samples in this period" hint="Rates appear once the portal has samples with a rate for these centres." /></Card> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {perKind.map((x) => (
              <button key={x.k} onClick={() => setKind(x.k)} aria-pressed={active?.k === x.k} className={cn('flex items-center gap-4 rounded-[1.75rem] border-2 bg-panel p-5 text-left shadow-lift transition-all', active?.k === x.k ? 'border-brand' : 'border-line hover:border-brand/40')}>
                <KindDot kind={x.k} size={56} />
                <div><p className="font-display text-xl font-extrabold">{KIND_META[x.k].label} milk</p><p className="text-sm text-mute">Average {inr(x.avg, 2)} / L · {x.count} samples</p></div>
              </button>
            ))}
          </div>

          {active && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Average rate" value={active.avg} prefix="₹" decimals={2} icon={<Info size={18} />} tone="text-brand" hint="Weighted by litres" />
              <StatCard label="Lowest paid" value={active.min} prefix="₹" decimals={2} icon={<Info size={18} />} tone="text-buffalo" />
              <StatCard label="Highest paid" value={active.max} prefix="₹" decimals={2} icon={<Info size={18} />} tone="text-ok" />
            </div>
          )}

          {matrix && active && (
            <Card>
              <CardHeader title={`${KIND_META[active.k].label}: rate by fat and SNF`} subtitle="Average rate per litre paid for samples in each 0.5 band. Empty cells had no sample." />
              <div className="overflow-x-auto p-5 sm:p-6">
                <table className="w-full min-w-[460px] border-separate border-spacing-1.5 text-center text-sm tnum">
                  <thead><tr><th className="text-xs font-semibold text-mute">Fat ↓ / SNF →</th>{matrix.S.map((s) => <th key={s} className="text-xs font-semibold text-mute">{s}</th>)}</tr></thead>
                  <tbody>
                    {matrix.F.map((f) => (
                      <tr key={f}>
                        <th className="text-xs font-semibold text-mute">{f}</th>
                        {matrix.S.map((s) => {
                          const c = matrix.cells.get(`${f}|${s}`);
                          if (!c) return <td key={s} className="rounded-xl py-3 text-mute/50">·</td>;
                          const r = c.sum / c.n;
                          const t = matrix.hi === matrix.lo ? 0 : (r - matrix.lo) / (matrix.hi - matrix.lo);
                          return <td key={s} title={`${c.n} samples`} className={cn('rounded-xl py-3 font-semibold', t > 0.55 && 'text-white')} style={{ background: `color-mix(in srgb, ${KIND_META[active.k].hex} ${Math.round(12 + t * 78)}%, transparent)` }}>{r.toFixed(1)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
      <p className="text-xs text-mute">Rates are set on the SmartX portal. To change a rate chart, edit it there; this page only reads what was applied.</p>
    </div>
  );
};

export default RateChart;
