import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, Printer, Scale } from 'lucide-react';
import { useInterval } from '../components/hooks';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Pager } from '../components/ui/Pager';
import { PageHeader } from '../components/ui/PageHeader';
import { KindChip, KindDot } from '../components/KindChip';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock, Notice } from '../components/Widget';
import { vlccTitle } from '../services/vlcc/names';
import { useData } from '../context/DataContext';
import { flagOf, FLAG_META } from '../lib/quality';
import { inr, nf, todayISO } from '../lib/format';
import { KIND_META, type Kind } from '../services/utils/milk';
import { isoFromTrdate } from '../services/utils/date';
import { sampleStamp } from '../services/farmer/farmerBook';
import { isLoadingQ, useSamples } from '../hooks/useSmartxData';
import { getSession } from '../services/session';
import { cn } from '../lib/cn';

const HIGHLIGHT: Record<string, string> = {
  cow: 'bg-cow/15 ring-1 ring-inset ring-cow/40',
  buffalo: 'bg-buffalo/15 ring-1 ring-inset ring-buffalo/40',
  mix: 'bg-goat/15 ring-1 ring-inset ring-goat/40',
  goat: 'bg-goat/15 ring-1 ring-inset ring-goat/40',
};

const REFRESH_MS = 60_000;

const LiveCollection: React.FC = () => {
  const { thresholds } = useData();
  const today = todayISO();
  const [running, setRunning] = useState(true);
  const [entryPage, setEntryPage] = useState(1);
  const [entrySize, setEntrySize] = useState(10);
  const [centrePage, setCentrePage] = useState(1);
  const centreSize = 5;
  const { q, rows } = useSamples(today, today);
  const ids = getSession()?.vlccIds ?? [];

  useInterval(() => { if (!q.fetching) q.retry(); }, running ? REFRESH_MS : null);

  const feed = useMemo(
    () => rows.filter((r) => isoFromTrdate(r.date) === today).sort((a, b) => (sampleStamp(a) < sampleStamp(b) ? 1 : -1)),
    [rows, today],
  );
  const latest = feed[0];

  const seen = useRef<Set<string> | null>(null);
  const lit = useRef<Set<string>>(new Set());
  const keysNow = feed.map((r) => r.key);
  if (feed.length > 0) {
    if (seen.current === null) {
      seen.current = new Set(keysNow);
      lit.current = new Set([keysNow[0]]);
    } else {
      const fresh = keysNow.filter((k) => !seen.current!.has(k));
      if (fresh.length > 0) {
        lit.current = new Set(fresh);
        fresh.forEach((k) => seen.current!.add(k));
      }
    }
  }
  const kinds: Kind[] = ['cow', 'buffalo', 'mix'];
  const totals = kinds.map((k) => {
    const rs = feed.filter((r) => r.milk === k);
    return { k, liter: rs.reduce((a, r) => a + r.liter, 0), count: rs.length };
  });
  const perCentre = ids.map((id) => ({ id, count: feed.filter((r) => r.vlccid === id).length, village: feed.find((r) => r.vlccid === id)?.village ?? '' }));
  const loading = isLoadingQ(q);
  const entryPages = Math.max(1, Math.ceil(feed.length / entrySize));
  const entryAt = Math.min(entryPage, entryPages);
  const entryRows = feed.slice((entryAt - 1) * entrySize, entryAt * entrySize);
  const centrePages = Math.max(1, Math.ceil(perCentre.length / centreSize));
  const centreAt = Math.min(centrePage, centrePages);
  const centreRows = perCentre.slice((centreAt - 1) * centreSize, centreAt * centreSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live collection"
        subtitle="Today's samples exactly as the SmartX portal holds them. The list refreshes every minute."
        actions={<Button variant={running ? 'outline' : 'primary'} icon={running ? <Pause size={16} /> : <Play size={16} />} onClick={() => setRunning((r) => !r)}>{running ? 'Pause refresh' : 'Resume refresh'}</Button>}
      />
      <Notice q={q} />

      <div className="grid gap-4 sm:grid-cols-3">
        {totals.map((t) => (
          <Card key={t.k} className="flex items-center gap-4 p-5">
            <KindDot kind={t.k} size={52} />
            <div>
              <p className="text-sm font-semibold text-mute">{KIND_META[t.k].label} today</p>
              <p className="font-display text-3xl font-extrabold tnum">{nf(t.liter, 1)} <span className="text-base text-mute">L</span></p>
              <p className="text-xs text-mute">{t.count} samples</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <CardHeader title="Latest slip" subtitle="The newest sample received today" action={running ? <Badge tone="ok" dot>Auto refresh</Badge> : <Badge>Paused</Badge>} />
            <div className="p-5 sm:p-6">
              <AnimatePresence mode="wait">
                {latest ? (
                  <motion.div key={latest.key} initial={{ opacity: 0, y: -24, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ type: 'spring', damping: 18 }} className="relative rounded-2xl bg-cream/40 p-5 dark:bg-soft">
                    <div className="flex items-start justify-between">
                      <div><p className="text-xs text-mute">Farmer {latest.farmerId}</p><p className="font-display text-xl font-extrabold">{latest.farmerName}</p></div>
                      <KindChip kind={latest.milk} label={latest.milkLabel} />
                    </div>
                    <div className="my-4 grid grid-cols-3 gap-3 border-y border-dashed border-ink/20 py-4 text-center">
                      <div><p className="font-display text-2xl font-extrabold tnum">{latest.liter}</p><p className="text-xs text-mute">Litres</p></div>
                      <div><p className="font-display text-2xl font-extrabold tnum">{latest.fat}</p><p className="text-xs text-mute">Fat %</p></div>
                      <div><p className="font-display text-2xl font-extrabold tnum">{latest.snf}</p><p className="text-xs text-mute">SNF %</p></div>
                    </div>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between"><dt className="text-mute">Rate per litre</dt><dd className="font-semibold tnum">{inr(latest.rate, 2)}</dd></div>
                      <div className="flex justify-between"><dt className="text-mute">CLR · Water</dt><dd className="font-semibold tnum">{latest.clr} · {latest.water}</dd></div>
                      <div className="flex justify-between border-t border-ink/10 pt-2 text-base"><dt className="font-bold">Amount</dt><dd className="font-display text-xl font-extrabold tnum">{inr(latest.amount, 2)}</dd></div>
                    </dl>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-mute"><Printer size={13} />{vlccTitle(latest.vlccid, latest.village)} · {latest.time} · Sample {latest.sampleNo}</p>
                  </motion.div>
                ) : loading ? <LoadingBlock height="h-48" /> : <EmptyState title="No sample yet today" hint="Entries appear here as soon as a farmer pours milk." />}
              </AnimatePresence>
            </div>
          </Card>

          <Card className="flex flex-1 flex-col">
            <CardHeader title="Centres today" subtitle={`${perCentre.filter((c) => c.count > 0).length} of ${perCentre.length} centres have sent samples`} />
            <ul className="flex-1 space-y-3 p-5 sm:p-6">
              {centreRows.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-soft/70 p-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{vlccTitle(c.id, c.village)}</p><p className="text-xs text-mute">VLC {c.id}</p></div>
                  <Badge tone={c.count > 0 ? 'ok' : 'neutral'} dot>{c.count} samples</Badge>
                </li>
              ))}
            </ul>
            <Pager total={perCentre.length} page={centreAt} size={centreSize} onPage={setCentrePage} />
          </Card>
        </div>

        <Card className="flex flex-col">
          <CardHeader title="Incoming entries" subtitle={`Newest first · ${feed.length} today`} />
          <ul className="mt-3 flex-1 divide-y divide-line/70 px-2 pb-3">
            {feed.length === 0 && <li>{loading ? <LoadingBlock height="h-32" /> : <EmptyState title="No entries yet" hint="Nothing has been received from the centres today." />}</li>}
            {entryRows.map((c) => {
              const flag = flagOf(c, thresholds);
              return (
                <li key={c.key} className={cn('overflow-hidden rounded-xl transition-colors duration-500', lit.current.has(c.key) && HIGHLIGHT[c.milk ?? 'mix'])}>
                  <div className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <KindDot kind={c.milk ?? 'mix'} size={38} />
                    <div className="min-w-[8rem] flex-1"><p className="font-semibold">{c.farmerName}</p><p className="text-xs text-mute">{vlccTitle(c.vlccid, c.village)} · {c.time}</p></div>
                    <div className="flex items-center gap-1 text-sm font-bold tnum"><Scale size={14} className="text-mute" />{c.liter} L</div>
                    <div className="text-xs text-mute tnum">Fat {c.fat} · SNF {c.snf}</div>
                    <div className="w-20 text-right font-bold tnum">{inr(c.amount)}</div>
                    {flag && <Badge tone="warn">{FLAG_META[flag].label}</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pager total={feed.length} page={entryAt} size={entrySize} onPage={setEntryPage} onSize={(n) => { setEntrySize(n); setEntryPage(1); }} />
        </Card>
      </div>
    </div>
  );
};

export default LiveCollection;
