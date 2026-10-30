import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SearchOption {
  value: string;
  label: string;
}

interface Props {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const SearchSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = '-- select --',
  searchPlaceholder = 'Search…',
  disabled,
  className,
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);

  const close = () => {
    setOpen(false);
    setQ('');
  };
  const pick = (v: string) => {
    onChange(v);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
  }, [open]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = shown[active];
      if (o) pick(o.value);
    }
  };

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-panel px-3 text-left text-sm transition-colors hover:border-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-55',
          open && 'border-brand ring-4 ring-brand/15',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-mute/70')}>{selected?.label ?? placeholder}</span>
        {selected && !disabled && (
          <span
            role="button"
            aria-label="Clear"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-mute hover:bg-soft hover:text-ink"
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={16} className={cn('shrink-0 text-mute transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-panel shadow-pop">
          <div className="relative border-b border-line">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              aria-label="Search"
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-ink placeholder:text-mute/70 focus:outline-none"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {shown.map((o, i) => (
              <li
                key={o.value}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                  i === active && 'bg-brand/[0.09]',
                  o.value === value && 'font-semibold',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.value === value && <Check size={14} className="shrink-0 text-brand" />}
              </li>
            ))}
            {shown.length === 0 && <li className="px-2.5 py-4 text-center text-xs text-mute">Nothing matches.</li>}
          </ul>
          <p className="border-t border-line px-3 py-1.5 text-[11px] text-mute">
            {shown.length} of {options.length}
          </p>
        </div>
      )}
    </div>
  );
};