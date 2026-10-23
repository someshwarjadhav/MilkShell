import type * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, Eye, EyeOff, FlaskConical, Loader2, Minus, Plus, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Pager } from '../../components/ui/Pager';
import { Field, Input, Select } from '../../components/ui/Fields';
import { ErrorBlock } from '../../components/Widget';
import { CardTitle, ReportPage, Reveal } from '../../components/ReportKit';
import { useToast } from '../../context/ToastContext';
import { useCenters } from '../../hooks/useSessionData';
import { getSession } from '../../services/session';
import { vlccOption } from '../../services/vlcc/names';
import { ApiError } from '../../services/http/errors';
import { todayISO } from '../../lib/format';
import { DEFAULT_SHIFT, GLOBALSSHIFT } from '../../lib/global';
import {
  emptyCredentials, emptyQuality, emptySample, getControlSamples, getEkoCorrections, getEkoCredentials, getVlcQuality,
  QUALITY_FIELDS, saveControlSample, saveEkoCorrection, updateCorrectorFlag, updateEkoCorrectionFlag, updateEkoPassword,
  type ControlRow, type CorrectionRow, type Quality6, type Sample3,
} from '../../services/settings/ekoMilk.api';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const decimal = (v: string) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const SHIFTS = GLOBALSSHIFT.shiftOptions.map((o) => ({ value: o.Id as string, label: o.Name as string })); 

