import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Users } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { CardTitle, ReportPage, Reveal } from "../../components/ReportKit";
import { useToast } from "../../context/ToastContext";
import { todayISO } from "../../lib/format";
import { GLOBALSSHIFT } from "../../lib/global";
import { useCenters } from "../../hooks/useSessionData";
import { getSession } from "../../services/session";
import { vlccOption } from "../../services/vlcc/names";
import {
  getFarmers,
  getRateChart,
  lookupRate,
  postFarmerMilk,
  type RateRow,
} from "../../services/transaction/farmerMilk.api";
import type { MasterFarmer } from "../../services/farmer/farmerBook";
import { ApiError } from "../../services/http/errors";

const SHIFTS = GLOBALSSHIFT.shiftOptions.filter(
  (s) => s.Id === "M" || s.Id === "E",
);
const MILKS = [
  { Id: "C", Name: "Cow" },
  { Id: "B", Name: "Buffalo" },
  { Id: "M", Name: "Mix" },
];

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

const clrFrom = (snf: number, fat: number) => r1((snf - 0.21 * fat - 0.36) * 4);

const farmerLabel = (f: MasterFarmer) =>
  f.name ? `${f.farmerId} - ${f.name}` : f.farmerId;

const FarmerMilkEntry: React.FC = () => {
  const toast = useToast();
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];
  const ids = centers.length ? centers.map((c) => c.id) : sessionIds;

  const [vlc, setVlc] = useState("");
  const [shift, setShift] = useState("M");
  const [milk, setMilk] = useState("C");
  const [date, setDate] = useState(todayISO());
  const [farmerText, setFarmerText] = useState("");
  const [qty, setQty] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [saving, setSaving] = useState(false);

  const [farmers, setFarmers] = useState<MasterFarmer[]>([]);
  const [farmerState, setFarmerState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [farmerTry, setFarmerTry] = useState(0);

  const [rateRows, setRateRows] = useState<RateRow[] | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    if (!vlc && ids.length) setVlc(ids[0]);
  }, [vlc, ids]);

  useEffect(() => {
    if (!vlc) return;
    let alive = true;
    setFarmerText("");
    setFarmers([]);
    setFarmerState("loading");
    getFarmers(vlc)
      .then((list) => {
        if (!alive) return;
        setFarmers(list);
        setFarmerState("ready");
      })
      .catch(() => {
        if (alive) setFarmerState("error");
      });
    return () => {
      alive = false;
    };
  }, [vlc, farmerTry]);

  useEffect(() => {
    if (!vlc) return;
    let alive = true;
    setRateRows(null);
    setRateError(null);
    getRateChart(vlc)
      .then((r) => {
        if (!alive) return;
        setRateRows(r);
        setRateError(r.length === 0 ? "the chart came back empty." : null);
      })
      .catch((e) => {
        if (!alive) return;
        console.warn("[farmer milk] getRate failed", e);
        setRateError(e instanceof ApiError ? e.message : "the request failed.");
      });
    return () => {
      alive = false;
    };
  }, [vlc]);

  const farmer = useMemo(() => {
    const t = farmerText.trim().toLowerCase();
    if (!t) return null;
    return (
      farmers.find((f) => farmerLabel(f).toLowerCase() === t) ??
      farmers.find((f) => f.farmerId.toLowerCase() === t) ??
      null
    );
  }, [farmerText, farmers]);

  const qtyN = num(qty);
  const fatN = num(fat);
  const snfN = num(snf);
  const clrN = fatN !== null && snfN !== null ? clrFrom(snfN, fatN) : null;
  const rateN = useMemo(
    () =>
      rateRows && fatN !== null && snfN !== null && clrN !== null
        ? lookupRate(rateRows, {
            fat: fatN,
            snf: snfN,
            clr: clrN,
            milk,
            date,
          })
        : null,
    [rateRows, fatN, snfN, clrN, milk, date],
  );
  const amountN = qtyN !== null && rateN !== null ? r2(qtyN * rateN) : null;

  const valid =
    !!vlc &&
    !!date &&
    !!farmer &&
    (qtyN ?? 0) > 0 &&
    fatN !== null &&
    snfN !== null &&
    clrN !== null &&
    rateN !== null &&
    amountN !== null;

  const clearForm = () => {
    setFarmerText("");
    setQty("");
    setFat("");
    setSnf("");
  };

  const submit = async () => {
    if (!valid || saving || !farmer) return;
    setSaving(true);
    try {
      const message = await postFarmerMilk({
        vlccid: vlc,
        farmerid: farmer.farmerId,
        shift,
        milktype: milk,
        entrydate: date,
        
        rateid: farmer.rateId || farmer.farmerId,
        qty: String(qtyN),
        fat: String(fatN),
        snf: String(snfN),
        clr: String(clrN),
        rate: String(rateN),
        amount: (amountN as number).toFixed(2),
      });
      toast(message && message.length < 80 ? message : "Milk entry saved");
      clearForm();
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The entry could not be saved",
        "warn",
      );
    } finally {
      setSaving(false);
    }
  };

  const farmerHint =
    farmerState === "error"
      ? "Farmer list could not be loaded. Tap the box to try again."
      : farmerText.trim() && !farmer && farmerState === "ready"
        ? "Pick a farmer from the list."
        : undefined;

  const rateHint = rateError
    ? `Rate chart: ${rateError}`
    : rateRows && fatN !== null && snfN !== null && rateN === null
      ? "No rate in the chart for this Fat / SNF."
      : undefined;

  return (
    <ReportPage
      title="Farmer Milk Collection"
      
    >
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Users}>Farmer Milk Collection</CardTitle>}
            
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={clearForm}
              >
                Clear
              </Button>
            }
          />

          <div className="grid gap-4 px-5 pt-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-5">
            <Field label="Date">
              <Input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="VLC">
              <Select value={vlc} onChange={(e) => setVlc(e.target.value)}>
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {vlccOption(id)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Farmer Name" hint={farmerHint}>
              <Input
                list="farmer-milk-farmers"
                autoComplete="off"
                placeholder={
                  farmerState === "loading"
                    ? "Loading farmers…"
                    : "Select or type farmer"
                }
                value={farmerText}
                onChange={(e) => setFarmerText(e.target.value)}
                onFocus={() => {
                  if (farmerState === "error") setFarmerTry((n) => n + 1);
                }}
              />
              <datalist id="farmer-milk-farmers">
                {farmers.map((f) => (
                  <option key={f.key} value={farmerLabel(f)} />
                ))}
              </datalist>
            </Field>
            <Field label="Shift">
              <Select value={shift} onChange={(e) => setShift(e.target.value)}>
                {SHIFTS.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Milk Type">
              <Select value={milk} onChange={(e) => setMilk(e.target.value)}>
                {MILKS.map((m) => (
                  <option key={m.Id} value={m.Id}>
                    {m.Name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-6">
            <Field label="Weight Ltr">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field label="Fat">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </Field>
            <Field label="SNF">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={snf}
                onChange={(e) => setSnf(e.target.value)}
              />
            </Field>
            <Field label="CLR">
              <Input
                readOnly
                tabIndex={-1}
                value={clrN === null ? "" : String(clrN)}
                className="bg-soft/60"
              />
            </Field>
            <Field label="Rate" hint={rateHint}>
              <Input
                readOnly
                tabIndex={-1}
                value={rateN === null ? "" : String(rateN)}
                className="bg-soft/60"
              />
            </Field>
            <Field label="Amount">
              <Input
                readOnly
                tabIndex={-1}
                value={amountN === null ? "" : amountN.toFixed(2)}
                className="bg-soft/60"
              />
            </Field>

            <div className="col-span-2 flex items-end sm:col-span-3 xl:col-span-6">
              <Button
                className="w-full sm:w-auto sm:min-w-48"
                icon={<Save size={16} />}
                loading={saving}
                disabled={!valid}
                onClick={submit}
              >
                Submit
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default FarmerMilkEntry;
