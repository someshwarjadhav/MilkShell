import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cpu } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Fields';
import { vlccOption } from '../../services/vlcc/names';
import { ApiError } from '../../services/http/errors';
import { ErrorBlock } from '../../components/Widget';
import { CardTitle, ReportPage, Reveal } from '../../components/ReportKit';
import { useToast } from '../../context/ToastContext';
import { todayISO } from '../../lib/format';
import { useCenters } from '../../hooks/useSessionData';
import { getSession } from '../../services/session';
import {
  DPU_MILK_TYPES,
  emptyDpuSettings,
  getDpuSettings,
  saveDpuSettings,
  type DpuSettings as Dpu,
} from '../../services/settings/dpuSettings.api';

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const busyCls = (loading: boolean) => `transition-opacity duration-150 ${loading ? 'pointer-events-none opacity-60' : 'opacity-100'}`;

const Check: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, checked, onChange, disabled }) => (
  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
    <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-line accent-brand" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

const CenterSelect: React.FC<{ value: string; onChange: (v: string) => void; ids: string[] }> = ({ value, onChange, ids }) => (
  <Field label="Center Name">
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- select center --</option>
      {ids.map((id) => <option key={id} value={id}>{vlccOption(id)}</option>)}
    </Select>
  </Field>
);


function useCenterData<T>(center: string, load: (c: string) => Promise<T>, empty: () => T, failMsg: string) {
  const [values, setValues] = useState<T>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const cache = useRef(new Map<string, T>());
  const fns = useRef({ load, empty });
  fns.current = { load, empty };

  useEffect(() => {
    if (!center) { setValues(fns.current.empty()); setError(null); setLoading(false); return; }
    const hit = cache.current.get(center);
    if (hit) { setValues(hit); setError(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    fns.current.load(center)
      .then((v) => { if (alive) { cache.current.set(center, v); setValues(v); } })
      .catch((e) => { if (alive) { setValues(fns.current.empty()); setError(message(e, failMsg)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [center, tick, failMsg]);

  const retry = () => { cache.current.delete(center); setTick((t) => t + 1); };
  const remember = (v: T) => { cache.current.set(center, v); };
  const forget = (c: string) => { cache.current.delete(c); };
  return { values, setValues, loading, error, retry, remember, forget };
}

const PASS_RE = /^\d{4}$/;
const timeOptions = (current: string) => (TIMES.includes(current) ? TIMES : [current, ...TIMES]);

const CHECKS: Array<[keyof Dpu, string]> = [
  ['autoWeight', 'Auto Weight'], ['autoFat', 'Auto Fat'], ['autoShift', 'Auto Shift'],
  ['autoTear', 'Tear'], ['realData', 'Real Data'], ['multiCol', 'Multiple Collection'],
  ['dpuSeize', 'DPU Seize'], ['dpuSync', 'DPU Sync/Async'],
];

const DpuForm: React.FC<{ ids: string[] }> = ({ ids }) => {
  const toast = useToast();
  const [center, setCenter] = useState('');
  const { values: s, setValues: setS, loading, error, retry, remember, forget } = useCenterData<Dpu>(
    center, getDpuSettings, () => emptyDpuSettings(''), 'The DPU settings could not be loaded.',
  );
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Dpu>(k: K, v: Dpu[K]) => setS((x) => ({ ...x, [k]: v }));
  const setRow = (i: number, patch: Partial<Dpu['intervals'][number]>) =>
    setS((x) => ({ ...x, intervals: x.intervals.map((r, n) => (n === i ? { ...r, ...patch } : r)) }));

  const locked = !center || loading || !!error;
  const passes: Array<[keyof Dpu, string]> = [['operatorPass', 'Operator Pass'], ['supervisorPass', 'Supervisor Pass'], ['adminPass', 'Admin Pass']];
  const passOk = passes.every(([k]) => PASS_RE.test(s[k] as string));

  const submit = async () => {
    if (locked || !passOk || saving) return;
    setSaving(true);
    try {
      const body = { ...s, stationId: center };
      await saveDpuSettings(body, todayISO());
      remember(body);
      forget(center);   
      setCenter('');    
      toast('DPU settings saved successfully!');
    } catch (e) {
      toast(message(e, 'The DPU settings could not be saved'), 'warn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title={<CardTitle icon={Cpu}>DPU Settings</CardTitle>} />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid gap-4 sm:grid-cols-2"><CenterSelect value={center} onChange={setCenter} ids={ids} /></div>
        {error && <ErrorBlock message={error} onRetry={retry} compact />}

        <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] ${busyCls(loading)}`} aria-busy={loading}>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {CHECKS.map(([k, label]) => <Check key={k} label={label} checked={s[k] as boolean} disabled={locked} onChange={(v) => set(k, v as never)} />)}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Morning Shift Start"><Input type="time" disabled={locked} value={s.mStart} onChange={(e) => set('mStart', e.target.value)} /></Field>
              <Field label="Morning Shift End"><Input type="time" disabled={locked} value={s.mEnd} onChange={(e) => set('mEnd', e.target.value)} /></Field>
              <Field label="Milk Type">
                <Select value={s.milkType} disabled={locked} onChange={(e) => set('milkType', e.target.value)}>
                  {(DPU_MILK_TYPES.some((m) => m.value === s.milkType) ? DPU_MILK_TYPES : [{ value: s.milkType, label: s.milkType === '0' ? 'Default' : s.milkType }, ...DPU_MILK_TYPES])
                    .map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Evening Shift Start"><Input type="time" disabled={locked} value={s.eStart} onChange={(e) => set('eStart', e.target.value)} /></Field>
              <Field label="Evening Shift End"><Input type="time" disabled={locked} value={s.eEnd} onChange={(e) => set('eEnd', e.target.value)} /></Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {passes.map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input inputMode="numeric" maxLength={4} disabled={locked} value={s[k] as string} onChange={(e) => set(k, e.target.value.replace(/\D/g, '').slice(0, 4) as never)} />
                </Field>
              ))}
            </div>
            {center && !loading && !error && !passOk && <p className="text-sm font-semibold text-danger">Password Must be of 4 Digit</p>}
          </div>

          <div className="max-h-[26rem] overflow-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-soft text-left">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Intervals</th>
                  <th className="px-3 py-2.5 font-bold">Time</th>
                  <th className="px-3 py-2.5 font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.intervals.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2 text-mute">i{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <Select value={row.time} disabled={locked} onChange={(e) => setRow(i, { time: e.target.value })}>
                        {timeOptions(row.time).map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input inputMode="decimal" disabled={locked} value={row.amount} onChange={(e) => setRow(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Button className="w-full" loading={saving} disabled={locked || !passOk} onClick={submit}>Submit</Button>
      </div>
    </Card>
  );
};

const DpuSettings: React.FC = () => {
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds;
  const ids = useMemo(() => (centers.length ? centers.map((c) => c.id) : sessionIds ?? []), [centers, sessionIds]);

  return (
    <ReportPage title="DPU Settings" subtitle="Choose a centre to set up its DPU: switches, shift timings, passwords and interval rates.">
      <Reveal delay={0.05}><DpuForm ids={ids} /></Reveal>
    </ReportPage>
  );
};

export default DpuSettings;
