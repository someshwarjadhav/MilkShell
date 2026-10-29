import type * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import { Search, Snowflake, Wallet } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Fields';
import { ReportPager } from '../../components/ui/ReportPager';
import { MilkLoader } from '../../components/MilkLoader';
import { CardTitle, ReportBar, Reveal, type ExportKind } from '../../components/ReportKit';
import { CentreField } from '../../components/ReportFilters';
import { useCentreOptions } from '../../hooks/useCentres';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { isExtendedBill } from '../../config/reportAccess';
import { DEFAULT_PAGE_SIZE, GLOBALLABELS } from '../../lib/global';
import { todayISO } from '../../lib/format';
import { cn } from '../../lib/cn';
import { billExportRows, getPrintTableData, parseFarmerBills, postBillFreeze, type BillExportRow, type BillShift, type FarmerBillData } from '../../services/billing/farmerBill.api';
import { exportCSV, exportExcel, exportPDF, type ExportCol } from '../../lib/export';

const dmy = (s: string) => s.split('-').reverse().join('-');
const SHIFT_KEYS: Array<keyof BillShift> = ['wt', 'fat', 'snf', 'rate', 'amt'];
const HEADS = ['Wt', 'Fat', 'SNF', 'Rate', 'Amt'];

const shiftCols = (side: 'm' | 'e'): Array<ExportCol<BillExportRow>> =>
  SHIFT_KEYS.map((k, i) => ({
    header: HEADS[i],
    value: (r) => (side === 'e' && k === 'amt' ? r.e?.amt ?? r.net ?? '' : r[side]?.[k] ?? ''),
  }));

const BILL_COLS: Array<ExportCol<BillExportRow>> = [
  { header: 'Farmer', value: (r) => r.farmer },
  { header: 'Date', value: (r) => r.date },
  { header: 'Milk', value: (r) => r.milk },
  ...shiftCols('m'),
  ...shiftCols('e'),
];
const BILL_GROUPS = [{ label: '', span: 3 }, { label: 'Morning', span: 5 }, { label: 'Evening', span: 5 }];

const HEAD = 'border border-line bg-soft px-2 py-1.5 text-center font-bold';
const CELL = 'border border-line px-2 py-1.5 text-center';

