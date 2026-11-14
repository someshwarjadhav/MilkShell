import type * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "./Fields";
import { cn } from "../../lib/cn";
import { PAGE_SIZE_OPTIONS } from "../../lib/global";

interface Props {
  total: number;
  /** 1-based current page */
  page: number;
  size: number;
  onPage: (page: number) => void;
  onSize?: (size: number) => void;
  className?: string;
}

const pagesToShow = (page: number, count: number): Array<number | "…"> => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
};

const btn =
  "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

/** SmartX-style footer shared by every API table: Showing x–y of N, numbered pages, 100/200/300 rows. */
export const PageBar: React.FC<Props> = ({ total, page, size, onPage, onSize, className }) => {
  const count = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, page), count);
  const from = total === 0 ? 0 : (cur - 1) * size + 1;
  const to = Math.min(total, cur * size);
  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line px-4 py-3 sm:px-5", className)}>
      <p className="tnum text-sm text-mute">
        Showing <span className="font-semibold text-ink">{from}–{to}</span> of <span className="font-semibold text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onPage(cur - 1)} disabled={cur <= 1} aria-label="Previous page" className={cn(btn, "border-line bg-panel text-mute hover:border-brand/60 hover:text-ink")}>
          <ChevronLeft size={16} />
        </button>
        <span className="tnum px-2 text-sm font-semibold sm:hidden">{cur} / {count}</span>
        <div className="hidden items-center gap-1.5 sm:flex">
          {pagesToShow(cur, count).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="px-1 text-mute" aria-hidden>…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                aria-current={p === cur ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(btn, p === cur ? "border-brand bg-brand text-brand-ink shadow-card" : "border-line bg-panel text-mute hover:border-brand/60 hover:text-ink")}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <button onClick={() => onPage(cur + 1)} disabled={cur >= count} aria-label="Next page" className={cn(btn, "border-line bg-panel text-mute hover:border-brand/60 hover:text-ink")}>
          <ChevronRight size={16} />
        </button>
      </div>
      {onSize && (
        <label className="flex items-center gap-2 text-sm text-mute">
          <span className="whitespace-nowrap">Rows per page</span>
          <div className="w-24">
            <Select value={size} onChange={(e) => onSize(Number(e.target.value))} className="h-9">
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </div>
        </label>
      )}
    </nav>
  );
};
