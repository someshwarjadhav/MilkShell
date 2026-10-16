import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Phone, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useChartColors } from '../context/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Drawer, Modal } from '../components/ui/Modal';
import { Field, Input, Select } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { MilkTypeChip } from '../components/MilkTypeChip';
import { AnimalHead } from '../components/Illustrations';
import { ChartTip } from '../components/ChartTip';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { addDays, fmtDate, fmtShort, inr, nf, todayISO } from '../lib/format';
import { dailySeries, summarize } from '../lib/stats';
import { cn } from '../lib/cn';
import type { Farmer, MilkType } from '../types';

interface Row extends Farmer { week: number }

const Farmers: React.FC = () => {
  const { farmers, collections, centers, centerById, addFarmer, toggleFarmer } = useData();
  const toast = useToast();
  const cc = useChartColors();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [center, setCenter] = useState('all');
  const [milk, setMilk] = useState<'all' | MilkType>('all');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', village: '', centerId: centers[0]?.id ?? '', phone: '', milkTypes: ['cow'] as MilkType[] });
  const today = todayISO();

  useEffect(() => { const o = params.get('open'); if (o) setOpenId(o); }, [params]);

  const weekly = useMemo(() => {
    const m = new Map<string, number>();
    const start = addDays(today, -6);
    for (const c of collections) if (c.date >= start) m.set(c.farmerId, (m.get(c.farmerId) ?? 0) + c.liter);
    return m;
  }, [collections, today]);

  const rows: Row[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    return farmers
      .filter((f) => center === 'all' || f.centerId === center)
      .filter((f) => milk === 'all' || f.milkTypes.includes(milk))
      .filter((f) => !s || f.name.toLowerCase().includes(s) || f.code.includes(s) || f.village.toLowerCase().includes(s))
      .map((f) => ({ ...f, week: weekly.get(f.id) ?? 0 }));
  }, [farmers, q, center, milk, weekly]);

  const cols: Column<Row>[] = [
    { key: 'code', header: 'ID', sort: (f) => f.code, cell: (f) => f.code },
    { key: 'name', header: 'Farmer', sort: (f) => f.name, cell: (f) => <div><p className="font-semibold">{f.name}</p><p className="text-xs text-mute">{f.village}</p></div> },
    { key: 'center', header: 'Centre', cell: (f) => centerById.get(f.centerId)?.name },
    { key: 'milk', header: 'Milk types', cell: (f) => <div className="flex gap-1">{f.milkTypes.map((m) => <MilkTypeChip key={m} type={m} compact />)}</div> },
    { key: 'week', header: 'Last 7 days', align: 'right', sort: (f) => f.week, cell: (f) => <span className="font-bold">{nf(f.week)} L</span> },
    { key: 'adv', header: 'Advance', align: 'right', sort: (f) => f.advance, cell: (f) => (f.advance ? inr(f.advance) : '—') },
    { key: 'status', header: 'Status', cell: (f) => <Badge tone={f.active ? 'ok' : 'neutral'} dot>{f.active ? 'Active' : 'Paused'}</Badge> },
  ];

  const open = farmers.find((f) => f.id === openId) ?? null;
  const detail = useMemo(() => {
    if (!open) return null;
    const mine = collections.filter((c) => c.farmerId === open.id);
    const s = summarize(mine);
    const series = dailySeries(mine, today, 14);
    const byMilk = MILK_TYPES.map((m) => ({ m, ...summarize(mine.filter((c) => c.milk === m)) })).filter((x) => x.count > 0);
    const recent = [...mine].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)).slice(0, 6);
    return { s, series, byMilk, recent };
  }, [open, collections, today]);

  const close = () => { setOpenId(null); if (params.get('open')) setParams({}); };
  const toggleMilk = (m: MilkType) => setForm((f) => ({ ...f, milkTypes: f.milkTypes.includes(m) ? f.milkTypes.filter((x) => x !== m) : [...f.milkTypes, m] }));
  const valid = form.name.trim().length > 1 && form.village.trim().length > 1 && /^\d{10}$/.test(form.phone) && form.milkTypes.length > 0;

  const save = () => {
    const f = addFarmer({ ...form, name: form.name.trim(), village: form.village.trim() });
    toast(`${f.name} added as farmer ${f.code}`);
    setAdding(false);
    setForm({ name: '', village: '', centerId: centers[0]?.id ?? '', phone: '', milkTypes: ['cow'] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Farmers" subtitle={`${farmers.length} members across ${centers.length} centres. Open a farmer to see their ledger.`} actions={<Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add farmer</Button>} />
      <Card>
        <div className="grid gap-4 border-b border-line p-5 sm:grid-cols-3 sm:p-6">
          <Field label="Search"><Input icon={<Search size={16} />} placeholder="Name, ID or village" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <Field label="Centre"><Select value={center} onChange={(e) => setCenter(e.target.value)}><option value="all">All centres</option>{centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Milk type"><Select value={milk} onChange={(e) => setMilk(e.target.value as 'all' | MilkType)}><option value="all">All milk</option>{MILK_TYPES.map((m) => <option key={m} value={m}>{MILK_META[m].label}</option>)}</Select></Field>
        </div>
        <DataTable columns={cols} rows={rows} rowKey={(f) => f.id} pageSize={10} onRowClick={(f) => setOpenId(f.id)} />
      </Card>

      <Drawer open={!!open} onClose={close} title={open?.name ?? ''} subtitle={open ? `Farmer ${open.code} · ${open.village} · joined ${fmtDate(open.joined)}` : ''}>
        {open && detail && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[{ l: 'Litres (30 d)', v: nf(detail.s.liter) }, { l: 'Average fat', v: detail.s.avgFat.toFixed(2) }, { l: 'Earned (30 d)', v: inr(detail.s.amount) }].map((x) => (
                <div key={x.l} className="rounded-2xl bg-soft p-3"><p className="text-xs text-mute">{x.l}</p><p className="font-display text-xl font-extrabold tnum">{x.v}</p></div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Last 14 days</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={detail.series}>
                    <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fill: cc.tick, fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={16} />
                    <Tooltip cursor={{ fill: cc.grid, opacity: 0.5 }} content={<ChartTip format={(v) => `${nf(v)} L`} title={(l) => fmtDate(String(l))} />} />
                    {MILK_TYPES.map((m) => <Bar key={m} dataKey={m} name={MILK_META[m].label} stackId="a" fill={MILK_META[m].hex} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">By milk type</p>
              <ul className="space-y-2">
                {detail.byMilk.map((x) => (
                  <li key={x.m} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                    <AnimalHead type={x.m} size={36} />
                    <div className="flex-1"><p className="font-semibold">{MILK_META[x.m].label}</p><p className="text-xs text-mute">Fat {x.avgFat.toFixed(2)} · SNF {x.avgSnf.toFixed(2)}</p></div>
                    <div className="text-right"><p className="font-bold tnum">{nf(x.liter)} L</p><p className="text-xs text-mute tnum">{inr(x.amount)}</p></div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Recent samples</p>
              <ul className="divide-y divide-line/70 text-sm">
                {detail.recent.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2"><span>{fmtShort(c.date)} · {c.shift === 'morning' ? 'AM' : 'PM'} · {MILK_META[c.milk].label}</span><span className="tnum text-mute">{c.liter} L · {c.fat}/{c.snf}</span><span className="font-bold tnum">{inr(c.amount)}</span></li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-soft p-4 text-sm">
              <span className="flex items-center gap-2"><Phone size={15} className="text-mute" />+91 {open.phone}</span>
              <span className="text-mute">Advance balance <b className="text-ink">{inr(open.advance)}</b></span>
              <Button className="ml-auto" size="sm" variant={open.active ? 'danger' : 'soft'} icon={open.active ? <UserX size={14} /> : <UserCheck size={14} />} onClick={() => { toggleFarmer(open.id); toast(open.active ? 'Farmer paused' : 'Farmer reactivated', 'info'); }}>{open.active ? 'Pause farmer' : 'Reactivate'}</Button>
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add farmer" subtitle="The farmer ID is assigned automatically."
        footer={<><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button disabled={!valid} onClick={save}>Save farmer</Button></>}>
        <div className="space-y-4">
          <Field label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sanjay Patil" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Village"><Input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} /></Field>
            <Field label="Mobile number" hint="10 digits, used for SMS slips"><Input inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} /></Field>
          </div>
          <Field label="Collection centre"><Select value={form.centerId} onChange={(e) => setForm({ ...form, centerId: e.target.value })}>{centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold">Milk types poured</p>
            <div className="grid grid-cols-3 gap-2">
              {MILK_TYPES.map((m) => {
                const on = form.milkTypes.includes(m);
                return (
                  <button key={m} type="button" aria-pressed={on} onClick={() => toggleMilk(m)} className={cn('flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-sm font-semibold transition-all', on ? `border-transparent ring-2 ${MILK_META[m].ring} bg-soft` : 'border-line text-mute hover:border-brand/50')}>
                    <AnimalHead type={m} size={40} />{MILK_META[m].label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Farmers;
