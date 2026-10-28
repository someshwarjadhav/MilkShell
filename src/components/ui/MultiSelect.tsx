import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/cn";

export interface MultiOption {
  id: string;
  label: string;
}

export const MultiSelect: React.FC<{
  options: MultiOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}> = ({ options, value, onChange, placeholder = "Select", allLabel = "All", className }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const picked = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);

  const all = options.length > 0 && options.every((o) => picked.has(o.id));
  const some = !all && value.length > 0;
  const toggle = (id: string) => onChange(picked.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  const summary =
    value.length === 0
      ? placeholder
      : all
        ? allLabel
        : value.length === 1
          ? (options.find((o) => o.id === value[0])?.label ?? value[0])
          : `${value.length} selected`;

  const row = "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-brand/[0.07]";
  const box = "h-4 w-4 shrink-0 rounded border-line accent-brand";

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line bg-panel px-3 text-left text-sm text-ink transition-colors hover:border-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
      >
        <span className={cn("min-w-0 truncate", value.length === 0 && "text-mute/70")}>{summary}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-mute transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-panel shadow-pop">
          {options.length > 6 && (
            <div className="relative border-b border-line">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                aria-label="Search list"
                className="h-9 w-full bg-transparent pl-8 pr-3 text-sm text-ink placeholder:text-mute/70 focus:outline-none"
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto p-1.5" role="listbox" aria-multiselectable="true">
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
              {allLabel}
              <span className="ml-auto text-xs font-semibold tnum text-mute">
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
      )}
    </div>
  );
};
