import type * as React from 'react';
import { useState } from 'react';
import { Moon, RotateCcw, Save, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Field, Input, Segmented } from '../components/ui/Fields';
import { PageHeader } from '../components/ui/PageHeader';
import { AnimalHead } from '../components/Illustrations';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { initials } from '../lib/format';
import { DEFAULT_THRESHOLDS } from '../lib/quality';
import type { Thresholds } from '../types';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { dairyName, thresholds, setThresholds, resetData } = useData();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [t, setT] = useState<Thresholds>(thresholds);
  const [confirm, setConfirm] = useState(false);
  const dirty = JSON.stringify(t) !== JSON.stringify(thresholds);
  const n = (v: string) => (Number.isNaN(Number(v)) ? 0 : Number(v));

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Appearance, alert limits and demo data." />
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
          <Card>
            <CardHeader title="Demo data" subtitle="Everything here is generated sample data" />
            <div className="p-5 sm:p-6"><Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setConfirm(true)}>Reset demo data</Button></div>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title="Quality alert limits" subtitle="A sample is flagged when it falls below these values. SNF more than 0.7 below the limit is marked as water suspected." action={<Button icon={<Save size={15} />} disabled={!dirty} onClick={() => { setThresholds(t); toast('Alert limits saved'); }}>Save limits</Button>} />
          <div className="space-y-4 p-5 sm:p-6">
            {MILK_TYPES.map((m) => (
              <div key={m} className="grid items-end gap-4 rounded-3xl border border-line p-4 sm:grid-cols-[auto_1fr_1fr]">
                <div className="flex items-center gap-3 sm:w-36"><AnimalHead type={m} size={44} /><p className="font-bold">{MILK_META[m].label}</p></div>
                <Field label="Minimum fat %"><Input type="number" step="0.1" min="0" value={t.fat[m]} onChange={(e) => setT({ ...t, fat: { ...t.fat, [m]: n(e.target.value) } })} /></Field>
                <Field label="Minimum SNF %"><Input type="number" step="0.1" min="0" value={t.snf[m]} onChange={(e) => setT({ ...t, snf: { ...t.snf, [m]: n(e.target.value) } })} /></Field>
              </div>
            ))}
            <Field label="Warm sample limit (°C)" hint="Samples hotter than this are flagged for souring risk" className="max-w-xs"><Input type="number" step="0.5" min="0" value={t.temp} onChange={(e) => setT({ ...t, temp: n(e.target.value) })} /></Field>
          </div>
        </Card>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" subtitle="Farmers, collections, rates and limits return to the starting set."
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep my data</Button><Button variant="danger" onClick={() => { resetData(); setT(DEFAULT_THRESHOLDS); setConfirm(false); toast('Demo data reset', 'info'); }}>Reset everything</Button></>}>
        <p className="text-sm text-mute">Anything you added in this session, such as new farmers, dispatches or rate changes, will be removed.</p>
      </Modal>
    </div>
  );
};

export default Settings;
