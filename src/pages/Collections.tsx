import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, RotateCcw, Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Field, Input, Segmented, Select } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { MilkTypeChip } from '../components/MilkTypeChip';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { flagOf, FLAG_META } from '../lib/quality';
import { addDays, fmtDate, inr, nf, todayISO } from '../lib/format';
import { exportCSV, exportExcel, exportPDF, type ExportCol } from '../lib/export';
import { groupBy, summarize } from '../lib/stats';
import type { Collection, MilkType, Shift } from '../types';
import { Droplets, FlaskConical, IndianRupee, Users } from 'lucide-react';

type View = 'detailed' | 'farmer' | 'center' | 'day' | 'milk';
interface Group { key: string; label: string; sub: string; liter: number; kg: number; avgFat: number; avgSnf: number; amount: number; count: number; farmers: number }

const Collections: React.FC = () => {
  const { collections, farmerById, centerById, centers, thresholds } = useData();
  const toast = useToast();
  const today = todayISO();
  const [center, setCenter] = useState('all');
  const [milk, setMilk] = useState<'all' | MilkType>('all');
  const [shift, setShift] = useState<'both' | Shift>('both');
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>('detailed');

  const reset = () => { setCenter('all'); setMilk('all'); setShift('both'); setFrom(addDays(today, -6)); setTo(today); setQ(''); };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return collections
      .filter((c) => c.date >= from && c.date <= to)
      .filter((c) => center === 'all' || c.centerId === center)
      .filter((c) => milk === 'all' || c.milk === milk)
      .filter((c) => shift === 'both' || c.shift === shift)
      .filter((c) => {
        if (!s) return true;
        const f = farmerById.get(c.farmerId);
        return !!f && (f.name.toLowerCase().includes(s) || f.code.includes(s));
      })
      .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  }, [collections, from, to, center, milk, shift, q, farmerById]);

  const sum = useMemo(() => summarize(rows), [rows]);

  const groups = useMemo<Group[]>(() => {
    const keyOf: Record<Exclude<View, 'detailed'>, (c: Collection) => string> = {
      farmer: (c) => c.farmerId, center: (c) => c.centerId, day: (c) => c.date, milk: (c) => c.milk,
    };
    if (view === 'detailed') return [];
    const labelOf = (k: string): [string, string] => {
      if (view === 'farmer') { const f = farmerById.get(k); return [f?.name ?? k, `ID ${f?.code} · ${f?.village}`]; }
      if (view === 'center') { const c = centerById.get(k); return [c?.name ?? k, `Station ${c?.code}`]; }
      if (view === 'day') return [fmtDate(k), ''];
      return [MILK_META[k as MilkType].label, MILK_META[k as MilkType].local];
    };
    return [...groupBy(rows, keyOf[view])].map(([k, rs]) => {
      const s = summarize(rs);
      const [label, sub] = labelOf(k);
      return { key: k, label, sub, liter: s.liter, kg: s.kg, avgFat: s.avgFat, avgSnf: s.avgSnf, amount: s.amount, count: s.count, farmers: s.farmers };
    }).sort((a, b) => (view === 'day' ? (a.key < b.key ? 1 : -1) : b.liter - a.liter));
  }, [rows, view, farmerById, centerById]);

  const detailCols: Column<Collection>[] = [
    { key: 'date', header: 'Date', sort: (c) => c.date + c.time, cell: (c) => fmtDate(c.date) },
    { key: 'shift', header: 'Shift', cell: (c) => <Badge tone={c.shift === 'morning' ? 'warn' : 'brand'}>{c.shift === 'morning' ? 'Morning' : 'Evening'}</Badge> },
    { key: 'fid', header: 'ID', sort: (c) => farmerById.get(c.farmerId)?.code ?? '', cell: (c) => farmerById.get(c.farmerId)?.code },
    { key: 'name', header: 'Farmer', sort: (c) => farmerById.get(c.farmerId)?.name ?? '', cell: (c) => <span className="font-semibold">{farmerById.get(c.farmerId)?.name}</span> },
    { key: 'milk', header: 'Milk', cell: (c) => <MilkTypeChip type={c.milk} /> },
    { key: 'liter', header: 'Litre', align: 'right', sort: (c) => c.liter, cell: (c) => c.liter.toFixed(2) },
    { key: 'kg', header: 'Kg', align: 'right', sort: (c) => c.kg, cell: (c) => c.kg.toFixed(2) },
    { key: 'fat', header: 'Fat', align: 'right', sort: (c) => c.fat, cell: (c) => c.fat.toFixed(1) },
    { key: 'snf', header: 'SNF', align: 'right', sort: (c) => c.snf, cell: (c) => c.snf.toFixed(1) },
    { key: 'clr', header: 'CLR', align: 'right', sort: (c) => c.clr, cell: (c) => c.clr.toFixed(1) },
    { key: 'time', header: 'Time', cell: (c) => c.time },
    { key: 'center', header: 'Centre', cell: (c) => centerById.get(c.centerId)?.name },
    { key: 'rate', header: 'Rate', align: 'right', sort: (c) => c.rate, cell: (c) => c.rate.toFixed(2) },
    { key: 'amt', header: 'Amount', align: 'right', sort: (c) => c.amount, cell: (c) => <span className="font-bold">{inr(c.amount, 2)}</span> },
    { key: 'flag', header: 'Check', cell: (c) => { const f = flagOf(c, thresholds); return f ? <Badge tone={f === 'water' ? 'danger' : 'warn'}>{FLAG_META[f].label}</Badge> : <span className="text-mute">—</span>; } },
  ];

  const groupHead = { farmer: 'Farmer', center: 'Centre', day: 'Date', milk: 'Milk type' }[view === 'detailed' ? 'farmer' : view];
  const groupCols: Column<Group>[] = [
    { key: 'label', header: groupHead, sort: (g) => g.label, cell: (g) => <div><p className="font-semibold">{g.label}</p>{g.sub && <p className="text-xs text-mute">{g.sub}</p>}</div> },
    { key: 'count', header: 'Samples', align: 'right', sort: (g) => g.count, cell: (g) => g.count },
    { key: 'farmers', header: 'Farmers', align: 'right', sort: (g) => g.farmers, cell: (g) => g.farmers },
    { key: 'liter', header: 'Litres', align: 'right', sort: (g) => g.liter, cell: (g) => <span className="font-bold">{nf(g.liter, 1)}</span> },
    { key: 'kg', header: 'Kg', align: 'right', sort: (g) => g.kg, cell: (g) => nf(g.kg, 1) },
    { key: 'fat', header: 'Avg fat', align: 'right', sort: (g) => g.avgFat, cell: (g) => g.avgFat.toFixed(2) },
    { key: 'snf', header: 'Avg SNF', align: 'right', sort: (g) => g.avgSnf, cell: (g) => g.avgSnf.toFixed(2) },
    { key: 'amt', header: 'Amount', align: 'right', sort: (g) => g.amount, cell: (g) => <span className="font-bold">{inr(g.amount)}</span> },
  ];

  const detailExport: ExportCol<Collection>[] = [
    { header: 'Date', value: (c) => c.date }, { header: 'Shift', value: (c) => c.shift },
    { header: 'Farmer ID', value: (c) => farmerById.get(c.farmerId)?.code ?? '' }, { header: 'Farmer', value: (c) => farmerById.get(c.farmerId)?.name ?? '' },
    { header: 'Milk', value: (c) => MILK_META[c.milk].label }, { header: 'Litre', value: (c) => c.liter }, { header: 'Kg', value: (c) => c.kg },
    { header: 'Fat', value: (c) => c.fat }, { header: 'SNF', value: (c) => c.snf }, { header: 'CLR', value: (c) => c.clr },
    { header: 'Time', value: (c) => c.time }, { header: 'Centre', value: (c) => centerById.get(c.centerId)?.name ?? '' },
    { header: 'Rate', value: (c) => c.rate }, { header: 'Amount', value: (c) => c.amount },
  ];
  const groupExport: ExportCol<Group>[] = [
    { header: groupHead, value: (g) => g.label }, { header: 'Samples', value: (g) => g.count }, { header: 'Farmers', value: (g) => g.farmers },
    { header: 'Litres', value: (g) => Math.round(g.liter * 10) / 10 }, { header: 'Kg', value: (g) => Math.round(g.kg * 10) / 10 },
    { header: 'Avg fat', value: (g) => g.avgFat.toFixed(2) }, { header: 'Avg SNF', value: (g) => g.avgSnf.toFixed(2) }, { header: 'Amount', value: (g) => Math.round(g.amount) },
  ];

  const name = `collection-${view}-${from}-to-${to}`;
  const run = (kind: 'csv' | 'xls' | 'pdf') => {
    if (view === 'detailed') (kind === 'csv' ? exportCSV : kind === 'xls' ? exportExcel : exportPDF)(name, detailExport, rows);
    else (kind === 'csv' ? exportCSV : kind === 'xls' ? exportExcel : exportPDF)(name, groupExport, groups);
    toast(kind === 'pdf' ? 'Print dialog opened — choose Save as PDF to download' : `${kind.toUpperCase()} file downloaded`);
  };

  const viewTabs: { value: View; label: string }[] = [
    { value: 'detailed', label: 'Every sample' }, { value: 'farmer', label: 'By farmer' }, { value: 'center', label: 'By centre' }, { value: 'day', label: 'By day' }, { value: 'milk', label: 'By milk type' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Collections" subtitle="The same data, sliced the way you need it: every sample, or totals per farmer, centre, day and milk type." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total litres" value={sum.liter} decimals={1} icon={<Droplets size={18} />} tone="text-brand" hint={`${nf(sum.kg, 1)} kg`} />
        <StatCard label="Average fat" value={sum.avgFat} decimals={2} suffix="%" icon={<FlaskConical size={18} />} tone="text-cow" />
        <StatCard label="Farmers" value={sum.farmers} icon={<Users size={18} />} tone="text-goat" hint={`${sum.count} samples`} />
        <StatCard label="Amount" value={sum.amount} prefix="₹" icon={<IndianRupee size={18} />} tone="text-buffalo" />
      </div>

      <Card>
        <CardHeader title="Filters" subtitle="Results update as you change them" action={<Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={reset}>Reset</Button>} />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-6">
          <Field label="Centre" className="lg:col-span-2"><Select value={center} onChange={(e) => setCenter(e.target.value)}><option value="all">All centres</option>{centers.map((c) => <option key={c.id} value={c.id}>{c.name} | {c.code}</option>)}</Select></Field>
          <Field label="Milk type"><Select value={milk} onChange={(e) => setMilk(e.target.value as 'all' | MilkType)}><option value="all">All milk</option>{MILK_TYPES.map((m) => <option key={m} value={m}>{MILK_META[m].label}</option>)}</Select></Field>
          <Field label="Shift"><Select value={shift} onChange={(e) => setShift(e.target.value as 'both' | Shift)}><option value="both">Both</option><option value="morning">Morning</option><option value="evening">Evening</option></Select></Field>
          <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Farmer name or ID" className="sm:col-span-2 lg:col-span-3"><Input icon={<Search size={16} />} placeholder="Start typing" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="overflow-x-auto"><Segmented value={view} onChange={setView} options={viewTabs} /></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" icon={<FileSpreadsheet size={15} />} onClick={() => run('xls')}>Excel</Button>
            <Button size="sm" variant="soft" icon={<Download size={15} />} onClick={() => run('csv')}>CSV</Button>
            <Button size="sm" variant="soft" icon={<FileText size={15} />} onClick={() => run('pdf')}>Print / PDF</Button>
          </div>
        </div>
        {view === 'detailed'
          ? <DataTable columns={detailCols} rows={rows} rowKey={(c) => c.id} pageSize={25} />
          : <DataTable columns={groupCols} rows={groups} rowKey={(g) => g.key} pageSize={25} />}
      </Card>
    </div>
  );
};

export default Collections;
