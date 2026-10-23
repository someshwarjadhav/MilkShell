import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, ShieldCheck, Smartphone } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Fields';
import { ErrorBlock } from '../../components/Widget';
import { CardTitle, ReportPage, Reveal } from '../../components/ReportKit';
import { useToast } from '../../context/ToastContext';
import { todayISO } from '../../lib/format';
import { useCenters } from '../../hooks/useSessionData';
import { getSession } from '../../services/session';
import { vlccOption } from '../../services/vlcc/names';
import { ApiError } from '../../services/http/errors';
import {
  ACCESS_FORMS,
  emptyAccess,
  getMenuSettings,
  getMobileSettings,
  getUserAccess,
  MENU_ITEMS,
  saveMenuSettings,
  saveMobileSettings,
  saveUserAccess,
  type AccessValues,
  type MenuValues,
  type MobileAppSettings as MobileSettings,
} from '../../services/settings/mobileSettings.api';

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

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

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const FRESH: MobileSettings = {
  stationId: '', settingOn: false, autoWeight: false, autoFat: false, autoShift: false, autoTear: false, autoClr: false, realData: false,
  remoteDisplay: false, receipt: false, multiCollection: false, anyRate: false, rateSync: false, salesSync: false,
  appPass: '', morShiftEnd: '00:00', eveShiftEnd: '00:00',
};


