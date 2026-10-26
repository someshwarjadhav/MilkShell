import type * as React from "react";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Fields";
import { cn } from "../../lib/cn";
import type {
  CnFarmer,
  CnRow,
} from "../../services/billing/standardDeduction.api";

export const WARN_ZERO = "Value for Cow/Buff/Mix must greater than 0";
const n0 = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const validRates = (r: { cow: string; buff: string; mix: string }) =>
  n0(r.cow) >= 0 &&
  n0(r.buff) >= 0 &&
  n0(r.mix) >= 0 &&
  (n0(r.cow) > 0 || n0(r.buff) > 0 || n0(r.mix) > 0);


export const noNegative = (r: { cow: string; buff: string; mix: string }) =>
  [r.cow, r.buff, r.mix].every(
    (v) => v === "" || (Number.isFinite(parseFloat(v)) && parseFloat(v) >= 0),
  );

const th =
  "px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-mute whitespace-nowrap";
const td = "px-3 py-2 text-sm";
const KEYS = ["cow", "buff", "mix"] as const;
const LABEL = { cow: "Cow", buff: "Buff", mix: "Mix" } as const;

const byId = (a: CnFarmer, b: CnFarmer) =>
  a.farmerId.localeCompare(b.farmerId, undefined, { numeric: true });

interface Props {
  left: CnFarmer[];
  right: CnRow[];
  loaded: boolean;
  onChange: (left: CnFarmer[], right: CnRow[]) => void;
  onWarn: (message: string) => void;
}


export const RateTransfer: React.FC<Props> = ({
  left,
  right,
  loaded,
  onChange,
  onWarn,
}) => {
  const [pickL, setPickL] = useState<Set<string>>(new Set());
  const [pickR, setPickR] = useState<Set<string>>(new Set());
  const [vals, setVals] = useState({ cow: "0", buff: "0", mix: "0" });

  const flip = (s: Set<string>, id: string) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  const move = (items: CnFarmer[]) => {
    if (items.length === 0) return;
    if (!validRates(vals)) return onWarn(WARN_ZERO);
    const ids = new Set(items.map((f) => f.farmerId));
    onChange(
      left.filter((f) => !ids.has(f.farmerId)),
      [...right, ...items.map((f) => ({ ...f, ...vals }))],
    );
    setPickL(new Set());
  };

  const back = (rows: CnRow[]) => {
    if (rows.length === 0) return;
    const ids = new Set(rows.map((r) => r.farmerId));
    onChange(
      [
        ...left,
        ...rows.map(({ farmerId, farmerName }) => ({ farmerId, farmerName })),
      ].sort(byId),
      right.filter((r) => !ids.has(r.farmerId)),
    );
    setPickR(new Set());
  };

  const edit = (id: string, patch: Partial<CnRow>) =>
    onChange(
      left,
      right.map((r) => (r.farmerId === id ? { ...r, ...patch } : r)),
    );

  
  const rot = "[&_svg]:rotate-90 lg:[&_svg]:rotate-0";
  const btn = cn("h-10 w-full", rot);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.3fr)]">
      <Card className="min-w-0 overflow-hidden">
        <div className="max-h-80 overflow-auto lg:max-h-[28rem]">
          <table className="w-full min-w-[18rem] border-collapse">
            <thead className="sticky top-0 bg-soft">
              <tr>
                <th className={cn(th, "w-8")} />
                <th className={th}>Farmer Id</th>
                <th className={th}>Farmer Name</th>
              </tr>
            </thead>
            <tbody>
              {left.map((f) => (
                <tr
                  key={f.farmerId}
                  onClick={() => setPickL((s) => flip(s, f.farmerId))}
                  className={cn(
                    "cursor-pointer border-t border-line/70 hover:bg-soft",
                    pickL.has(f.farmerId) && "bg-brand/10",
                  )}
                >
                  <td className={td}>
                    <input
                      type="checkbox"
                      readOnly
                      checked={pickL.has(f.farmerId)}
                      aria-label={`Select ${f.farmerName}`}
                    />
                  </td>
                  <td className={td}>{f.farmerId}</td>
                  <td className={cn(td, "break-words")}>{f.farmerName}</td>
                </tr>
              ))}
              {left.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-8 text-center text-sm text-mute"
                  >
                    {loaded ? "Nothing left to add." : "Press Show Farmers."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-4 content-start gap-2 lg:grid-cols-1">
        <Button
          variant="soft"
          className={cn(btn, "order-1")}
          aria-label="Add all"
          disabled={left.length === 0}
          onClick={() => move(left)}
          icon={<ChevronsRight size={16} />}
        />
        <Button
          variant="soft"
          className={cn(btn, "order-2")}
          aria-label="Remove all"
          disabled={right.length === 0}
          onClick={() => back(right)}
          icon={<ChevronsLeft size={16} />}
        />
        <Button
          variant="soft"
          className={cn(btn, "order-3 lg:order-4")}
          aria-label="Add selected"
          disabled={pickL.size === 0}
          onClick={() => move(left.filter((f) => pickL.has(f.farmerId)))}
          icon={<ChevronRight size={16} />}
        />
        <Button
          variant="soft"
          className={cn(btn, "order-4 lg:order-5")}
          aria-label="Remove selected"
          disabled={pickR.size === 0}
          onClick={() => back(right.filter((r) => pickR.has(r.farmerId)))}
          icon={<ChevronLeft size={16} />}
        />
        <div className="order-5 col-span-4 grid grid-cols-3 gap-2 lg:order-3 lg:col-span-1 lg:grid-cols-1">
          {KEYS.map((k) => (
            <Field key={k} label={LABEL[k]} className="text-center">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                aria-label={LABEL[k]}
                value={vals[k]}
                onChange={(e) =>
                  setVals((s) => ({ ...s, [k]: e.target.value }))
                }
                className="h-10 px-2 text-center"
              />
            </Field>
          ))}
        </div>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="max-h-80 overflow-auto lg:max-h-[28rem]">
          <table className="w-full min-w-[30rem] border-collapse">
            <thead className="sticky top-0 bg-soft">
              <tr>
                <th className={cn(th, "w-8")} />
                <th className={th}>Farmer Id</th>
                <th className={th}>Farmer Name</th>
                {KEYS.map((k) => (
                  <th key={k} className={cn(th, "text-right")}>
                    {LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {right.map((r) => (
                <tr
                  key={r.farmerId}
                  className={cn(
                    "border-t border-line/70",
                    pickR.has(r.farmerId) && "bg-brand/10",
                  )}
                >
                  <td className={td}>
                    <input
                      type="checkbox"
                      checked={pickR.has(r.farmerId)}
                      onChange={() => setPickR((s) => flip(s, r.farmerId))}
                      aria-label={`Select ${r.farmerName}`}
                    />
                  </td>
                  <td className={td}>{r.farmerId}</td>
                  <td className={cn(td, "break-words")}>{r.farmerName}</td>
                  {KEYS.map((k) => (
                    <td key={k} className={td}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        aria-label={`${LABEL[k]} for ${r.farmerName}`}
                        value={r[k]}
                        onChange={(e) =>
                          edit(r.farmerId, { [k]: e.target.value })
                        }
                        className="h-8 w-20 px-2 text-right"
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {right.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-mute"
                  >
                    Nothing added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
