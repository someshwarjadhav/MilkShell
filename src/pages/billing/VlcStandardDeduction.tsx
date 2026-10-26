import type * as React from "react";
import { useMemo, useState } from "react";
import { Percent, Save, Users } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Fields";
import { CardTitle, ReportPage, Reveal } from "../../components/ReportKit";
import { ErrorBlock } from "../../components/Widget";
import {
  RateTransfer,
  noNegative,
} from "../../components/billing/RateTransfer";
import { useToast } from "../../context/ToastContext";
import { todayISO } from "../../lib/format";
import { useCentreIds } from "../../hooks/useCentres";
import { getSession } from "../../services/session";
import { clearRequestMemo } from "../../services/http/client";
import { ApiError } from "../../services/http/errors";
import type {
  CnFarmer,
  CnRow,
} from "../../services/billing/standardDeduction.api";
import {
  getVlcs,
  saveVlcCommission,
  VLC_CATEGORIES,
} from "../../services/billing/vlcStandardDeduction.api";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const VlcStandardDeduction: React.FC = () => {
  const toast = useToast();
  const ids = useCentreIds();

  const [cat, setCat] = useState(VLC_CATEGORIES[0].id);
  const [from, setFrom] = useState(todayISO());
  const [left, setLeft] = useState<CnFarmer[]>([]);
  const [right, setRight] = useState<CnRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [gen, setGen] = useState(0); 

  const category = useMemo(
    () => VLC_CATEGORIES.find((c) => c.id === cat) ?? VLC_CATEGORIES[0],
    [cat],
  );

  const reset = () => {
    setLeft([]);
    setRight([]);
    setLoaded(false);
    setError(null);
  };

  const show = async () => {
    if (ids.length === 0 || !from || loading) return;
    clearRequestMemo();
    setLoading(true);
    reset();
    try {
      const d = await getVlcs(ids, category.flag, from);
      setLeft(d.farmers);
      setRight(d.saved);
      setLoaded(true);
    } catch (e) {
      setError(msg(e, "The VLCs could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (saving) return;
    const bad = right.find((r) => !noNegative(r));
    if (bad)
      return toast(
        `Cow/Buff/Mix cannot be negative (ID ${bad.farmerId})`,
        "warn",
      );
    setSaving(true);
    try {
      const reply = await saveVlcCommission({
        stationId: ids[0] ?? getSession()?.stationId ?? "", 
        flag: category.flag,
        effectiveDate: from,
        rows: right,
      });
      toast(reply || "VLC standard deduction saved");
      reset(); 
      setGen((g) => g + 1);
    } catch (e) {
      toast(msg(e, "The VLC standard deduction could not be saved."), "warn");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReportPage title="VLC Standard Deduction">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Percent}>VLC Standard Deduction</CardTitle>}
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-[14rem_14rem_1fr_1fr]">
            <Field label="Category">
              <Select
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value);
                  reset();
                }}
              >
                {VLC_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="From Date">
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  reset();
                }}
              />
            </Field>
            <div className="flex items-end sm:col-span-1">
              <Button
                className="w-full bg-ok text-white hover:bg-ok/90"
                icon={<Users size={16} />}
                loading={loading}
                disabled={ids.length === 0 || !from}
                onClick={() => void show()}
              >
                Show Farmers
              </Button>
            </div>
            <div className="flex items-end sm:col-span-1">
              <Button
                className="w-full"
                icon={<Save size={16} />}
                loading={saving}
                disabled={!loaded}
                onClick={() => void submit()}
              >
                Submit
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      {error && (
        <ErrorBlock
          message={error}
          onRetry={() => void show()}
          busy={loading}
        />
      )}

      <Reveal delay={0.1}>
        <RateTransfer
          key={gen}
          left={left}
          right={right}
          loaded={loaded}
          onChange={(l, r) => {
            setLeft(l);
            setRight(r);
          }}
          onWarn={(m) => toast(m, "warn")}
        />
      </Reveal>
    </ReportPage>
  );
};

export default VlcStandardDeduction;
