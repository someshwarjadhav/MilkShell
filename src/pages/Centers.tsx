import type * as React from 'react';
import { useMemo } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { KindChip } from '../components/KindChip';
import { LoadingBlock, Notice } from '../components/Widget';
import { nf, todayISO } from '../lib/format';
import { isoFromTrdate } from '../services/utils/date';
import { sampleStamp } from '../services/farmer/farmerBook';
import { isLoadingQ, useSamples } from '../hooks/useSmartxData';
import { getSession } from '../services/session';
import { vlccTitle } from '../services/vlcc/names';
import { refetchAll } from '../hooks/useQuery';
import { type Kind } from '../services/utils/milk';

const Centers: React.FC = () => {
  const today = todayISO();
  const ids = getSession()?.vlccIds ?? [];
  const { q, rows } = useSamples(today, today);

  const centres = useMemo(() => ids.map((id) => {
    const mine = rows.filter((r) => r.vlccid === id && isoFromTrdate(r.date) === today);
    const byKind: Partial<Record<Kind, number>> = {};
    let liter = 0, amount = 0;
    const farmers = new Set<string>();
    for (const r of mine) {
      liter += r.liter;
      amount += r.amount;
      farmers.add(r.farmerKey);
      if (r.milk) byKind[r.milk] = (byKind[r.milk] ?? 0) + r.liter;
    }
    const last = [...mine].sort((a, b) => (sampleStamp(a) < sampleStamp(b) ? 1 : -1))[0];
    return { id, village: mine.find((r) => r.village)?.village ?? '', liter, amount, farmers: farmers.size, samples: mine.length, byKind, lastTime: last?.time ?? '' };
  }), [ids, rows, today]);

  const loading = isLoadingQ(q);
  return (
    <div className="space-y-6">
      <PageHeader title="Centres" subtitle="Your village collection points (VLCs), with what each received today." actions={<Button variant="outline" icon={<RefreshCw size={16} />} loading={q.fetching} onClick={refetchAll}>Refresh</Button>} />
      <Notice q={q} />
      {loading ? <LoadingBlock height="h-48" q={q} /> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {centres.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-bold">{vlccTitle(c.id, c.village)}</h3><p className="mt-0.5 flex items-center gap-1 text-sm text-mute"><MapPin size={13} />VLC {c.id}</p></div>
                  <Badge tone={c.samples > 0 ? 'ok' : 'neutral'} dot>{c.samples > 0 ? 'Receiving' : 'No milk yet'}</Badge>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-soft p-3"><p className="font-display text-xl font-extrabold tnum">{nf(c.liter, 1)}</p><p className="text-xs text-mute">Litres today</p></div>
                  <div className="rounded-2xl bg-soft p-3"><p className="font-display text-xl font-extrabold tnum">{c.farmers}</p><p className="text-xs text-mute">Farmers</p></div>
                  <div className="rounded-2xl bg-soft p-3"><p className="font-display text-xl font-extrabold tnum">{c.samples}</p><p className="text-xs text-mute">Samples</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(c.byKind) as Kind[]).map((k) => <span key={k} className="flex items-center gap-1.5"><KindChip kind={k} /><span className="text-xs font-semibold tnum">{nf(c.byKind[k] ?? 0, 1)} L</span></span>)}
                  {c.samples === 0 && <span className="text-xs text-mute">Nothing received so far today.</span>}
                </div>
                <p className="mt-4 text-xs text-mute">{c.lastTime ? `Last sample at ${c.lastTime}` : 'No sample today'}{c.amount > 0 ? ` · ₹${nf(c.amount)} payable` : ''}</p>
              </Card>
            </motion.div>
          ))}
          {centres.length === 0 && <Card className="p-6 text-sm text-mute">No VLC id found for this login.</Card>}
        </div>
      )}
      <p className="text-xs text-mute">Machine status, calibration and sync are not provided by the SmartX portal API, so they are not shown here.</p>
    </div>
  );
};

export default Centers;
