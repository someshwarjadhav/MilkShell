import type * as React from 'react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Activity, Droplets, FlaskConical, Search, Wifi, WifiOff } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Field, Input, Segmented, Select } from '../../components/ui/Fields';
import { StatCard } from '../../components/ui/StatCard';
import { QueryBoundary } from '../../components/Widget';
import { MilkLoader } from '../../components/MilkLoader';
import { CardTitle, ReportBar, ReportDataBadge, ReportPage, Reveal, type ExportKind } from '../../components/ReportKit';
import { exportCSV, exportExcel, exportPDF, type ExportCol } from '../../lib/export';
import { useToast } from '../../context/ToastContext';
import { nf, fmtDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { todayISO } from '../../lib/format';
import { GLOBALSSHIFT } from '../../lib/global';
import { useQuery } from '../../hooks/useQuery';
import { useCenters } from '../../hooks/useSessionData';
import { fetchVlccCollection } from '../../services/vlcc/vlcc.service';
import { mapVlcc } from '../../services/mappers/vlcc.mapper';
import { vlcStatus, type StatusRow } from '../../services/mappers/report.mapper';
import { getSession } from '../../services/session';
import { vlccTitle } from '../../services/vlcc/names';
import type { RawVlccRow, ShiftCode } from '../../services/types/raw';

type Show = 'all' | 'active' | 'inactive';

/** One centre. Active: a wifi icon with a pulsing ring. Inactive: a red "no signal" icon that shakes now and then. */
const StatusCard: React.FC<{ r: StatusRow; index: number }> = ({ r, index }) => {
  const still = useReducedMotion();
  return (
    <motion.div layout initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: Math.min(index, 12) * 0.04, type: 'spring', damping: 22 }} whileHover={{ y: -4 }}>
      <Card className={cn('h-full p-4 text-center transition-colors', r.active ? 'hover:border-ok/60' : 'hover:border-danger/50')}>
        <p className="truncate font-display text-sm font-extrabold uppercase tracking-tight" title={vlccTitle(r.vlccid, r.village)}>{vlccTitle(r.vlccid, r.village)}</p>
        <p className="mt-0.5 text-xs font-semibold text-mute tnum">{r.vlccid}</p>

        <div className="relative mx-auto my-4 grid h-14 w-14 place-items-center">
          {r.active ? (
            <>
              {!still && <span className="absolute inset-0 animate-ring rounded-full bg-ok/30" />}
              <span className="relative grid h-14 w-14 place-items-center rounded-full bg-ok/15 text-ok"><Wifi size={26} /></span>
            </>
          ) : (
            <motion.span
              className="relative grid h-14 w-14 place-items-center rounded-full bg-danger/12 text-danger"
              animate={still ? undefined : { rotate: [0, -10, 10, -7, 7, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 3.5 }}
            >
              <WifiOff size={26} />
            </motion.span>
          )}
        </div>

        <Badge tone={r.active ? 'ok' : 'danger'} dot>{r.active ? 'Active' : 'In Active'}</Badge>

        <dl className="mt-3 space-y-1 text-xs">
          <div className="flex items-center justify-between rounded-lg bg-soft px-2.5 py-1.5"><dt className="font-semibold text-mute">Lit</dt><dd className="font-bold tnum">{r.liter.toFixed(2)}</dd></div>
          <div className="flex items-center justify-between rounded-lg bg-soft px-2.5 py-1.5"><dt className="font-semibold text-mute">Fat</dt><dd className="font-bold tnum">{r.fat.toFixed(2)}</dd></div>
          <div className="flex items-center justify-between rounded-lg bg-soft px-2.5 py-1.5"><dt className="font-semibold text-mute">SNF</dt><dd className="font-bold tnum">{r.snf.toFixed(2)}</dd></div>
        </dl>
        {r.lastDate && <p className="mt-2 text-[11px] text-mute">Last milk: {r.lastDate}</p>}
      </Card>
    </motion.div>
  );
};