const MobileForm: React.FC<{ ids: string[] }> = ({ ids }) => {
  const toast = useToast();
  const [s, setS] = useState<MobileSettings>(FRESH);
  const settingsByCenter = useRef<Record<string, MobileSettings>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const center = s.stationId;


  useEffect(() => {
    if (!center) { setLoading(false); setError(null); return; }
    if (settingsByCenter.current[center]) { setLoading(false); setError(null); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    getMobileSettings(center)
      .then((v) => {
        if (!alive) return;
        const next = { ...(v ?? FRESH), stationId: center };
        settingsByCenter.current[center] = next;
        setS(next);
      })
      .catch((e) => { if (alive) setError(message(e, 'The saved settings could not be loaded.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [center, tick]);

  const set = <K extends keyof MobileSettings>(k: K, v: MobileSettings[K]) => setS((x) => {
    const next = { ...x, [k]: v };
    if (next.stationId) settingsByCenter.current[next.stationId] = next;
    return next;
  });
  const selectCenter = (stationId: string) => {
    const known = stationId ? settingsByCenter.current[stationId] : undefined;
    setS(stationId ? { ...(known ?? FRESH), stationId } : FRESH);
    setError(null);
    setLoading(!!stationId && !known);
  };
  const passOk = /^\d{4}$/.test(s.appPass);
  const locked = !center || loading || !!error;

  const checks: Array<[keyof MobileSettings, string]> = [
    ['autoWeight', 'Auto Weight'], ['autoFat', 'Auto Fat'], ['autoShift', 'Auto Shift'], ['autoTear', 'Tear'],
    ['autoClr', 'CLR'], ['realData', 'Real Data'], ['remoteDisplay', 'Remote Display'], ['receipt', 'Receipt'],
    ['multiCollection', 'Multiple Collection'], ['anyRate', 'Any Rate'], ['rateSync', 'Rate Sync'], ['salesSync', 'Sales Sync'],
  ];

  const submit = async () => {
    if (locked || !passOk || saving) return;
    setSaving(true);
    try {
      await saveMobileSettings(s);
      delete settingsByCenter.current[s.stationId]; 
      setS(FRESH);                                   
      setError(null);
      setLoading(false);
      toast('Data saved successfully!');
    } catch (e) {
      toast(message(e, 'The settings could not be saved'), 'warn');
    } finally {
      setSaving(false);
    }
  };

  const timeOpts = (cur: string) => (TIMES.includes(cur) ? TIMES : [cur, ...TIMES]);

  return (
    <Card>
      <CardHeader title={<CardTitle icon={Smartphone}>Mobile App Settings</CardTitle>} />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <CenterSelect value={s.stationId} onChange={selectCenter} ids={ids} />
          <div className="flex items-end pb-2"><Check label="Enabling Server Setting from Mobile application" checked={s.settingOn} disabled={locked} onChange={(v) => set('settingOn', v)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {checks.map(([k, label]) => <Check key={k} label={label} checked={s[k] as boolean} disabled={locked} onChange={(v) => set(k, v as never)} />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="App Password">
            <Input inputMode="numeric" maxLength={4} disabled={locked} value={s.appPass} onChange={(e) => set('appPass', e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </Field>
          <Field label="Mor Shift Close">
            <Select value={s.morShiftEnd} disabled={locked} onChange={(e) => set('morShiftEnd', e.target.value)}>{timeOpts(s.morShiftEnd).map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          </Field>
          <Field label="Eve Shift Close">
            <Select value={s.eveShiftEnd} disabled={locked} onChange={(e) => set('eveShiftEnd', e.target.value)}>{timeOpts(s.eveShiftEnd).map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          </Field>
        </div>
        {error && <ErrorBlock message={error} onRetry={() => { delete settingsByCenter.current[center]; setTick((t) => t + 1); }} compact />}
        {center && !loading && !error && !passOk && <p className="text-sm font-semibold text-danger">Password Must be of 4 Digit</p>}
        <Button className="w-full" loading={saving} disabled={locked || !passOk} onClick={submit}>Submit</Button>
      </div>
    </Card>
  );
};

const MenuForm: React.FC<{ ids: string[] }> = ({ ids }) => {
  const toast = useToast();
  const [center, setCenter] = useState('');
  const [values, setValues] = useState<MenuValues>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const valuesByCenter = useRef<Record<string, MenuValues>>({});

  useEffect(() => {
    if (!center) { setValues({}); setError(null); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    getMenuSettings(center)
      .then((v) => { if (alive) { valuesByCenter.current[center] = v; setValues(v); } })
      .catch((e) => { if (alive) setError(message(e, 'The menu settings could not be loaded.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [center, tick]);

  const selectCenter = (value: string) => {
    setCenter(value);
    setValues(valuesByCenter.current[value] ?? {});
    setError(null);
    setLoading(!!value);
  };
  const updateValues = (next: MenuValues) => {
    setValues(next);
    if (center) valuesByCenter.current[center] = next;
  };

  const submit = async () => {
    if (!center || saving) return;
    setSaving(true);
    try {
      await saveMenuSettings(center, todayISO(), values);
      delete valuesByCenter.current[center];
      setCenter('');
      setValues({});
      setError(null);
      setLoading(false); 
      toast('Menu settings saved successfully!');
    } catch (e) {
      toast(message(e, 'The menu settings could not be saved'), 'warn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title={<CardTitle icon={LayoutGrid}>My Dairy App Menu Settings</CardTitle>} />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid gap-4 sm:grid-cols-2"><CenterSelect value={center} onChange={selectCenter} ids={ids} /></div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {MENU_ITEMS.map((m) => (
            <Check key={m.key} label={m.label} checked={!!values[m.key]} disabled={!center || loading || !!error} onChange={(v) => updateValues({ ...values, [m.key]: v })} />
          ))}
        </div>
        {error && <ErrorBlock message={error} onRetry={() => setTick((t) => t + 1)} compact />}
        <Button className="w-full" loading={saving} disabled={!center || loading || !!error} onClick={submit}>Submit</Button>
      </div>
    </Card>
  );
};


const AccessForm: React.FC<{ ids: string[] }> = ({ ids }) => {
  const toast = useToast();
  const [center, setCenter] = useState('');
  const [values, setValues] = useState<AccessValues>(emptyAccess());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const valuesByCenter = useRef<Record<string, AccessValues>>({});

  useEffect(() => {
    if (!center) { setValues(emptyAccess()); setError(null); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    getUserAccess(center)
      .then((v) => { if (alive) { valuesByCenter.current[center] = v; setValues(v); } })
      .catch((e) => { if (alive) setError(message(e, 'The user access settings could not be loaded.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [center, tick]);

  const selectCenter = (value: string) => {
    setCenter(value);
    setValues(valuesByCenter.current[value] ?? emptyAccess());
    setError(null);
    setLoading(!!value);
  };
  const toggle = (id: number, k: 'add' | 'modify' | 'del', v: boolean) => {
    const next = { ...values, [id]: { ...values[id], [k]: v } };
    setValues(next);
    if (center) valuesByCenter.current[center] = next;
  };

  const submit = async () => {
    if (!center || saving) return;
    setSaving(true);
    try {
      await saveUserAccess(center, values);
      delete valuesByCenter.current[center];
      setCenter('');
      setValues(emptyAccess());
      setError(null);
      setLoading(false);
      toast('User Access settings saved successfully!');
    } catch (e) {
      toast(message(e, 'The user access settings could not be saved'), 'warn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title={<CardTitle icon={ShieldCheck}>User Access Settings</CardTitle>} />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid gap-4 sm:grid-cols-2"><CenterSelect value={center} onChange={selectCenter} ids={ids} /></div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-soft text-left">
                <th className="px-4 py-2.5 font-bold">Forms</th>
                <th className="px-4 py-2.5 text-center font-bold">New</th>
                <th className="px-4 py-2.5 text-center font-bold">Update</th>
                <th className="px-4 py-2.5 text-center font-bold">Delete</th>
              </tr>
            </thead>
            <tbody>
              {ACCESS_FORMS.map((f) => (
                <tr key={f.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-semibold">{f.name}</td>
                  {(['add', 'modify', 'del'] as const).map((k) => (
                    <td key={k} className="px-4 py-2.5 text-center">
                      <input type="checkbox" className="h-4 w-4 rounded border-line accent-brand" disabled={!center || loading || !!error} checked={!!values[f.id]?.[k]} onChange={(e) => toggle(f.id, k, e.target.checked)} aria-label={`${f.name} ${k}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <ErrorBlock message={error} onRetry={() => setTick((t) => t + 1)} compact />}
        <Button className="w-full" loading={saving} disabled={!center || loading || !!error} onClick={submit}>Submit</Button>
      </div>
    </Card>
  );
};


const MobileAppSettings: React.FC = () => {
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];
  const ids = useMemo(() => (centers.length ? centers.map((c) => c.id) : sessionIds), [centers, sessionIds]);

  return (
    <ReportPage title="Mobile App Settings" subtitle="">
      <Reveal delay={0.05}><MobileForm ids={ids} /></Reveal>
      <Reveal delay={0.1}><MenuForm ids={ids} /></Reveal>
      <Reveal delay={0.15}><AccessForm ids={ids} /></Reveal>
    </ReportPage>
  );
};

export default MobileAppSettings;