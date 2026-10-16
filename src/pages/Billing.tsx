import type * as React from 'react';
import { useMemo, useState } from 'react';
import { CheckCheck, Download, Printer, ReceiptIndianRupee } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Field, Select } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { addDays, fmtDate, inr, nf, todayISO } from '../lib/format';
import { exportCSV, exportPDF, type ExportCol } from '../lib/export';
import { groupBy, summarize } from '../lib/stats';
import { Droplets, IndianRupee, Wallet } from 'lucide-react';
import type { Farmer, MilkType } from '../types';

interface Cycle { start: string; end: string; label: string }
interface Bill { farmer: Farmer; liters: Record<MilkType, number>; total: number; gross: number; recovery: number; net: number }

function segment(date: string): Cycle {
  const d = Number(date.slice(8, 10));
  const ym = date.slice(0, 8);
  const last = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate();
  const [s, e] = d <= 10 ? [1, 10] : d <= 20 ? [11, 20] : [21, last];
  const start = `${ym}${String(s).padStart(2, '0')}`;
  const end = `${ym}${String(e).padStart(2, '0')}`;
  return { start, end, label: `${fmtDate(start)} to ${fmtDate(end)}` };
}
function cycles(today: string): Cycle[] {
  const out: Cycle[] = [];
  let cur = segment(today);
  for (let i = 0; i < 6; i++) { out.push(cur); cur = segment(addDays(cur.start, -1)); }
  return out;
}