const VlcStatus: React.FC = () => {
  const today = todayISO();
  const toast = useToast();
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];

  const [scope, setScope] = useState('');
  const [shift, setShift] = useState<ShiftCode>('M');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: today, to: today, shift: 'M' as ShiftCode, scope: '' });
  const [show, setShow] = useState<Show>('all');
  const [needle, setNeedle] = useState('');

  const allIds = centers.length ? centers.map((c) => c.id) : sessionIds;
  const hasAppliedCentre = Boolean(applied.scope);
  const scopeIds = hasAppliedCentre ? [applied.scope] : [];

  const key = `vlcstatus:${applied.from}:${applied.to}:${applied.shift}:${applied.scope}`;
  const q = useQuery<RawVlccRow>(hasAppliedCentre ? key : null, (emit) =>
    fetchVlccCollection({ from: applied.from, to: applied.to, shift: applied.shift, milk: 'ALL', vlccIds: scopeIds, priority: 0 }, emit));

  const mapped = useMemo(() => mapVlcc(q.rows), [q.rows]);
  const all = useMemo(() => vlcStatus(scopeIds, mapped, (id) => vlccTitle(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapped, applied.scope]);

  const activeCount = all.filter((r) => r.active).length;
  const shown = all
    .filter((r) => show === 'all' || (show === 'active') === r.active)
    .filter((r) => !needle.trim() || `${vlccTitle(r.vlccid, r.village)} ${r.vlccid}`.toLowerCase().includes(needle.trim().toLowerCase()));
  const totalLit = all.reduce((a, r) => a + r.liter, 0);
  const avgFat = totalLit ? all.reduce((a, r) => a + r.liter * r.fat, 0) / totalLit : 0;
  const shownActive = shown.filter((r) => r.active).length;
  const shownLitres = shown.reduce((a, r) => a + r.liter, 0);

  const loading = q.status === 'loading' || (q.fetching && q.rows.length === 0);
  const err = q.status === 'error';
  const statError = err ? q.error?.message : undefined;
  const exportCols: ExportCol<StatusRow>[] = [
    { header: 'VLC Id', value: (r) => r.vlccid },
    { header: 'Centre', value: (r) => vlccTitle(r.vlccid, r.village) },
    { header: 'Status', value: (r) => r.active ? 'Active' : 'Inactive' },
    { header: 'Litres', value: (r) => r.liter.toFixed(2) },
    { header: 'Fat', value: (r) => r.fat.toFixed(2) },
    { header: 'SNF', value: (r) => r.snf.toFixed(2) },
    { header: 'Last milk date', value: (r) => r.lastDate || '—' },
  ];
  const run = (kind: ExportKind) => {
    const name = `vlc-status-${applied.from}-to-${applied.to}`;
    const cols = exportCols.filter((c) => c.header !== 'Last milk date' || shown.some((r) => r.lastDate));
    if (kind === 'pdf') {
      exportPDF(name, cols, shown, {
        subtitle: `Centre activity · ${fmtDate(applied.from)} to ${fmtDate(applied.to)}`,
        meta: [['Centre', vlccTitle(applied.scope)], ['Shift', GLOBALSSHIFT.shiftOptions.find((s) => s.Id === applied.shift)?.Name ?? applied.shift], ['Status filter', show]],
        summary: [
          { label: 'Centres', value: nf(shown.length) },
          { label: 'Active', value: nf(shownActive), tone: 'ok' },
          { label: 'Inactive', value: nf(shown.length - shownActive), tone: 'danger' },
          { label: 'Total litres', value: nf(shownLitres, 2) },
        ],
        note: 'A centre is active when portal VLC collection reports litres in the selected date range and shift.',
      });
      toast('Print dialog opened — choose Save as PDF to download');
    } else if (kind === 'csv') {
      exportCSV(name, cols, shown);
      toast('CSV file downloaded');
    } else {
      exportExcel(name, cols, shown);
      toast('XLS file downloaded');
    }
  };

  return (
    <ReportPage title="VLC Status" subtitle="Check whether a selected centre sent milk for the chosen dates and shift.">

      {hasAppliedCentre && <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Centres" value={all.length} icon={<Activity size={18} />} tone="text-brand" hint={`${activeCount} active`} loading={loading} error={statError} onRetry={q.retry} />
        <StatCard label="Active" value={activeCount} icon={<Wifi size={18} />} tone="text-ok" hint="Sent milk" loading={loading} error={statError} onRetry={q.retry} />
        <StatCard label="In Active" value={all.length - activeCount} icon={<WifiOff size={18} />} tone="text-danger" hint="No milk received" loading={loading} error={statError} onRetry={q.retry} />
        <StatCard label="Total litres" value={totalLit} decimals={1} icon={<Droplets size={18} />} tone="text-buffalo" hint={`Avg fat ${avgFat.toFixed(2)}`} loading={loading} error={statError} onRetry={q.retry} />
      </div>}

      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={Activity}>MCC/VLC Info</CardTitle>} subtitle="Choose a centre, shift and dates, then press Submit." />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr]">
            <Field label="Centre">
              <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="">Select a centre</option>
                {allIds.map((id) => <option key={id} value={id}>{vlccTitle(id)} · {id}</option>)}
              </Select>
            </Field>
            <Field label="Shift">
              <Select value={shift} onChange={(e) => setShift(e.target.value as ShiftCode)}>
                {GLOBALSSHIFT.shiftOptions.map((m) => <option key={m.Id} value={m.Id}>{m.Name}</option>)}
              </Select>
            </Field>
            <Field label="From Date"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To Date"><Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <Button className="w-full" icon={<Search size={16} />} loading={q.fetching && q.rows.length === 0} disabled={!scope} onClick={() => setApplied({ from, to, shift, scope })}>Submit</Button>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar count={shown.length} hideCount={loading || err} disabled={loading || err || shown.length === 0} kinds={['xls', 'pdf', 'csv']} onExport={run} source={<ReportDataBadge state={{ fetching: q.fetching, stale: q.stale, updatedAt: q.updatedAt, failed: q.failed, total: q.total, error: q.error, hasData: q.rows.length > 0 }} />} />
          <CardHeader
            title={<CardTitle icon={Wifi} tone="text-ok">VLC Active/In Active</CardTitle>}
            subtitle={!loading && !err ? `${activeCount} of ${all.length} centres are active` : undefined}
            action={
              <div className="flex flex-wrap items-center gap-3">
                <div className="overflow-x-auto">
                  <Segmented value={show} onChange={setShow} options={[{ value: 'all', label: `All ${all.length}` }, { value: 'active', label: `Active ${activeCount}` }, { value: 'inactive', label: `In Active ${all.length - activeCount}` }]} />
                </div>
                <div className="w-48"><Input icon={<Search size={16} />} placeholder="Find a centre" value={needle} onChange={(e) => setNeedle(e.target.value)} /></div>
              </div>
            }
          />
          {!hasAppliedCentre ? (
            <p className="px-6 py-14 text-center text-sm text-mute">Select a centre and press Submit to check its status.</p>
          ) : <div className="p-5 sm:p-6">
            {loading ? (
              <MilkLoader label="Checking selected centre…" />
            ) : (
              <QueryBoundary q={q} skeleton={<MilkLoader label="Checking selected centre…" />} showWhenEmpty>
                {shown.length === 0 ? (
                  <p className="py-10 text-center text-sm text-mute">No centre matches this filter.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                    <AnimatePresence mode="popLayout">
                      {shown.map((r, i) => <StatusCard key={r.vlccid} r={r} index={i} />)}
                    </AnimatePresence>
                  </div>
                )}
                <p className="mt-5 flex items-center gap-1.5 text-xs text-mute"><FlaskConical size={13} />A centre is Active when it has litres in the chosen dates and shift. Fat and SNF are weighted by litres.</p>
              </QueryBoundary>
            )}
          </div>
          }
        </Card>
      
      </Reveal>
    </ReportPage>
  );
};

export default VlcStatus;
