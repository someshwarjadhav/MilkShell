import type * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, ListChecks } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Pager } from "../../components/ui/Pager";
import { Select } from "../../components/ui/Fields";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBlock, LoadingBlock } from "../../components/Widget";
import { CardTitle, ReportPage, Reveal } from "../../components/ReportKit";
import { useToast } from "../../context/ToastContext";
import { GLOBALS } from "../../lib/global";
import { getSession } from "../../services/session";
import { ApiError } from "../../services/http/errors";
import { MILK_TYPES, getRateStatus, type RateStatusRow } from "../../services/master/rate.api";
import { exportRateStatus } from "../../services/master/rate.excel";

const SIZES = [10, 25, 50, 100, 500];
const GOOD = /^(1|true|active|done|success|sync|synced|downloaded)/i;
const WAIT = /^(0|pending|waiting|queued)/i;

const COLUMNS: Array<[keyof RateStatusRow, string]> = [
  ["villageId", "Village Id"],
  ["villageName", "Village Name"],
  ["effectiveDate", "Effective Date"],
  ["entryDate", "Entry Date"],
  ["currentRate", "Current Rate"],
  ["downloadDate", "Download Date"],
  ["downloadTime", "Download Time"],
  ["rateId", "RateId"],
  ["status", "Status"],
];

const RateStatus: React.FC = () => {
  const toast = useToast();
  const [type, setType] = useState<string>("C");
  const [rows, setRows] = useState<RateStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState(100);
  const [page, setPage] = useState(1);

  const sess = getSession();
  const mccid = sess?.mccLoginId || GLOBALS.mccLoginId || sess?.mccId || GLOBALS.mccid || "";
  const plantid = GLOBALS.plantid || "";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setPage(1);
    getRateStatus(mccid, plantid, type)
      .then((r) => alive && setRows(r))
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        setError(e instanceof ApiError ? e.message : "The rate status could not be loaded.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [mccid, plantid, type, tick]);

  const done = useMemo(() => rows.filter((r) => GOOD.test(r.status)).length, [rows]);
  const pending = useMemo(() => rows.filter((r) => WAIT.test(r.status)).length, [rows]);
  const total = rows.length;
  const lastPage = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, lastPage);
  const from = total ? (current - 1) * size + 1 : 0;
  const to = Math.min(total, current * size);
  const visible = useMemo(() => rows.slice((current - 1) * size, current * size), [rows, current, size]);

  const exportAll = useCallback(() => {
    if (!rows.length) return toast("There is nothing to export", "warn");
    const name = MILK_TYPES.find((m) => m.code === type)?.label ?? type;
    void exportRateStatus(rows, `RateStatus_${name}`);
  }, [rows, type, toast]);

  return (
    <ReportPage title="Rate Status">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={ListChecks}>Rate Status</CardTitle>}
            action={
              <Button icon={<FileSpreadsheet />} onClick={exportAll}>
                Excel Export
              </Button>
            }
          />
          <div className="space-y-4 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <p className="text-sm">
                <span className="font-bold">Record Count:</span>{" "}
                <span className="tnum">{from} - {to} of {total}</span>
              </p>
              {total > 0 && (
                <div className="flex items-center gap-2">
                  <Badge tone="ok" dot>{done} downloaded</Badge>
                  <Badge tone="warn" dot>{pending} pending</Badge>
                </div>
              )}
              <label className="flex items-center gap-3 text-sm font-bold">
                Result per page:
                <div className="w-28 font-normal">
                  <Select
                    value={size}
                    onChange={(e) => {
                      setSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {SIZES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </Select>
                </div>
              </label>
              <div className="flex flex-wrap items-center gap-6 sm:ml-auto" role="radiogroup" aria-label="Milk type">
                {MILK_TYPES.map((m) => (
                  <label key={m.code} className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input
                      type="radio"
                      name="rate-status-milk"
                      className="h-4 w-4 accent-brand"
                      checked={type === m.code}
                      onChange={() => setType(m.code)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            {error && <ErrorBlock compact message={error} onRetry={() => setTick((t) => t + 1)} busy={loading} />}

            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="bg-soft text-left">
                  <tr>
                    {COLUMNS.map(([k, label]) => (
                      <th key={k} className="whitespace-nowrap px-3 py-2.5 font-bold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={`${r.villageId}-${r.rateId}-${i}`} className="border-t border-line hover:bg-soft/60">
                      {COLUMNS.map(([k]) => (
                        <td key={k} className="whitespace-nowrap px-3 py-2 tnum">
                          {k === "status" ? (
                            r.status ? (
                              <Badge tone={GOOD.test(r.status) ? "ok" : WAIT.test(r.status) ? "warn" : "neutral"} dot>
                                {r.status}
                              </Badge>
                            ) : (
                              ""
                            )
                          ) : (
                            r[k]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <LoadingBlock height="h-24" label="Loading rate status…" />}
              {!loading && !error && !rows.length && (
                <EmptyState title="No rate status" hint="No centre has a rate for this milk type yet." />
              )}
            </div>

            {total > 0 && <Pager total={total} page={current} size={size} onPage={setPage} />}
          </div>
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default RateStatus;