const Billing: React.FC = () => {
  const { collections, farmers } = useData();
  const toast = useToast();
  const list = useMemo(() => cycles(todayISO()), []);
  const [idx, setIdx] = useState(1);
  const [pct, setPct] = useState(15);
  const [paid, setPaid] = useState<Set<string>>(new Set());
  const [slip, setSlip] = useState<Bill | null>(null);
  const cycle = list[idx];

  const bills = useMemo<Bill[]>(() => {
    const rows = collections.filter((c) => c.date >= cycle.start && c.date <= cycle.end);
    return [...groupBy(rows, (c) => c.farmerId)].map(([id, rs]) => {
      const farmer = farmers.find((f) => f.id === id)!;
      const liters = { cow: 0, buffalo: 0, goat: 0 } as Record<MilkType, number>;
      for (const r of rs) liters[r.milk] += r.liter;
      const gross = summarize(rs).amount;
      const recovery = Math.min(farmer.advance, Math.round((gross * pct) / 100));
      return { farmer, liters, total: liters.cow + liters.buffalo + liters.goat, gross, recovery, net: gross - recovery };
    }).sort((a, b) => b.net - a.net);
  }, [collections, farmers, cycle, pct]);

  const key = (b: Bill) => `${cycle.start}-${b.farmer.id}`;
  const totals = bills.reduce((a, b) => ({ liter: a.liter + b.total, gross: a.gross + b.gross, rec: a.rec + b.recovery, net: a.net + b.net }), { liter: 0, gross: 0, rec: 0, net: 0 });
  const paidCount = bills.filter((b) => paid.has(key(b))).length;

  const cols: Column<Bill>[] = [
    { key: 'f', header: 'Farmer', sort: (b) => b.farmer.name, cell: (b) => <div><p className="font-semibold">{b.farmer.name}</p><p className="text-xs text-mute">ID {b.farmer.code}</p></div> },
    ...MILK_TYPES.map<Column<Bill>>((m) => ({ key: m, header: `${MILK_META[m].label} L`, align: 'right', sort: (b) => b.liters[m], cell: (b) => (b.liters[m] ? nf(b.liters[m], 1) : '—') })),
    { key: 'gross', header: 'Gross', align: 'right', sort: (b) => b.gross, cell: (b) => inr(b.gross) },
    { key: 'rec', header: 'Advance recovery', align: 'right', sort: (b) => b.recovery, cell: (b) => (b.recovery ? <span className="text-danger">−{inr(b.recovery)}</span> : '—') },
    { key: 'net', header: 'Net payable', align: 'right', sort: (b) => b.net, cell: (b) => <span className="font-bold">{inr(b.net)}</span> },
    { key: 'st', header: 'Status', cell: (b) => <Badge tone={paid.has(key(b)) ? 'ok' : 'warn'} dot>{paid.has(key(b)) ? 'Paid' : 'Due'}</Badge> },
    { key: 'act', header: '', align: 'right', cell: (b) => <Button size="sm" variant="soft" icon={<ReceiptIndianRupee size={13} />} onClick={(e) => { e.stopPropagation(); setSlip(b); }}>Payslip</Button> },
  ];

  const ex: ExportCol<Bill>[] = [
    { header: 'Farmer ID', value: (b) => b.farmer.code }, { header: 'Farmer', value: (b) => b.farmer.name },
    ...MILK_TYPES.map<ExportCol<Bill>>((m) => ({ header: `${MILK_META[m].label} litres`, value: (b) => Math.round(b.liters[m] * 10) / 10 })),
    { header: 'Gross', value: (b) => Math.round(b.gross) }, { header: 'Recovery', value: (b) => b.recovery }, { header: 'Net payable', value: (b) => Math.round(b.net) },
  ];

  const markAll = () => { setPaid(new Set([...paid, ...bills.map(key)])); toast(`${bills.length} bills marked as paid`); };

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" subtitle="Ten-day bills per farmer. Each milk type is priced on its own rate chart, then advances are recovered." actions={<>
        <Button variant="outline" icon={<Download size={16} />} onClick={() => exportCSV(`bills-${cycle.start}`, ex, bills)}>Export CSV</Button>
        <Button icon={<CheckCheck size={16} />} onClick={markAll}>Mark all paid</Button>
      </>} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Litres billed" value={totals.liter} icon={<Droplets size={18} />} tone="text-brand" hint={`${bills.length} farmers`} />
        <StatCard label="Gross amount" value={totals.gross} prefix="₹" icon={<IndianRupee size={18} />} tone="text-cow" />
        <StatCard label="Advance recovered" value={totals.rec} prefix="₹" icon={<Wallet size={18} />} tone="text-danger" />
        <StatCard label="Net payable" value={totals.net} prefix="₹" icon={<ReceiptIndianRupee size={18} />} tone="text-ok" hint={`${paidCount} of ${bills.length} paid`} />
      </div>

      <Card>
        <CardHeader title="Billing cycle" action={<div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <Field label="Cycle"><Select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>{list.map((c, i) => <option key={c.start} value={i}>{c.label}{i === 0 ? ' (running)' : ''}</option>)}</Select></Field>
          <Field label={`Advance recovery: ${pct}% of gross`}><input type="range" min={0} max={50} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="h-10 w-full accent-[rgb(var(--brand))]" /></Field>
        </div>} />
        <div className="mt-3"><DataTable columns={cols} rows={bills} rowKey={(b) => b.farmer.id} pageSize={10} onRowClick={(b) => setSlip(b)} /></div>
      </Card>

      <Modal open={!!slip} onClose={() => setSlip(null)} title="Payslip" subtitle={slip ? `${cycle.label}` : ''}
        footer={slip && <>
          <Button variant="ghost" onClick={() => setPaid((p) => { const n = new Set(p); n.has(key(slip)) ? n.delete(key(slip)) : n.add(key(slip)); return n; })}>{paid.has(key(slip)) ? 'Mark as due' : 'Mark as paid'}</Button>
          <Button icon={<Printer size={15} />} onClick={() => exportPDF(`Payslip ${slip.farmer.name} ${cycle.start}`, [{ header: 'Item', value: (r: [string, string]) => r[0] }, { header: 'Amount', value: (r: [string, string]) => r[1] }], [...MILK_TYPES.map((m): [string, string] => [`${MILK_META[m].label} ${nf(slip.liters[m], 1)} L`, '']), ['Gross', inr(slip.gross)], ['Advance recovery', `-${inr(slip.recovery)}`], ['Net payable', inr(slip.net)]])}>Print</Button>
        </>}>
        {slip && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><div><p className="font-display text-xl font-extrabold">{slip.farmer.name}</p><p className="text-sm text-mute">Farmer {slip.farmer.code} · {slip.farmer.village}</p></div><Badge tone={paid.has(key(slip)) ? 'ok' : 'warn'} dot>{paid.has(key(slip)) ? 'Paid' : 'Due'}</Badge></div>
            <ul className="divide-y divide-line/70 rounded-2xl border border-line">
              {MILK_TYPES.filter((m) => slip.liters[m] > 0).map((m) => (<li key={m} className="flex justify-between px-4 py-3 text-sm"><span className="font-semibold">{MILK_META[m].label} milk</span><span className="tnum">{nf(slip.liters[m], 1)} L</span></li>))}
              <li className="flex justify-between px-4 py-3 text-sm"><span>Gross amount</span><span className="font-semibold tnum">{inr(slip.gross)}</span></li>
              <li className="flex justify-between px-4 py-3 text-sm"><span>Advance recovery</span><span className="font-semibold text-danger tnum">−{inr(slip.recovery)}</span></li>
              <li className="flex justify-between bg-soft px-4 py-4"><span className="font-bold">Net payable</span><span className="font-display text-2xl font-extrabold tnum">{inr(slip.net)}</span></li>
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Billing;
