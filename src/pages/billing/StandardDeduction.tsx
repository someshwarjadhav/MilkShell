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
import { useCentreOptions } from "../../hooks/useCentres";
import { clearRequestMemo } from "../../services/http/client";
import { ApiError } from "../../services/http/errors";
import {
  CATEGORIES,
  getFarmers,
  saveCommission,
  type CnFarmer,
  type CnRow,
} from "../../services/billing/standardDeduction.api";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const StandardDeduction: React.FC = () => {
  const toast = useToast();
  const centres = useCentreOptions();

  const [vlc, setVlc] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [from, setFrom] = useState(todayISO());

  const [left, setLeft] = useState<CnFarmer[]>([]);
  const [right, setRight] = useState<CnRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [gen, setGen] = useState(0);

  const vlcId = vlc || centres[0]?.id || "";
  const category = useMemo(
    () => CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0],
    [cat],
  );

  const reset = () => {
    setLeft([]);
    setRight([]);
    setLoaded(false);
    setError(null);
  };

  const show = async () => {
    if (!vlcId || !from || loading) return;
    clearRequestMemo();
    setLoading(true);
    reset();
    try {
      const d = await getFarmers(vlcId, category.flag, from);
      setLeft(d.farmers);
      setRight(d.saved);
      setLoaded(true);
    } catch (e) {
      setError(msg(e, "The farmers could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (saving) return;
    const bad = right.find((r) => !noNegative(r));
    if (bad)
      return toast(
        `Cow/Buff/Mix cannot be negative (Farmer ${bad.farmerId})`,
        "warn",
      );
    setSaving(true);
    try {
      const reply = await saveCommission({
        vlcid: vlcId,
        flag: category.flag,
        effectiveDate: from,
        rows: right,
      });
      toast(reply || "Standard deduction saved");
      reset();
      setGen((g) => g + 1);
    } catch (e) {
      toast(msg(e, "The standard deduction could not be saved."), "warn");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReportPage title="Standard Deduction">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Percent}>Standard Deduction</CardTitle>}
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <Field label="VLC Name" className="sm:col-span-2 lg:col-span-1">
              <Select
                value={vlcId}
                onChange={(e) => {
                  setVlc(e.target.value);
                  reset();
                }}
              >
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value);
                  reset();
                }}
              >
                {CATEGORIES.map((c) => (
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
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 sm:gap-4 lg:col-span-3">
              <Button
                className="w-full bg-ok text-white hover:bg-ok/90"
                icon={<Users size={16} />}
                loading={loading}
                disabled={!vlcId || !from}
                onClick={() => void show()}
              >
                Show Farmers
              </Button>
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

export default StandardDeduction;
