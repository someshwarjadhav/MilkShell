import type * as React from 'react';
import { useMemo } from 'react';
import { AlertTriangle, Cpu, MapPin, RefreshCw, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, type Column } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { daysBetween, fmtDate, nf, timeAgo, todayISO } from '../lib/format';
import { summarize } from '../lib/stats';
import type { Machine } from '../types';

const tone = { online: 'ok', syncing: 'warn', offline: 'danger' } as const;

const Centers: React.FC = () => {
  const { centers, machines, collections, farmers, centerById, syncCenter, syncAll, calibrate } = useData();
  const toast = useToast();
  const today = todayISO();
  const stats = useMemo(() => {
    const todays = collections.filter((c) => c.date === today);
    return new Map(centers.map((c) => [c.id, { ...summarize(todays.filter((x) => x.centerId === c.id)), members: farmers.filter((f) => f.centerId === c.id).length }]));
  }, [collections, centers, farmers, today]);

  const cols: Column<Machine>[] = [
    { key: 'model', header: 'Device', sort: (m) => m.model, cell: (m) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-soft text-brand"><Cpu size={16} /></span><div><p className="font-semibold">{m.model}</p><p className="text-xs text-mute">{m.kind} · {m.serial}</p></div></div> },
    { key: 'center', header: 'Centre', sort: (m) => centerById.get(m.centerId)?.name ?? '', cell: (m) => centerById.get(m.centerId)?.name },
    { key: 'fw', header: 'Firmware', cell: (m) => m.firmware },
    { key: 'status', header: 'Status', cell: (m) => <Badge tone={tone[m.status]} dot>{m.status}</Badge> },
    { key: 'ping', header: 'Last ping', sort: (m) => m.lastPing, cell: (m) => timeAgo(m.lastPing) },
    {
      key: 'cal', header: 'Calibrated', sort: (m) => m.calibratedOn,
      cell: (m) => { const d = daysBetween(m.calibratedOn, today); return <span className={d > 90 ? 'font-semibold text-danger' : ''}>{fmtDate(m.calibratedOn)}{d > 90 && ' · overdue'}</span>; },
    },
    { key: 'act', header: '', align: 'right', cell: (m) => <Button size="sm" variant="soft" icon={<Wrench size={13} />} onClick={() => { calibrate(m.id); toast('Calibration recorded'); }}>Calibrate</Button> },
  ];

  const overdue = machines.filter((m) => daysBetween(m.calibratedOn, today) > 90).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centres & devices"
        subtitle="Village collection points, chilling centres and the machines inside them."
        actions={<Button icon={<RefreshCw size={16} />} onClick={() => { syncAll(); toast('Syncing all centres'); }}>Sync all</Button>}
      />
      {overdue > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm font-medium"><AlertTriangle size={18} className="text-warn" />{overdue} device{overdue > 1 ? 's are' : ' is'} past the 90-day calibration window. Inaccurate fat readings affect farmer payments.</div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {centers.map((c, i) => {
          const s = stats.get(c.id);
          const syncing = c.status === 'syncing';
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h3 className="text-lg font-bold">{c.name}</h3></div><p className="mt-0.5 flex items-center gap-1 text-sm text-mute"><MapPin size={13} />{c.village} · Station {c.code}</p></div>
                  <div className="flex flex-col items-end gap-1.5"><Badge tone="brand">{c.kind}</Badge><Badge tone={tone[c.status]} dot>{c.status}</Badge></div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-soft p-3"><p className="font-display text-xl font-extrabold tnum">{nf(s?.liter ?? 0)}</p><p className="text-xs text-mute">Litres today</p></div>
                  <div className="rounded-2xl bg-soft p-3"><p className="font-display text-xl font-extrabold tnum">{s?.farmers ?? 0}</p><p className="text-xs text-mute">Farmers</p></div>
                  <div className="rounded-2xl bg-soft p-3"><p className="font-display text-xl font-extrabold tnum">{s?.members ?? 0}</p><p className="text-xs text-mute">Members</p></div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-mute"><span>Chilling capacity</span><span className="tnum">{nf(c.capacityL)} L</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand transition-all duration-1000" style={{ width: `${Math.min(100, ((s?.liter ?? 0) / c.capacityL) * 300)}%` }} /></div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-mute">Last sync {timeAgo(c.lastSync)}</p>
                  <Button size="sm" variant="outline" loading={syncing} icon={<RefreshCw size={13} />} onClick={() => { syncCenter(c.id); toast(`Syncing ${c.name}`, 'info'); }}>Sync now</Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      <Card>
        <CardHeader title="Machines" subtitle="Analyzers, weighing scales and displays" />
        <div className="mt-3"><DataTable columns={cols} rows={machines} rowKey={(m) => m.id} pageSize={10} pageSizes={[10, 25]} /></div>
      </Card>
    </div>
  );
};

export default Centers;
