import type * as React from "react";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn";

export interface CheckOption {
  id: string;
  label: string;
}

export const CheckList: React.FC<{
  options: CheckOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  searchable?: boolean;
  height?: string;
  className?: string;
}> = ({ options, value, onChange, searchable = true, height = "max-h-44", className }) => {
  const [q, setQ] = useState("");
  const picked = useMemo(() => new Set(value), [value]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);

  const all = options.length > 0 && options.every((o) => picked.has(o.id));
  const some = !all && options.some((o) => picked.has(o.id));
  const toggle = (id: string) => onChange(picked.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  const row = "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-brand/[0.07]";
  const box = "h-4 w-4 shrink-0 rounded border-line accent-brand";

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-panel", className)}>
      {searchable && options.length > 6 && (
        <div className="relative border-b border-line">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            aria-label="Search list"
            className="h-9 w-full bg-transparent pl-8 pr-3 text-sm text-ink placeholder:text-mute/70 focus:outline-none"
          />
        </div>
      )}
      <div className={cn("overflow-y-auto p-1.5", height)} role="group">
        <label className={cn(row, "font-bold")}>
          <input
            type="checkbox"
            className={box}
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = some;
            }}
            onChange={() => onChange(all ? [] : options.map((o) => o.id))}
          />
          All
          <span className="ml-auto text-xs font-semibold text-mute tnum">
            {value.length}/{options.length}
          </span>
        </label>
        {shown.map((o) => (
          <label key={o.id} className={row}>
            <input type="checkbox" className={box} checked={picked.has(o.id)} onChange={() => toggle(o.id)} />
            <span className="min-w-0 truncate">{o.label}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="px-2.5 py-3 text-xs text-mute">Nothing matches.</p>}
      </div>
    </div>
  );
};
