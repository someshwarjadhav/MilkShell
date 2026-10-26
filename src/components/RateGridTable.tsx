import type * as React from "react";
import { useMemo, useState } from "react";
import type { RateGrid } from "../services/master/rate.api";
import { cn } from "../lib/cn";

const axis = (n: number) => {
  const t = String(Math.round(n * 100) / 100);
  return t.includes(".") ? t : `${t}.0`;
};
const money = (v: number | null) => (v === null ? "" : (Math.round(v * 100) / 100).toFixed(2));

export const RateGridTable: React.FC<{ grid: RateGrid; className?: string }> = ({ grid, className }) => {
  const [hot, setHot] = useState<{ r: number; c: number } | null>(null);

  const { min, max } = useMemo(() => {
    const all = grid.rows.flatMap((r) => r.rates).filter((v): v is number => v !== null);
    return all.length ? { min: Math.min(...all), max: Math.max(...all) } : { min: 0, max: 0 };
  }, [grid]);

  const heat = (v: number | null) => {
    if (v === null) return undefined;
    const t = max > min ? (v - min) / (max - min) : 0.5;
    return `rgb(var(--brand) / ${(0.05 + t * 0.3).toFixed(3)})`;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-brand/12 px-3 py-1 text-brand">{grid.rows.length} Fat rows</span>
        <span className="rounded-full bg-brand/12 px-3 py-1 text-brand">{grid.snfs.length} SNF columns</span>
        <span className="rounded-full bg-soft px-3 py-1 text-mute">
          Rate ₹{money(min)} – ₹{money(max)}
        </span>
        <span className="ml-auto flex items-center gap-2 text-mute">
          Low
          <span
            className="h-2.5 w-24 rounded-full"
            style={{ background: "linear-gradient(90deg, rgb(var(--brand) / .08), rgb(var(--brand) / .4))" }}
          />
          High
        </span>
      </div>

      <div className="max-h-[30rem] overflow-auto rounded-2xl border border-line bg-panel" onMouseLeave={() => setHot(null)}>
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm tnum">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 whitespace-nowrap border-b border-r border-line bg-soft px-4 py-2.5 text-left font-display font-bold text-ink">
                Fat \ SNF
              </th>
              {grid.snfs.map((s, c) => (
                <th
                  key={s}
                  className={cn(
                    "sticky top-0 z-20 whitespace-nowrap border-b border-line bg-soft px-4 py-2.5 text-right font-display font-bold transition-colors",
                    hot?.c === c ? "text-brand" : "text-ink",
                  )}
                >
                  {axis(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, r) => (
              <tr key={row.fat}>
                <th
                  className={cn(
                    "sticky left-0 z-10 whitespace-nowrap border-b border-r border-line bg-soft px-4 py-2 text-left font-display font-bold transition-colors",
                    hot?.r === r ? "text-brand" : "text-ink",
                  )}
                >
                  {axis(row.fat)}
                </th>
                {row.rates.map((v, c) => {
                  const on = hot?.r === r && hot?.c === c;
                  const cross = hot !== null && (hot.r === r || hot.c === c);
                  return (
                    <td
                      key={c}
                      onMouseEnter={() => setHot({ r, c })}
                      style={{ backgroundColor: on ? undefined : heat(v) }}
                      className={cn(
                        "whitespace-nowrap border-b border-line/60 px-4 py-2 text-right font-semibold text-ink transition-colors",
                        cross && !on && "!bg-brand/25",
                        on && "bg-brand text-white shadow-lift dark:text-[#06222a]",
                      )}
                    >
                      {money(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
