import type * as React from 'react';
import { useState } from 'react';
import { Moon, Save, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Segmented } from '../components/ui/Fields';
import { PageHeader } from '../components/ui/PageHeader';
import { SessionCheck } from '../components/SessionCheck';
import { KindDot } from '../components/KindChip';
import { KIND_META } from '../services/utils/milk';
import { initials } from '../lib/format';
import type { LimitKind, Thresholds } from '../types';

const LIMIT_KINDS: LimitKind[] = ['cow', 'buffalo', 'mix'];

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { dairyName, thresholds, setThresholds } = useData();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [t, setT] = useState<Thresholds>(thresholds);
  const dirty = JSON.stringify(t) !== JSON.stringify(thresholds);
  const n = (v: string) => (Number.isNaN(Number(v)) ? 0 : Number(v));

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Appearance and quality alert limits." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-deep font-display text-xl font-extrabold text-white dark:bg-brand dark:text-[#06222a]">{initials(user?.name ?? 'U')}</span>
              <div className="min-w-0"><p className="truncate font-display text-xl font-extrabold">{user?.name}</p><p className="truncate text-sm text-mute">{user?.email}</p><p className="text-sm font-semibold text-brand">{user?.role}</p></div>
            </div>
            <p className="mt-5 rounded-2xl bg-soft px-4 py-3 text-sm"><span className="text-mute">Dairy</span><br /><b>{dairyName}</b></p>
          </Card>
          <Card>
            <CardHeader title="Appearance" subtitle="Dark mode is easier on the eyes at the 5 am shift" />
            <div className="p-5 sm:p-6"><Segmented value={theme} onChange={setTheme} options={[{ value: 'light', label: <span className="flex items-center gap-2"><Sun size={15} />Light</span> }, { value: 'dark', label: <span className="flex items-center gap-2"><Moon size={15} />Dark</span> }]} /></div>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title="Quality alert limits" subtitle="A sample is flagged when it falls below these values. SNF more than 0.7 below the limit is marked as water suspected. Saved in this browser." action={<Button icon={<Save size={15} />} disabled={!dirty} onClick={() => { setThresholds(t); toast('Alert limits saved'); }}>Save limits</Button>} />
          <div className="space-y-4 p-5 sm:p-6">
            {LIMIT_KINDS.map((m) => (
              <div key={m} className="grid items-end gap-4 rounded-3xl border border-line p-4 sm:grid-cols-[auto_1fr_1fr]">
                <div className="flex items-center gap-3 sm:w-36"><KindDot kind={m} size={44} /><p className="font-bold">{KIND_META[m].label}</p></div>
                <Field label="Minimum fat %"><Input type="number" step="0.1" min="0" value={t.fat[m]} onChange={(e) => setT({ ...t, fat: { ...t.fat, [m]: n(e.target.value) } })} /></Field>
                <Field label="Minimum SNF %"><Input type="number" step="0.1" min="0" value={t.snf[m]} onChange={(e) => setT({ ...t, snf: { ...t.snf, [m]: n(e.target.value) } })} /></Field>
              </div>
            ))}
            <Field label="Water limit" hint="Samples whose analyzer water reading is above this are flagged" className="max-w-xs"><Input type="number" step="0.5" min="0" value={t.water} onChange={(e) => setT({ ...t, water: n(e.target.value) })} /></Field>
          </div>
        </Card>
      </div>

      <SessionCheck />
    </div>
  );
};

export default Settings;
