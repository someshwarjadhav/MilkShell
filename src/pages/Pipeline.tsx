import type * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Calculator, Cloud, Cpu, FileBarChart, Layers, MessageSquareText, ShieldAlert, Smartphone, WifiOff, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DataTable, type Column } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { AnimalHead } from '../components/Illustrations';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { rateFor } from '../lib/rate';
import { cn } from '../lib/cn';
import { inr, timeAgo } from '../lib/format';
import type { MilkType, SyncLog } from '../types';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Cpu, title: 'Analyzer machine', text: 'Reads fat, SNF, CLR and temperature. A scale adds the weight.' },
  { icon: Smartphone, title: 'Collector app', text: 'Pairs over Bluetooth, saves offline and prints the slip.' },
  { icon: Cloud, title: 'Dhara cloud', text: 'Splits by milk type, applies the rate chart and stores the record.' },
  { icon: FileBarChart, title: 'Reports and farmers', text: 'Dashboards, bills and an SMS slip for every farmer.' },
];

const EXTRAS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Layers, title: 'Separate ledgers per milk', text: 'Cow, buffalo and goat milk each have their own rate chart, stock and bill lines.' },
  { icon: WifiOff, title: 'Works without network', text: 'The app queues samples and uploads them when the signal returns.' },
  { icon: MessageSquareText, title: 'SMS slip to farmer', text: 'Litres, fat, SNF and amount reach the farmer a minute after pouring.' },
  { icon: ShieldAlert, title: 'Adulteration alerts', text: 'Water and low-solid samples are flagged before payment is calculated.' },
  { icon: Wrench, title: 'Calibration reminders', text: 'Each machine shows how many days remain until its next calibration.' },
  { icon: Calculator, title: 'Rate calculator', text: 'Try any fat and SNF to see the exact rate, with a minimum-quality cut.' },
  { icon: BellRing, title: 'Offline centre alerts', text: 'Know within minutes when a village centre stops sending data.' },
];

const Connector: React.FC = () => {
  return (
    <>
      <svg className="mx-auto h-10 w-3 md:hidden" viewBox="0 0 12 40" aria-hidden><line x1="6" y1="0" x2="6" y2="40" className="flow-line" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" /></svg>
      <svg className="hidden h-3 w-full min-w-8 self-center md:block" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden><line x1="0" y1="6" x2="100" y2="6" className="flow-line" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
    </>
  );
};

const Phone: React.FC = () => {
  const { rates } = useData();
  const [milk, setMilk] = useState<MilkType>('cow');
  const sample: Record<MilkType, { fat: number; snf: number; liter: number }> = { cow: { fat: 4.2, snf: 8.6, liter: 18.5 }, buffalo: { fat: 7.1, snf: 9.2, liter: 12 }, goat: { fat: 4.6, snf: 8.4, liter: 4.5 } };
  const s = sample[milk];
  const rate = rateFor(rates[milk], s.fat, s.snf);
  return (
    <div className="mx-auto w-[270px] rounded-[2.5rem] border-[7px] border-deep bg-deep p-0 shadow-pop dark:border-line">
      <div className="overflow-hidden rounded-[2rem] bg-bg">
        <div className="flex items-center justify-between bg-deep px-5 pb-3 pt-4 text-white"><span className="text-xs font-semibold">Dhara collector</span><Badge tone="ok" dot className="!bg-white/15 !text-white">Machine linked</Badge></div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-1.5">
            {MILK_TYPES.map((m) => (
              <button key={m} onClick={() => setMilk(m)} aria-pressed={milk === m} className={cn('flex flex-col items-center gap-0.5 rounded-xl border-2 py-2 text-[11px] font-bold transition-all', milk === m ? 'border-transparent bg-panel shadow-lift ring-2 ' + MILK_META[m].ring : 'border-line text-mute')}><AnimalHead type={m} size={28} />{MILK_META[m].label}</button>
            ))}
          </div>
          <div className="rounded-2xl bg-panel p-3 text-center shadow-lift"><p className="text-[11px] text-mute">Farmer 014 · Sanjay Patil</p><motion.p key={milk} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-5xl font-extrabold tnum">{s.liter}<span className="text-lg text-mute"> L</span></motion.p></div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-panel p-2"><p className="font-display text-xl font-extrabold tnum">{s.fat}</p><p className="text-[11px] text-mute">Fat %</p></div>
            <div className="rounded-xl bg-panel p-2"><p className="font-display text-xl font-extrabold tnum">{s.snf}</p><p className="text-[11px] text-mute">SNF %</p></div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-brand/12 px-3 py-2 text-sm"><span className="text-mute">{inr(rate, 2)} / L</span><span className="font-display text-lg font-extrabold tnum">{inr(rate * s.liter)}</span></div>
          <div className="rounded-xl bg-deep py-2.5 text-center text-sm font-bold text-white dark:bg-brand dark:text-[#06222a]">Save and print slip</div>
        </div>
      </div>
    </div>
  );
};

