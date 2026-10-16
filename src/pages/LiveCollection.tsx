import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cpu, Pause, Play, Printer, Scale } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useInterval } from '../components/hooks';
import { makeCollection } from '../lib/mockData';
import { mulberry32, pick } from '../lib/rng';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { MilkTypeChip } from '../components/MilkTypeChip';
import { AnimalHead } from '../components/Illustrations';
import { EmptyState } from '../components/EmptyState';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { flagOf, FLAG_META } from '../lib/quality';
import { inr, nf, todayISO } from '../lib/format';
import type { Collection } from '../types';

const LiveCollection: React.FC = () => {
  const { farmers, centers, rates, thresholds, addCollection, farmerById, centerById } = useData();
  const [running, setRunning] = useState(true);
  const [feed, setFeed] = useState<Collection[]>([]);
  const rng = useRef(mulberry32(Date.now()));
  const seq = useRef(0);

  const active = useMemo(() => farmers.filter((f) => f.active), [farmers]);

  useInterval(() => {
    const r = rng.current;
    const f = pick(r, active);
    const milk = pick(r, f.milkTypes);
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const shift = now.getHours() < 12 ? 'morning' : 'evening';
    const c = makeCollection(r, f, milk, todayISO(), shift, rates, centers, Date.now() + seq.current++, time);
    addCollection(c);
    setFeed((s) => [c, ...s].slice(0, 25));
  }, running ? 3200 : null);

  const latest = feed[0];
  const totals = MILK_TYPES.map((m) => {
    const rows = feed.filter((c) => c.milk === m);
    return { m, liter: rows.reduce((a, c) => a + c.liter, 0), count: rows.length };
  });
  const online = centers.filter((c) => c.status !== 'offline');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live collection"
        subtitle="Each entry is what a machine just measured. It reaches the cloud, the dashboard and the farmer's phone in seconds."
        actions={<Button variant={running ? 'outline' : 'primary'} icon={running ? <Pause size={16} /> : <Play size={16} />} onClick={() => setRunning((r) => !r)}>{running ? 'Pause feed' : 'Resume feed'}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {totals.map((t) => (
          <Card key={t.m} className="flex items-center gap-4 p-5">
            <AnimalHead type={t.m} size={52} />
            <div>
              <p className="text-sm font-semibold text-mute">{MILK_META[t.m].label} this session</p>
              <p className="font-display text-3xl font-extrabold tnum">{nf(t.liter, 1)} <span className="text-base text-mute">L</span></p>
              <p className="text-xs text-mute">{t.count} farmers weighed</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="Latest slip" subtitle="What the farmer gets on the printed receipt" action={running ? <Badge tone="ok" dot>Receiving</Badge> : <Badge>Paused</Badge>} />
            <div className="p-5 sm:p-6">
              <AnimatePresence mode="wait">
                {latest ? (
                  <motion.div key={latest.id} initial={{ opacity: 0, y: -24, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ type: 'spring', damping: 18 }} className="relative rounded-2xl bg-cream/40 p-5 dark:bg-soft" style={{ clipPath: 'polygon(0 0,100% 0,100% calc(100% - 10px),96% 100%,92% calc(100% - 10px),88% 100%,84% calc(100% - 10px),80% 100%,76% calc(100% - 10px),72% 100%,68% calc(100% - 10px),64% 100%,60% calc(100% - 10px),56% 100%,52% calc(100% - 10px),48% 100%,44% calc(100% - 10px),40% 100%,36% calc(100% - 10px),32% 100%,28% calc(100% - 10px),24% 100%,20% calc(100% - 10px),16% 100%,12% calc(100% - 10px),8% 100%,4% calc(100% - 10px),0 100%)' }}>
                    <div className="flex items-start justify-between">
                      <div><p className="text-xs text-mute">Farmer {farmerById.get(latest.farmerId)?.code}</p><p className="font-display text-xl font-extrabold">{farmerById.get(latest.farmerId)?.name}</p></div>
                      <MilkTypeChip type={latest.milk} />
                    </div>
                    <div className="my-4 grid grid-cols-3 gap-3 border-y border-dashed border-ink/20 py-4 text-center">
                      <div><p className="font-display text-2xl font-extrabold tnum">{latest.liter}</p><p className="text-xs text-mute">Litres</p></div>
                      <div><p className="font-display text-2xl font-extrabold tnum">{latest.fat}</p><p className="text-xs text-mute">Fat %</p></div>
                      <div><p className="font-display text-2xl font-extrabold tnum">{latest.snf}</p><p className="text-xs text-mute">SNF %</p></div>
                    </div>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between"><dt className="text-mute">Rate per litre</dt><dd className="font-semibold tnum">{inr(latest.rate, 2)}</dd></div>
                      <div className="flex justify-between"><dt className="text-mute">CLR · Temp</dt><dd className="font-semibold tnum">{latest.clr} · {latest.temp}°C</dd></div>
                      <div className="flex justify-between border-t border-ink/10 pt-2 text-base"><dt className="font-bold">Amount</dt><dd className="font-display text-xl font-extrabold tnum">{inr(latest.amount, 2)}</dd></div>
                    </dl>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-mute"><Printer size={13} />{centerById.get(latest.centerId)?.name} · {latest.time}</p>
                  </motion.div>
                ) : <EmptyState title="Waiting for the first sample" hint="Entries appear here as soon as a farmer pours milk." />}
              </AnimatePresence>
            </div>
          </Card>

          <Card>
            <CardHeader title="Machines listening" subtitle={`${online.length} of ${centers.length} centres connected`} />
            <ul className="space-y-3 p-5 sm:p-6">
              {centers.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-soft/70 p-3">
                  <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-panel text-brand">
                    {c.status === 'online' && <span className="absolute inset-0 animate-ring rounded-xl bg-brand/25" />}
                    <Cpu size={18} className="relative" />
                  </span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.name}</p><p className="text-xs text-mute">Station {c.code}</p></div>
                  <Badge tone={c.status === 'online' ? 'ok' : c.status === 'syncing' ? 'warn' : 'danger'} dot>{c.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title="Incoming entries" subtitle="Newest first" />
          <ul className="mt-3 divide-y divide-line/70 px-2 pb-3">
            {feed.length === 0 && <li><EmptyState title="No entries yet" hint="The first sample arrives in a few seconds." /></li>}
            <AnimatePresence initial={false}>
              {feed.map((c) => {
                const f = farmerById.get(c.farmerId);
                const flag = flagOf(c, thresholds);
                return (
                  <motion.li key={c.id} layout initial={{ opacity: 0, height: 0, backgroundColor: 'rgb(20 150 155 / .14)' }} animate={{ opacity: 1, height: 'auto', backgroundColor: 'rgb(20 150 155 / 0)' }} transition={{ duration: 0.6 }} className="overflow-hidden rounded-xl">
                    <div className="flex flex-wrap items-center gap-3 px-3 py-3">
                      <AnimalHead type={c.milk} size={38} />
                      <div className="min-w-[8rem] flex-1"><p className="font-semibold">{f?.name}</p><p className="text-xs text-mute">{centerById.get(c.centerId)?.name} · {c.time}</p></div>
                      <div className="flex items-center gap-1 text-sm font-bold tnum"><Scale size={14} className="text-mute" />{c.liter} L</div>
                      <div className="text-xs text-mute tnum">Fat {c.fat} · SNF {c.snf}</div>
                      <div className="w-20 text-right font-bold tnum">{inr(c.amount)}</div>
                      {flag && <Badge tone="warn">{FLAG_META[flag].label}</Badge>}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default LiveCollection;
