import type * as React from 'react';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Cloud, Cpu, FileBarChart, RefreshCw, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataTable, type Column } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { todayISO } from '../lib/format';
import { environment } from '../services/config';
import { isoFromTrdate } from '../services/utils/date';
import { sampleStamp } from '../services/farmer/farmerBook';
import { useSamples } from '../hooks/useSmartxData';
import { vlccTitle } from '../services/vlcc/names';
import { getSession } from '../services/session';
import { refetchAll } from '../hooks/useQuery';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Cpu, title: 'Analyzer machine', text: 'Reads fat, SNF, CLR and water. A scale adds the weight.' },
  { icon: Smartphone, title: 'Collector app', text: 'Pairs with the machine, saves each sample and prints the slip.' },
  { icon: Cloud, title: 'SmartX portal', text: 'Stores the sample, applies the rate chart and exposes the reports.' },
  { icon: FileBarChart, title: 'This dashboard', text: 'Reads the portal reports live: collections, farmers, rates and quality.' },
];

const ENDPOINTS = [
  { path: '/home/dashboardLinechart', use: 'Dashboard: collection trend' },
  { path: '/home/topMilkSupplier', use: 'Dashboard: top suppliers' },
  { path: '/home/VlccCollection', use: 'Dashboard grid, Collections: VLC collection' },
  { path: '/home/farmercollection', use: 'Collections, Farmers, Live, Centres, Rate chart, Billing, Quality' },
  { path: '/home/FarmerMilkEntry', use: 'Collections: Farmerwise collection' },
  { path: '/home/farmermaster', use: 'Farmers: registered farmers' },
];

const Connector: React.FC = () => (
  <>
    <svg className="mx-auto h-10 w-3 md:hidden" viewBox="0 0 12 40" aria-hidden><line x1="6" y1="0" x2="6" y2="40" className="flow-line" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" /></svg>
    <svg className="hidden h-3 w-full min-w-8 self-center md:block" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden><line x1="0" y1="6" x2="100" y2="6" className="flow-line" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
  </>
);

interface Latest { id: string; village: string; samples: number; last: string }

const Pipeline: React.FC = () => {
  const today = todayISO();
  const ids = getSession()?.vlccIds ?? [];
  const { q, rows } = useSamples(today, today);

  const latest = useMemo<Latest[]>(() => ids.map((id) => {
    const mine = rows.filter((r) => r.vlccid === id && isoFromTrdate(r.date) === today);
    const last = [...mine].sort((a, b) => (sampleStamp(a) < sampleStamp(b) ? 1 : -1))[0];
    return { id, village: mine.find((r) => r.village)?.village ?? '', samples: mine.length, last: last?.time ?? '' };
  }), [ids, rows, today]);

  const cols: Column<Latest>[] = [
    { key: 'c', header: 'Centre', cell: (l) => <div><p className="font-semibold">{vlccTitle(l.id, l.village)}</p><p className="text-xs text-mute">VLC {l.id}</p></div> },
    { key: 'n', header: 'Samples today', align: 'right', sort: (l) => l.samples, cell: (l) => l.samples },
    { key: 'last', header: 'Last sample', cell: (l) => l.last || '—' },
    { key: 's', header: 'Status', cell: (l) => <Badge tone={l.samples > 0 ? 'ok' : 'neutral'} dot>{l.samples > 0 ? 'Sending data' : 'Nothing yet today'}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Data pipeline" subtitle="How a farmer's can of milk becomes a record here, and what this dashboard is reading right now." actions={<Button variant="outline" icon={<RefreshCw size={16} />} loading={q.fetching} onClick={refetchAll}>Check again</Button>} />

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

      <Card>
        <CardHeader title="Latest data per centre" subtitle="From today's farmer samples on the portal" />
        <div className="mt-3"><DataTable columns={cols} rows={latest} rowKey={(l) => l.id} pageSize={10} pageSizes={[10]} empty={<p className="px-6 py-10 text-center text-sm text-mute">No centre found for this login.</p>} /></div>
      </Card>

      <Card>
        <CardHeader title="Portal endpoints in use" subtitle={`All calls go through ${environment.staticIP}<endpoint>`} />
        <ul className="divide-y divide-line/70 px-5 pb-3 pt-1 sm:px-6">
          {ENDPOINTS.map((e) => (
            <li key={e.path} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><code className="rounded-lg bg-soft px-2 py-1 text-xs font-semibold">{e.path}</code><span className="text-mute">{e.use}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default Pipeline;
