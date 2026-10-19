import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Download, Printer, ReceiptIndianRupee } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Field, Select } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingBlock, Notice } from '../components/Widget';
import { vlccOption } from '../services/vlcc/names';
import { addDays, fmtDate, inr, nf, todayISO } from '../lib/format';
import { exportCSV, exportPDF, type ExportCol } from '../lib/export';
import { DEFAULT_PAGE_SIZE } from '../lib/global';
import { KIND_META, type Kind } from '../services/utils/milk';
import { isoFromTrdate } from '../services/utils/date';
import { isLoadingQ, useSamples } from '../hooks/useSmartxData';
import { Droplets, IndianRupee } from 'lucide-react';

interface Cycle { start: string; end: string; label: string }
interface Bill { key: string; farmerId: string; vlccid: string; name: string; village: string; liters: Record<Kind, number>; total: number; gross: number }

const KINDS: Kind[] = ['cow', 'buffalo', 'mix'];
const PAID_KEY = 'dhara-paid-bills';

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
  const toast = useToast();
  const today = todayISO();
  const list = useMemo(() => cycles(today), [today]);
  const [idx, setIdx] = useState(1);
  const [slip, setSlip] = useState<Bill | null>(null);
  const [paid, setPaid] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem(PAID_KEY) ?? '[]')); } catch { return new Set<string>(); }
  });
  useEffect(() => { try { localStorage.setItem(PAID_KEY, JSON.stringify([...paid])); } catch { } }, [paid]);
  const cycle = list[idx];

  const { q, rows } = useSamples(cycle.start, cycle.end > today ? today : cycle.end);

  const bills = useMemo<Bill[]>(() => {
    const by = new Map<string, Bill>();
    for (const r of rows) {
      const d = isoFromTrdate(r.date);
      if (!d || d < cycle.start || d > cycle.end) continue;
      const b = by.get(r.farmerKey) ?? { key: r.farmerKey, farmerId: r.farmerId, vlccid: r.vlccid, name: r.farmerName, village: r.village, liters: { cow: 0, buffalo: 0, mix: 0, goat: 0 }, total: 0, gross: 0 };
      if (r.milk) b.liters[r.milk] += r.liter;
      b.total += r.liter;
      b.gross += r.amount;
      by.set(r.farmerKey, b);
    }
    return [...by.values()].sort((a, b) => b.gross - a.gross);
  }, [rows, cycle]);

  const pk = (b: Bill) => `${cycle.start}-${b.key}`;
  const totals = bills.reduce((a, b) => ({ liter: a.liter + b.total, gross: a.gross + b.gross }), { liter: 0, gross: 0 });
  const paidCount = bills.filter((b) => paid.has(pk(b))).length;
  const kinds = KINDS.filter((k) => bills.some((b) => b.liters[k] > 0));

  const cols: Column<Bill>[] = [
    { key: 'f', header: 'Farmer', sort: (b) => b.name, cell: (b) => <div><p className="font-semibold">{b.name}</p><p className="text-xs text-mute">ID {b.farmerId} · {vlccOption(b.vlccid)}</p></div> },
    ...kinds.map<Column<Bill>>((k) => ({ key: k, header: `${KIND_META[k].label} L`, align: 'right', sort: (b) => b.liters[k], cell: (b) => (b.liters[k] ? nf(b.liters[k], 1) : '—') })),
    { key: 'total', header: 'Total L', align: 'right', sort: (b) => b.total, cell: (b) => nf(b.total, 1) },
    { key: 'gross', header: 'Amount payable', align: 'right', sort: (b) => b.gross, cell: (b) => <span className="font-bold">{inr(b.gross, 2)}</span> },
    { key: 'st', header: 'Status', cell: (b) => <Badge tone={paid.has(pk(b)) ? 'ok' : 'warn'} dot>{paid.has(pk(b)) ? 'Paid' : 'Due'}</Badge> },
    { key: 'act', header: '', align: 'right', cell: (b) => <Button size="sm" variant="soft" icon={<ReceiptIndianRupee size={13} />} onClick={(e) => { e.stopPropagation(); setSlip(b); }}>Payslip</Button> },
  ];

  const ex: ExportCol<Bill>[] = [
    { header: 'Farmer ID', value: (b) => b.farmerId }, { header: 'VLC', value: (b) => b.vlccid }, { header: 'Farmer', value: (b) => b.name },
    ...KINDS.map<ExportCol<Bill>>((k) => ({ header: `${KIND_META[k].label} litres`, value: (b) => Math.round(b.liters[k] * 10) / 10 })),
    { header: 'Amount payable', value: (b) => Math.round(b.gross * 100) / 100 },
  ];

  const markAll = () => { setPaid(new Set([...paid, ...bills.map(pk)])); toast(`${bills.length} bills marked as paid on this device`); };

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" subtitle="Ten-day bills per farmer, added up from the portal's farmer samples at the rates the portal applied." actions={<>
        <Button variant="outline" icon={<Download size={16} />} disabled={bills.length === 0} onClick={() => exportCSV(`bills-${cycle.start}`, ex, bills)}>Export CSV</Button>
        <Button icon={<CheckCheck size={16} />} disabled={bills.length === 0} onClick={markAll}>Mark all paid</Button>
      </>} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StatCard label="Litres billed" value={totals.liter} decimals={1} icon={<Droplets size={18} />} tone="text-brand" hint={`${bills.length} farmers`} />
        <StatCard label="Amount payable" value={totals.gross} prefix="₹" icon={<IndianRupee size={18} />} tone="text-cow" />
        <StatCard label="Paid" value={paidCount} icon={<ReceiptIndianRupee size={18} />} tone="text-ok" hint={`of ${bills.length} bills (marked on this device)`} />
      </div>

      <Card>
        <CardHeader title="Billing cycle" action={<div className="w-full sm:w-72"><Field label="Cycle"><Select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>{list.map((c, i) => <option key={c.start} value={i}>{c.label}{i === 0 ? ' (running)' : ''}</option>)}</Select></Field></div>} />
        <Notice q={q} />
        <div className="mt-3">{isLoadingQ(q) ? <LoadingBlock height="h-64" q={q} /> : <DataTable columns={cols} rows={bills} rowKey={(b) => b.key} pageSize={DEFAULT_PAGE_SIZE} pageSizes={[10, 25, 50, 100, 250]} onRowClick={(b) => setSlip(b)} empty={<p className="px-6 py-10 text-center text-sm text-mute">No milk was collected in this cycle.</p>} />}</div>
      </Card>

      <Modal open={!!slip} onClose={() => setSlip(null)} title="Payslip" subtitle={slip ? cycle.label : ''}
        footer={slip && <>
          <Button variant="ghost" onClick={() => setPaid((p) => { const n = new Set(p); n.has(pk(slip)) ? n.delete(pk(slip)) : n.add(pk(slip)); return n; })}>{paid.has(pk(slip)) ? 'Mark as due' : 'Mark as paid'}</Button>
          <Button icon={<Printer size={15} />} onClick={() => exportPDF(`Payslip ${slip.name} ${cycle.start}`, [{ header: 'Item', value: (r: [string, string]) => r[0] }, { header: 'Amount', value: (r: [string, string]) => r[1] }], [...KINDS.filter((k) => slip.liters[k] > 0).map((k): [string, string] => [`${KIND_META[k].label} ${nf(slip.liters[k], 1)} L`, '']), ['Amount payable', inr(slip.gross, 2)]])}>Print</Button>
        </>}>
        {slip && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><div><p className="font-display text-xl font-extrabold">{slip.name}</p><p className="text-sm text-mute">Farmer {slip.farmerId} · {vlccOption(slip.vlccid)}{slip.village ? ` · ${slip.village}` : ''}</p></div><Badge tone={paid.has(pk(slip)) ? 'ok' : 'warn'} dot>{paid.has(pk(slip)) ? 'Paid' : 'Due'}</Badge></div>
            <ul className="divide-y divide-line/70 rounded-2xl border border-line">
              {KINDS.filter((k) => slip.liters[k] > 0).map((k) => (<li key={k} className="flex justify-between px-4 py-3 text-sm"><span className="font-semibold">{KIND_META[k].label} milk</span><span className="tnum">{nf(slip.liters[k], 1)} L</span></li>))}
              <li className="flex justify-between bg-soft px-4 py-4"><span className="font-bold">Amount payable</span><span className="font-display text-2xl font-extrabold tnum">{inr(slip.gross, 2)}</span></li>
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Billing;
