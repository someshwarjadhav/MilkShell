import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Plus, Truck } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Field, Input, Select } from '../components/ui/Fields';
import { DataTable, type Column } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { AnimalHead, Tanker } from '../components/Illustrations';
import { MilkTypeChip } from '../components/MilkTypeChip';
import { MILK_META, MILK_TYPES } from '../lib/milk';
import { fmtDate, inr, nf, todayISO } from '../lib/format';
import type { MilkType, Sale } from '../types';

const CUSTOMERS = ['Warna Cooling Plant', 'Sahyadri Sweets', 'Krishna Curd Works', 'Local retail route'];
const DEFAULT_RATE: Record<MilkType, number> = { cow: 42, buffalo: 66, goat: 58 };

const Sales: React.FC = () => {
  const { sales, collections, addSale, toggleSalePaid } = useData();
  const toast = useToast();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ customer: CUSTOMERS[0], milk: 'cow' as MilkType, liter: '200', rate: '42' });

  const stock = useMemo(() => MILK_TYPES.map((m) => {
    const got = collections.filter((c) => c.date === today && c.milk === m).reduce((a, c) => a + c.liter, 0);
    const sold = sales.filter((s) => s.date === today && s.milk === m).reduce((a, s) => a + s.liter, 0);
    return { m, got, sold, left: got - sold };
  }), [collections, sales, today]);

  const liter = Number(f.liter), rate = Number(f.rate);
  const room = stock.find((s) => s.m === f.milk)?.left ?? 0;
  const valid = liter > 0 && rate > 0 && liter <= Math.max(room, 0);

  const cols: Column<Sale>[] = [
    { key: 'date', header: 'Date', sort: (s) => s.date, cell: (s) => fmtDate(s.date) },
    { key: 'cust', header: 'Customer', sort: (s) => s.customer, cell: (s) => <span className="font-semibold">{s.customer}</span> },
    { key: 'milk', header: 'Milk', cell: (s) => <MilkTypeChip type={s.milk} /> },
    { key: 'liter', header: 'Litres', align: 'right', sort: (s) => s.liter, cell: (s) => nf(s.liter) },
    { key: 'rate', header: 'Rate', align: 'right', cell: (s) => inr(s.rate) },
    { key: 'amt', header: 'Amount', align: 'right', sort: (s) => s.liter * s.rate, cell: (s) => <span className="font-bold">{inr(s.liter * s.rate)}</span> },
    { key: 'paid', header: 'Payment', cell: (s) => <button onClick={() => toggleSalePaid(s.id)} aria-label="Toggle payment status"><Badge tone={s.paid ? 'ok' : 'warn'} dot>{s.paid ? 'Received' : 'Pending'}</Badge></button> },
  ];

  const pending = sales.filter((s) => !s.paid).reduce((a, s) => a + s.liter * s.rate, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Milk sales" subtitle="Stock is kept per milk type, so cow milk can never be sold out of the buffalo tank." actions={<Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>New dispatch</Button>} />

      <div className="grid gap-4 md:grid-cols-3">
        {stock.map((s) => (
          <Card key={s.m} className="p-5">
            <div className="flex items-center gap-3"><AnimalHead type={s.m} size={44} /><div><p className="font-bold">{MILK_META[s.m].label} stock</p><p className="text-xs text-mute">Today</p></div></div>
            <p className="mt-4 font-display text-4xl font-extrabold tnum">{nf(Math.max(0, s.left))}<span className="ml-1 text-base text-mute">L left</span></p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-soft"><div className={`h-full rounded-full ${MILK_META[s.m].bar} transition-all duration-1000`} style={{ width: `${s.got ? Math.min(100, (s.sold / s.got) * 100) : 0}%` }} /></div>
            <p className="mt-2 text-xs text-mute tnum">{nf(s.got)} L collected · {nf(s.sold)} L dispatched</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Dispatch history" subtitle={`${inr(pending)} still to be received`} action={<Tanker size={90} />} />
        <div className="mt-2"><DataTable columns={cols} rows={sales} rowKey={(s) => s.id} pageSize={10} /></div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New dispatch" subtitle="Choose a customer and how much to send."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button icon={<Truck size={15} />} disabled={!valid} onClick={() => { addSale({ date: today, customer: f.customer, milk: f.milk, liter, rate, paid: false }); toast(`${nf(liter)} L ${MILK_META[f.milk].label.toLowerCase()} milk dispatched`); setOpen(false); }}>Dispatch</Button></>}>
        <div className="space-y-4">
          <Field label="Customer"><Select value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })}>{CUSTOMERS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Milk type"><Select value={f.milk} onChange={(e) => setF({ ...f, milk: e.target.value as MilkType, rate: String(DEFAULT_RATE[e.target.value as MilkType]) })}>{MILK_TYPES.map((m) => <option key={m} value={m}>{MILK_META[m].label}</option>)}</Select></Field>
            <Field label="Litres"><Input type="number" min="0" value={f.liter} onChange={(e) => setF({ ...f, liter: e.target.value })} /></Field>
            <Field label="Rate (₹ / L)"><Input type="number" min="0" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
          </div>
          <p className={`rounded-xl px-3 py-2 text-sm ${liter > room ? 'bg-danger/10 text-danger' : 'bg-soft text-mute'}`}>{liter > room ? `Only ${nf(Math.max(room, 0))} L of ${MILK_META[f.milk].label.toLowerCase()} milk is in stock today.` : `Total ${inr(liter * rate)} · ${nf(room - liter)} L will remain.`}</p>
        </div>
      </Modal>
    </div>
  );
};

export default Sales;