const CenterSelect: React.FC<{ value: string; onChange: (v: string) => void; ids: string[] }> = ({ value, onChange, ids }) => (
  <Field label="Center Name">
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- select center --</option>
      {ids.map((id) => <option key={id} value={id}>{vlccOption(id)}</option>)}
    </Select>
  </Field>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="pt-1 text-sm font-semibold text-mute">{children}</p>;

const PassInput: React.FC<{ value: string; onChange?: (v: string) => void; readOnly?: boolean; disabled?: boolean }> = ({ value, onChange, readOnly, disabled }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} readOnly={readOnly} disabled={disabled} className="pr-10" onChange={(e) => onChange?.(e.target.value)} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const statusCls = (s: string) => (/complete/i.test(s) ? 'text-green-700 dark:text-green-400' : /reject/i.test(s) ? 'text-red-600 dark:text-red-400' : /pending/i.test(s) ? 'text-blue-700 dark:text-blue-400' : 'text-mute');

type Row = CorrectionRow | ControlRow;


const COW = 'bg-sky-500/10';
const BUFF = 'bg-orange-500/10';
const MIX = 'bg-emerald-500/10';
const TINTS = [COW, COW, BUFF, BUFF, MIX, MIX];
const cell = 'border border-line px-3 py-2.5 tnum';
const headCell = 'border border-line px-3 py-2.5 text-left font-bold';

const RecordsTable: React.FC<{ rows: Row[]; kind: 'eko' | 'control'; busyId: string | null; onCancel: (r: Row) => void; loading: boolean; emptyText: string }> = ({ rows, kind, busyId, onCancel, loading, emptyText }) => {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(5);
  useEffect(() => { setPage(1); }, [rows]);
  const slice = rows.slice((page - 1) * size, page * size);

  const six = (r: { cowFat: string; cowSnf: string; buffFat: string; buffSnf: string; mixFat: string; mixSnf: string }) => [r.cowFat, r.cowSnf, r.buffFat, r.buffSnf, r.mixFat, r.mixSnf];
  const action = (r: Row) => {
    if (/pending/i.test(r.status)) {
      return (
        <button type="button" disabled={busyId === r.id} onClick={() => onCancel(r)} title="Cancel this record" aria-label="Cancel this record" className="mx-auto grid h-8 w-8 place-items-center rounded-lg text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50">
          {busyId === r.id ? <Loader2 size={18} className="animate-spin" /> : <X size={20} strokeWidth={2.5} />}
        </button>
      );
    }
    return <CheckCheck size={20} className="mx-auto text-green-600" aria-label={r.status} />;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className={headCell}>Id</th><th rowSpan={2} className={headCell}>Entry Date</th><th rowSpan={2} className={headCell}>Station</th>
              <th colSpan={2} className={headCell}>Cow</th><th colSpan={2} className={headCell}>Buffalo</th><th colSpan={2} className={headCell}>Mix</th>
              <th rowSpan={2} className={headCell}>Status</th><th rowSpan={2} className={headCell}>Applied Date</th><th rowSpan={2} className={headCell}>Applied Time</th><th rowSpan={2} className={`${headCell} text-center`}>Action</th>
            </tr>
            <tr>{['Fat', 'Snf', 'Fat', 'Snf', 'Fat', 'Snf'].map((h, i) => <th key={i} className={headCell}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const rejected = /reject/i.test(r.status);
              const base = rejected ? 'bg-soft' : '';
              if (kind === 'eko') {
                return (
                  <tr key={r.id} className={base}>
                    <td className={cell}>{r.id}</td><td className={`${cell} whitespace-nowrap`}>{r.entryDate}</td><td className={cell}>{r.stationId}</td>
                    {six(r).map((v, i) => <td key={i} className={`${cell} ${TINTS[i]}`}>{v}</td>)}
                    <td className={`${cell} ${statusCls(r.status)}`}>{r.status}</td>
                    <td className={`${cell} whitespace-nowrap`}>{r.appliedDate}</td><td className={`${cell} whitespace-nowrap`}>{r.appliedTime}</td>
                    <td className={`${cell} text-center`}>{action(r)}</td>
                  </tr>
                );
              }
              const c = r as ControlRow;
              const lines: Array<{ label: string | null; values: string[] }> = [
                { label: null, values: six(c) },
                { label: 'Previous', values: six(c.prev) },
                { label: 'New', values: six(c.next) },
              ];
              return lines.map((ln, li) => (
                <tr key={`${r.id}-${li}`} className={base}>
                  {li === 0 && <td rowSpan={3} className={cell}>{r.id}</td>}
                  {li === 0 && <td rowSpan={3} className={`${cell} whitespace-nowrap`}>{r.entryDate}</td>}
                  <td className={`${cell} ${ln.label ? 'font-bold italic' : ''}`}>{ln.label ?? r.stationId}</td>
                  {ln.values.map((v, i) => <td key={i} className={`${cell} ${TINTS[i]}`}>{v}</td>)}
                  {li === 0 && <td rowSpan={3} className={`${cell} ${statusCls(r.status)}`}>{r.status}</td>}
                  {li === 0 && <td rowSpan={3} className={`${cell} whitespace-nowrap`}>{r.appliedDate}</td>}
                  {li === 0 && <td rowSpan={3} className={`${cell} whitespace-nowrap`}>{r.appliedTime}</td>}
                  {li === 0 && <td rowSpan={3} className={`${cell} text-center`}>{action(r)}</td>}
                </tr>
              ));
            })}
            {slice.length === 0 && (
              <tr><td colSpan={12} className={`${cell} py-8 text-center text-mute`}>{loading ? 'Loading records…' : emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager total={rows.length} page={page} size={size} onPage={setPage} onSize={(n) => { setSize(n); setPage(1); }} />
    </div>
  );
};



const CalibrationCard: React.FC<{ ids: string[] }> = ({ ids }) => {
  const toast = useToast();
  const [center, setCenter] = useState('');
  const [shift, setShift] = useState<string>(DEFAULT_SHIFT);
  const [vlc, setVlc] = useState<Quality6>(emptyQuality);
  const [doc, setDoc] = useState<Quality6>(emptyQuality);
  const [neg, setNeg] = useState<Record<keyof Quality6, boolean>>({ cowFat: false, cowSnf: false, buffFat: false, buffSnf: false, mixFat: false, mixSnf: false });
  const [diff, setDiff] = useState<Quality6>(emptyQuality);
  const [cred, setCred] = useState(emptyCredentials);
  const [passApply, setPassApply] = useState(false);
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showing, setShowing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async (c: string) => {
    if (!c) { setRows([]); return; }
    setLoading(true);
    try { setRows(await getEkoCorrections(c)); } catch (e) { setError(message(e, 'The calibration records could not be loaded.')); } finally { setLoading(false); }
  }, []);

  const loadCredentials = useCallback(async (c: string) => {
    if (!c) { setCred(emptyCredentials()); return; }
    try { setCred(await getEkoCredentials(c)); } catch (e) { setError(message(e, 'The Eko credentials could not be loaded.')); }
  }, []);

  useEffect(() => {
    setError(null); setVlc(emptyQuality()); setDoc(emptyQuality()); setDiff(emptyQuality()); setPassApply(false);
    void loadRecords(center);
    void loadCredentials(center);
  }, [center, loadRecords, loadCredentials]);


  const recompute = (v: Quality6, d: Quality6, n: typeof neg) => {
    const out = emptyQuality();
    QUALITY_FIELDS.forEach(([k]) => {
      if (v[k] === '' || d[k] === '') { out[k] = ''; return; }
      const x = Math.abs(Number(v[k]) - Number(d[k]));
      out[k] = x === 0 ? '0.00' : `${n[k] ? '-' : ''}${x.toFixed(2)}`;
    });
    return out;
  };
  useEffect(() => { setDiff(recompute(vlc, doc, neg)); }, [vlc, doc, neg]);

  const show = async () => {
    if (!center) { toast('Select a center first', 'warn'); return; }
    setShowing(true); setError(null);
    try {
      const q = await getVlcQuality(center, shift);
      setVlc(q);
    } catch (e) {
      setVlc(emptyQuality());
      setError(message(e, 'The VLC milk quality could not be loaded.'));
    } finally { setShowing(false); }
  };

  const setDocField = (k: keyof Quality6, v: string) => setDoc((d) => ({ ...d, [k]: decimal(v) }));
  const setDiffField = (k: keyof Quality6, v: string) => setDiff((d) => ({ ...d, [k]: v.replace(/[^\d.-]/g, '') }));
  const regen = () => setCred((c) => ({ ...c, newPass: String(Math.floor(100000 + Math.random() * 900000)) }));

  const diffReady = QUALITY_FIELDS.some(([k]) => diff[k] !== '');
  const passOk = !passApply || /^\d{6}$/.test(cred.newPass);

  const submit = async () => {
    if (!center || saving) return;
    if (!diffReady) { toast('Enter the DOC quality first', 'warn'); return; }
    if (!passOk) { toast('New password must be 6 digits', 'warn'); return; }
    setSaving(true);
    try {
      await saveEkoCorrection({ stationId: center, entryDate: todayISO(), shift, vlc, doc, diff });
      if (passApply) await updateEkoPassword({ villageId: center, currentPass: cred.currentPass, newPass: cred.newPass });
      toast('Eko calibration saved successfully!');
      setDoc(emptyQuality()); setPassApply(false);
      await Promise.all([loadRecords(center), loadCredentials(center)]);
    } catch (e) {
      toast(message(e, 'The Eko calibration could not be saved'), 'warn');
    } finally { setSaving(false); }
  };

  const cancel = async (r: Row) => {
    setBusyId(r.id);
    try { await updateEkoCorrectionFlag(center, r.id, '0'); toast('Record cancelled'); await loadRecords(center); }
    catch (e) { toast(message(e, 'The record could not be updated'), 'warn'); }
    finally { setBusyId(null); }
  };

  const grid = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-6';

  return (
    <Card>
      <CardHeader title={<CardTitle icon={SlidersHorizontal}>Eko Ultra Pro Online Calibration</CardTitle>} />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] lg:grid-cols-[minmax(0,28.5rem)_minmax(0,21rem)_auto]">
          <CenterSelect value={center} onChange={setCenter} ids={ids} />
          <Field label="Shift">
            <Select value={shift} onChange={(e) => setShift(e.target.value)}>
              {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Button loading={showing} disabled={!center} onClick={show}>Show</Button>
        </div>
        {error && <ErrorBlock compact message={error} onRetry={() => { setError(null); void loadRecords(center); void loadCredentials(center); }} />}

        <SectionLabel>Quality Of Milk as per VLC(today)</SectionLabel>
        <div className={grid}>
          {QUALITY_FIELDS.map(([k, label]) => <Field key={k} label={label}><Input readOnly value={vlc[k]} /></Field>)}
        </div>

        <SectionLabel>Quality Of Milk Received On DOC</SectionLabel>
        <div className={grid}>
          {QUALITY_FIELDS.map(([k, label]) => (
            <Field key={k} label={label}><Input inputMode="decimal" disabled={!center} value={doc[k]} onChange={(e) => setDocField(k, e.target.value)} /></Field>
          ))}
        </div>

        <SectionLabel>Quality Difference Of Milk</SectionLabel>
        <div className={grid}>
          {QUALITY_FIELDS.map(([k, label]) => (
            <div key={k} className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-semibold">{label}</span>
                <button
                  type="button" disabled={!center}
                  onClick={() => setNeg((n) => ({ ...n, [k]: !n[k] }))}
                  aria-label={`Switch ${label} sign`} title={neg[k] ? 'Negative - click for positive' : 'Positive - click for negative'}
                  className={`grid h-6 w-8 place-items-center rounded-md text-white transition-colors disabled:opacity-50 ${neg[k] ? 'bg-danger' : 'bg-ok'}`}
                >
                  {neg[k] ? <Minus size={14} /> : <Plus size={14} />}
                </button>
              </div>
              <Input inputMode="decimal" disabled={!center} value={diff[k]} onChange={(e) => setDiffField(k, e.target.value)} />
            </div>
          ))}
        </div>

        <SectionLabel>Eko Milk Credentials</SectionLabel>
        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto_auto]">
          <Field label="Contact"><Input readOnly value={cred.contact} /></Field>
          <Field label="PCB SerialNo"><Input readOnly value={cred.pcbSerial} /></Field>
          <Field label="Current Password"><PassInput readOnly value={cred.currentPass} /></Field>
          <Field label="New Password"><PassInput value={cred.newPass} disabled={!center} onChange={(v) => setCred((c) => ({ ...c, newPass: v.replace(/\D/g, '').slice(0, 6) }))} /></Field>
          <button type="button" onClick={regen} disabled={!center} aria-label="Generate new password" title="Generate new password" className="grid h-10 w-10 place-items-center rounded-xl text-brand transition-colors hover:bg-brand/10 disabled:opacity-50"><RefreshCw size={18} /></button>
          <label className="flex h-10 cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 rounded border-line accent-brand" checked={passApply} disabled={!center} onChange={(e) => setPassApply(e.target.checked)} />
            Password Apply
          </label>
        </div>
        {passApply && !passOk && <p className="text-sm font-semibold text-danger">New password must be 6 digits</p>}

        <Button className="w-full" loading={saving} disabled={!center || !diffReady || !passOk} onClick={submit}>Submit</Button>

        <RecordsTable kind="eko" rows={rows} busyId={busyId} onCancel={cancel} loading={loading} emptyText={center ? 'No calibration records yet.' : 'Select a center to see its records.'} />
      </div>
    </Card>
  );
};



const SAMPLE_ROWS: Array<['cow' | 'buff' | 'mix', string]> = [['cow', 'Cow Quality'], ['buff', 'Buff Quality'], ['mix', 'Mix Quality']];
const SAMPLE_COLS: Array<[keyof Sample3, string]> = [['fat', 'Fat'], ['snf', 'SNF'], ['clr', 'CLR']];

const ControlSampleCard: React.FC<{ ids: string[] }> = ({ ids }) => {
  const toast = useToast();
  const [center, setCenter] = useState('');
  const [vals, setVals] = useState<Record<'cow' | 'buff' | 'mix', Sample3>>({ cow: emptySample(), buff: emptySample(), mix: emptySample() });
  const [rows, setRows] = useState<ControlRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async (c: string) => {
    if (!c) { setRows([]); return; }
    setLoading(true); setError(null);
    try { setRows(await getControlSamples(c)); } catch (e) { setError(message(e, 'The control sample records could not be loaded.')); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadRecords(center); }, [center, loadRecords]);

  const set = (r: 'cow' | 'buff' | 'mix', c: keyof Sample3, v: string) => setVals((x) => ({ ...x, [r]: { ...x[r], [c]: decimal(v) } }));
  const filled = SAMPLE_ROWS.some(([r]) => SAMPLE_COLS.some(([c]) => vals[r][c] !== ''));

  const submit = async () => {
    if (!center || !filled || saving) return;
    setSaving(true);
    try {
      await saveControlSample({ stationId: center, entryDate: todayISO(), cow: vals.cow, buff: vals.buff, mix: vals.mix });
      toast('Control sample saved successfully!');
      setVals({ cow: emptySample(), buff: emptySample(), mix: emptySample() });
      await loadRecords(center);
    } catch (e) {
      toast(message(e, 'The control sample could not be saved'), 'warn');
    } finally { setSaving(false); }
  };

  const cancel = async (r: Row) => {
    setBusyId(r.id);
    try { await updateCorrectorFlag(center, r.id, '0'); toast('Record cancelled'); await loadRecords(center); }
    catch (e) { toast(message(e, 'The record could not be updated'), 'warn'); }
    finally { setBusyId(null); }
  };

  return (
    <Card>
      <CardHeader title={<CardTitle icon={FlaskConical}>Control Sample</CardTitle>} />
      <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="grid gap-4 sm:grid-cols-2"><CenterSelect value={center} onChange={setCenter} ids={ids} /></div>
        {error && <ErrorBlock compact message={error} onRetry={() => void loadRecords(center)} />}

        <div className="space-y-4">
          {SAMPLE_ROWS.map(([r, label]) => (
            <div key={r} className="grid items-end gap-4 sm:grid-cols-[8rem_repeat(3,minmax(0,1fr))]">
              <span className="pb-2 text-sm font-bold">{label}</span>
              {SAMPLE_COLS.map(([c, colLabel]) => (
                <Field key={c} label={colLabel}><Input inputMode="decimal" disabled={!center} value={vals[r][c]} onChange={(e) => set(r, c, e.target.value)} /></Field>
              ))}
            </div>
          ))}
        </div>

        <Button className="w-full" loading={saving} disabled={!center || !filled} onClick={submit}>Submit</Button>
        <RecordsTable kind="control" rows={rows} busyId={busyId} onCancel={cancel} loading={loading} emptyText={center ? 'No control sample records yet.' : 'Select a center to see its records.'} />
      </div>
    </Card>
  );
};

const EkoMilkSettings: React.FC = () => {
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds;
  const ids = useMemo(() => (centers.length ? centers.map((c) => c.id) : sessionIds ?? []), [centers, sessionIds]);

  return (
    <ReportPage title="Eko Milk Settings">
      <Reveal delay={0.05}><CalibrationCard ids={ids} /></Reveal>
      <Reveal delay={0.1}><ControlSampleCard ids={ids} /></Reveal>
    </ReportPage>
  );
};

export default EkoMilkSettings;