const Pipeline: React.FC = () => {
  const { syncLogs, centerById, rates } = useData();
  const cols: Column<SyncLog>[] = [
    { key: 'at', header: 'When', sort: (l) => l.at, cell: (l) => timeAgo(l.at) },
    { key: 'c', header: 'Centre', cell: (l) => centerById.get(l.centerId)?.name },
    { key: 'via', header: 'Path', cell: (l) => l.via },
    { key: 'n', header: 'Samples', align: 'right', sort: (l) => l.records, cell: (l) => l.records },
    { key: 's', header: 'Result', cell: (l) => <Badge tone={l.status === 'ok' ? 'ok' : l.status === 'retry' ? 'warn' : 'danger'} dot>{l.status === 'ok' ? 'Delivered' : l.status === 'retry' ? 'Retrying' : 'Failed'}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Data pipeline" subtitle="How a farmer's can of milk becomes a record, a bill and an SMS, without anyone typing a number." />

      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-1 md:flex-row md:items-stretch">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex flex-col md:flex-1 md:flex-row">
              <motion.div className="flex-1 rounded-3xl bg-soft p-5" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-deep text-white dark:bg-brand dark:text-[#06222a]"><s.icon size={22} /></span>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-mute">{s.text}</p>
              </motion.div>
              {i < STEPS.length - 1 && <div className="md:w-12 md:self-center"><Connector /></div>}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-6"><p className="mb-4 text-center text-sm font-semibold text-mute">Collector app, try the milk types</p><Phone /></Card>
        <Card>
          <CardHeader title="Three milk types, three lanes" subtitle="The app asks for the milk type before the sample, so nothing is mixed in the records." />
          <div className="space-y-4 p-5 sm:p-6">
            {MILK_TYPES.map((m, i) => (
              <motion.div key={m} className="flex flex-wrap items-center gap-4 rounded-3xl border border-line p-4" initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <AnimalHead type={m} size={56} />
                <div className="min-w-[8rem] flex-1"><p className="font-display text-lg font-extrabold">{MILK_META[m].label} milk <span className="text-sm font-medium text-mute">{MILK_META[m].local}</span></p><p className="text-sm text-mute">Own can, own rate chart, own stock</p></div>
                <div className="flex gap-2 text-center text-sm"><div className="rounded-xl bg-soft px-3 py-2"><p className="font-bold tnum">₹{rates[m].fatRate}</p><p className="text-[11px] text-mute">per fat</p></div><div className="rounded-xl bg-soft px-3 py-2"><p className="font-bold tnum">₹{rates[m].snfRate}</p><p className="text-[11px] text-mute">per SNF</p></div></div>
                <span className={`h-14 w-1.5 rounded-full ${MILK_META[m].bar}`} />
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent sync log" subtitle="Each row is one upload from a centre to the cloud" />
        <div className="mt-3"><DataTable columns={cols} rows={syncLogs} rowKey={(l) => l.id} pageSize={6} pageSizes={[6, 12]} /></div>
      </Card>

      <div>
        <h2 className="mb-4 font-display text-2xl font-extrabold">Built in</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {EXTRAS.map((x) => (
            <Card key={x.title} className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/12 text-brand"><x.icon size={19} /></span>
              <h3 className="mt-3 font-bold">{x.title}</h3>
              <p className="mt-1 text-sm text-mute">{x.text}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pipeline;
