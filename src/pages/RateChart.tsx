import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Fields';
import { PageHeader } from '../components/ui/PageHeader';
import { AnimalHead } from '../components/Illustrations';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { DEFAULT_RATES, rateFor, PENALTY } from '../lib/rate';
import { inr } from '../lib/format';
import { cn } from '../lib/cn';
import type { MilkType, RateRule, RateTable } from '../types';

const num = (v: string) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));

const RateChart: React.FC = () => {
  const { rates, setRates } = useData();
  const toast = useToast();
  const [draft, setDraft] = useState<RateTable>(rates);
  const [milk, setMilk] = useState<MilkType>('cow');
  const [calc, setCalc] = useState({ fat: 4.2, snf: 8.6, liter: 20 });
  const rule = draft[milk];
  const dirty = JSON.stringify(draft) !== JSON.stringify(rates);

  const set = (k: keyof RateRule, v: string) => setDraft((d) => ({ ...d, [milk]: { ...d[milk], [k]: num(v) } }));

  const fats = useMemo(() => (milk === 'buffalo' ? [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] : [3, 3.5, 4, 4.5, 5, 5.5, 6]), [milk]);
  const snfs = useMemo(() => (milk === 'buffalo' ? [8, 8.5, 9, 9.5, 10] : [7.5, 8, 8.5, 9, 9.5]), [milk]);
  const all = fats.flatMap((f) => snfs.map((s) => rateFor(rule, f, s)));
  const lo = Math.min(...all), hi = Math.max(...all);
  const perL = rateFor(rule, calc.fat, calc.snf);
  const below = calc.fat < rule.minFat || calc.snf < rule.minSnf;

  return (
    <div className="space-y-6">
      <PageHeader title="Rate chart" subtitle="Each milk type has its own formula. Change a rate and the farmer slip, billing and reports use it from the next sample." actions={<>
        <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={() => setDraft(DEFAULT_RATES)}>Restore defaults</Button>
        <Button icon={<Save size={16} />} disabled={!dirty} onClick={() => { setRates(draft); toast('Rate chart saved'); }}>Save rates</Button>
      </>} />

      <div className="grid gap-4 sm:grid-cols-3">
        {MILK_TYPES.map((m) => (
          <button key={m} onClick={() => setMilk(m)} aria-pressed={milk === m} className={cn('flex items-center gap-4 rounded-[1.75rem] border-2 bg-panel p-5 text-left shadow-lift transition-all', milk === m ? `border-transparent ring-4 ${MILK_META[m].ring}` : 'border-line hover:border-brand/40')}>
            <AnimalHead type={m} size={56} />
            <div><p className="font-display text-xl font-extrabold">{MILK_META[m].label} milk</p><p className="text-sm text-mute">Fat ₹{draft[m].fatRate} · SNF ₹{draft[m].snfRate} per point</p></div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={`${MILK_META[milk].label} formula`} subtitle="Rate per litre = base + fat × fat rate + SNF × SNF rate" />
            <div className="grid grid-cols-2 gap-4 p-5 sm:p-6">
              <Field label="Fat rate (₹ per %)"><Input type="number" step="0.1" min="0" value={rule.fatRate} onChange={(e) => set('fatRate', e.target.value)} /></Field>
              <Field label="SNF rate (₹ per %)"><Input type="number" step="0.1" min="0" value={rule.snfRate} onChange={(e) => set('snfRate', e.target.value)} /></Field>
              <Field label="Base (₹ per litre)"><Input type="number" step="0.5" min="0" value={rule.base} onChange={(e) => set('base', e.target.value)} /></Field>
              <span />
              <Field label="Minimum fat %" hint="10% cut below this"><Input type="number" step="0.1" min="0" value={rule.minFat} onChange={(e) => set('minFat', e.target.value)} /></Field>
              <Field label="Minimum SNF %" hint="10% cut below this"><Input type="number" step="0.1" min="0" value={rule.minSnf} onChange={(e) => set('minSnf', e.target.value)} /></Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Try a sample" subtitle="See what a farmer would be paid" />
            <div className="space-y-4 p-5 sm:p-6">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Fat %"><Input type="number" step="0.1" value={calc.fat} onChange={(e) => setCalc({ ...calc, fat: num(e.target.value) })} /></Field>
                <Field label="SNF %"><Input type="number" step="0.1" value={calc.snf} onChange={(e) => setCalc({ ...calc, snf: num(e.target.value) })} /></Field>
                <Field label="Litres"><Input type="number" step="0.5" value={calc.liter} onChange={(e) => setCalc({ ...calc, liter: num(e.target.value) })} /></Field>
              </div>
              <div className="rounded-2xl bg-deep p-5 text-white">
                <p className="text-sm text-white/60">Rate per litre</p>
                <p className="font-display text-4xl font-extrabold tnum">{inr(perL, 2)}</p>
                <p className="mt-2 text-sm text-white/70">{calc.liter} L pays <b className="text-white">{inr(perL * calc.liter, 2)}</b></p>
                {below && <p className="mt-2 rounded-lg bg-warn/20 px-2 py-1 text-xs font-semibold text-cream">Below minimum, {Math.round((1 - PENALTY) * 100)}% cut applied</p>}
              </div>
            </div>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title="Rate matrix" subtitle="Rate per litre for every fat and SNF combination. Darker is higher." />
          <div className="overflow-x-auto p-5 sm:p-6">
            <table className="w-full min-w-[460px] border-separate border-spacing-1.5 text-center text-sm tnum">
              <thead><tr><th className="text-xs font-semibold text-mute">Fat ↓ / SNF →</th>{snfs.map((s) => <th key={s} className="text-xs font-semibold text-mute">{s}</th>)}</tr></thead>
              <tbody>
                {fats.map((f) => (
                  <tr key={f}>
                    <th className="text-xs font-semibold text-mute">{f}</th>
                    {snfs.map((s) => {
                      const r = rateFor(rule, f, s);
                      const t = hi === lo ? 0 : (r - lo) / (hi - lo);
                      const cut = f < rule.minFat || s < rule.minSnf;
                      return (
                        <td key={s} className={cn('rounded-xl py-3 font-semibold transition-colors', t > 0.55 && 'text-white')} style={{ background: `color-mix(in srgb, ${MILK_META[milk].hex} ${Math.round(12 + t * 78)}%, transparent)`, outline: cut ? '1.5px dashed rgb(var(--danger))' : undefined }} title={cut ? 'Below minimum, rate reduced' : undefined}>{r.toFixed(1)}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-mute">Dashed cells fall below the minimum and carry the {Math.round((1 - PENALTY) * 100)}% reduction.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RateChart;