const BillCard: React.FC<{ bill: FarmerBillData; range: string }> = ({ bill, range }) => (
  <article className="overflow-hidden rounded-2xl border border-line bg-panel">
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-4 py-3 text-sm">
      <p><span className="font-bold">Farmer Name:</span> <span className="font-semibold">{bill.name || '—'}</span></p>
      <p><span className="font-bold">Date:</span> <span className="tnum">{bill.range || range}</span></p>
    </div>

    <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[680px] border-collapse text-[13px] tnum">
        <thead>
          <tr>
            <th rowSpan={2} className={HEAD}>Date</th>
            <th rowSpan={2} className={HEAD}>Milk</th>
            <th colSpan={5} className={HEAD}>Morning</th>
            <th colSpan={5} className={HEAD}>Evening</th>
          </tr>
          <tr>
            {HEADS.map((h) => <th key={`m${h}`} className={cn(HEAD, 'font-semibold text-mute')}>{h}</th>)}
            {HEADS.map((h) => <th key={`e${h}`} className={cn(HEAD, 'font-semibold text-mute')}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((d, i) => (
            <tr key={`${d.label}${d.milk}${i}`} className={d.total ? 'bg-soft font-bold' : ''}>
              <td className={CELL}>{d.label}</td>
              <td className={CELL}>{d.milk}</td>
              {SHIFT_KEYS.map((k) => <td key={`m${k}`} className={CELL}>{d.m[k]}</td>)}
              {SHIFT_KEYS.map((k) => <td key={`e${k}`} className={CELL}>{d.e[k]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="overflow-x-auto px-3 pb-3">
      <table className="w-full min-w-[680px] border-collapse text-[13px] tnum">
        <tbody>
          {bill.summary.map((row, i) => (
            <tr key={i}>
              {row.map((p, j) => {
                const net = /net\s*payment/i.test(p.label);
                return (
                  <td key={`${p.label}${j}`} className={cn('w-1/4 border border-line px-3 py-1.5', net && 'bg-soft')}>
                    <span className="flex justify-between gap-3">
                      <span className={cn('text-mute', net && 'font-bold text-ink')}>{p.label}:</span>
                      <b className={net ? 'text-base' : ''}>{p.value}</b>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="grid gap-4 px-4 pb-4 pt-5 text-xs text-mute sm:grid-cols-2">
      <p className="border-t border-dashed border-line pt-1.5 text-center">Center Incharge Signature :</p>
      <p className="border-t border-dashed border-line pt-1.5 text-center">Producer Signature :</p>
    </div>
  </article>
);

type Status = 'idle' | 'loading' | 'ready' | 'error';

const FarmerBill: React.FC = () => {
  const toast = useToast();
  const today = todayISO();
  const { user } = useAuth();
  const extended = isExtendedBill(user?.email);
  const options = useCentreOptions();

  const [vlc, setVlc] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [bills, setBills] = useState<FarmerBillData[]>([]);
  const [rawReply, setRawReply] = useState<unknown>(null);
  const [applied, setApplied] = useState({ vlc: '', from: '', to: '' });
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const ticket = useRef(0);

  const vlcLabel = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  const ready = status === 'ready' && bills.length > 0;
  const total = bills.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const shown = bills.slice((safePage - 1) * pageSize, safePage * pageSize);
  const meta = { vlc: vlcLabel(applied.vlc), from: applied.from, to: applied.to };

  const show = useCallback(async () => {
    if (!vlc) return;
    if (from > to) { toast('From Date cannot be after To Date', 'warn'); return; }
    const mine = ++ticket.current;
    setStatus('loading');
    setError('');
    setPage(1);
    try {
      const raw = await getPrintTableData(from, to, vlc);
      if (mine !== ticket.current) return;
      const list = parseFarmerBills(raw, extended);
      setBills(list);
      setRawReply(raw);
      setApplied({ vlc, from, to });
      setStatus('ready');
    } catch (e) {
      if (mine !== ticket.current) return;
      setBills([]);
      setStatus('error');
      setError(e instanceof Error ? e.message : 'The bill could not be loaded.');
    }
  }, [vlc, from, to, toast, extended]);

  const freeze = async () => {
    setFreezing(true);
    try {
      const reply = await postBillFreeze({
        AutoRowNum: 0,
        VillageId: applied.vlc,
        EntryDate: todayISO(),
        StartDate: applied.from,
        EndDate: applied.to,
        flag: 1,
        json: JSON.stringify(rawReply),
      });
      const note = reply.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
      toast(note && !/^[{[]/.test(note) ? note : 'Bill freeze request sent');
      setFreezeOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The bill could not be frozen', 'warn');
    } finally {
      setFreezing(false);
    }
  };

  const run = (kind: ExportKind) => {
    if (!ready) return;
    const name = `farmer-bill-${applied.from}-to-${applied.to}`;
    const rows = billExportRows(bills);
    if (kind === 'pdf') {
      const sumOf = (label: string) => bills.reduce((a, b) => a + Number(b.summary.flat().find((p) => p.label === label)?.value ?? 0), 0);
      exportPDF(name, BILL_COLS, rows, {
        subtitle: `Farmer Bill · ${dmy(applied.from)} To ${dmy(applied.to)}`,
        meta: [['VLC', meta.vlc]],
        groups: BILL_GROUPS,
        summary: [
          { label: 'Farmers', value: String(total) },
          { label: 'Total Liter', value: sumOf('Total Liter').toFixed(2) },
          { label: 'Total Net Payment', value: sumOf('Net Payment').toFixed(2), tone: 'ok' },
        ],
        landscape: true,
        note: 'Center Incharge Signature : ______________________          Producer Signature : ______________________',
      });
      toast('Print dialog opened — choose Save as PDF to download');
    } else if (kind === 'csv') {
      exportCSV(name, BILL_COLS, rows);
      toast('CSV file downloaded');
    } else {
      exportExcel(name, BILL_COLS, rows);
      toast('XLS file downloaded');
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <Reveal>
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-[2rem]">Farmer Bill</h1>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={Wallet}>Milk Payment</CardTitle>} />
          <div className="grid gap-x-4 gap-y-3 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto_auto]">
            <CentreField value={vlc} onChange={setVlc} label={GLOBALLABELS.vlcName} />
            <Field label={GLOBALLABELS.fromDate}><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label={GLOBALLABELS.toDate}><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
            <div className="flex items-end"><Button className="w-full" icon={<Search size={16} />} loading={status === 'loading'} disabled={!vlc} onClick={show}>Show Record</Button></div>
            <div className="flex items-end"><Button className="w-full" variant="outline" icon={<Snowflake size={16} />} disabled={!ready} onClick={() => setFreezeOpen(true)}>Freeze Bill</Button></div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={total}
            disabled={!ready}
            kinds={['xls', 'pdf', 'csv']}
            onExport={run}
          />
        </Card>
      </Reveal>

      {status === 'loading' && <Card className="p-6"><MilkLoader label="Loading farmer bills…" /></Card>}
      {status === 'error' && <Card className="px-6 py-10 text-center text-sm text-danger">{error}</Card>}
      {status === 'idle' && <Card className="px-6 py-10 text-center text-sm text-mute">Select a VLC and dates, then press Show Record.</Card>}
      {status === 'ready' && total === 0 && <Card className="px-6 py-10 text-center text-sm text-mute">No record found for this VLC and these dates.</Card>}
      {status === 'ready' && shown.map((b, i) => <BillCard key={`${b.name}-${safePage}-${i}`} bill={b} range={`${dmy(applied.from)} To ${dmy(applied.to)}`} />)}
      {ready && (
        <Card>
          <ReportPager total={total} page={safePage} size={pageSize} onPage={setPage} onSize={(n) => { setPageSize(n); setPage(1); }} />
        </Card>
      )}

      <Modal open={freezeOpen} onClose={() => (freezing ? undefined : setFreezeOpen(false))} title="Freeze Bill" subtitle={`${meta.vlc} · ${dmy(applied.from)} To ${dmy(applied.to)}`}
        footer={<>
          <Button variant="ghost" disabled={freezing} onClick={() => setFreezeOpen(false)}>Cancel</Button>
          <Button icon={<Snowflake size={15} />} loading={freezing} onClick={freeze}>Freeze Bill</Button>
        </>}>
        <p className="text-sm text-mute">The bill of {total} farmer{total === 1 ? '' : 's'} for this VLC and these dates will be frozen on the portal.</p>
      </Modal>
    </div>
  );
};

export default FarmerBill;
