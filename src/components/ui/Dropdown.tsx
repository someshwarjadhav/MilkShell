import type * as React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/cn";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  /** classes of the closed box: height, border, padding, text size (each caller keeps the look of its old <select>) */
  className: string;
  /** shown when there is no option at all */
  placeholder?: string;
  "aria-label"?: string;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
}

/** "Barbadi-Wardha | 0001" -> name + code, so the code can be shown as a small tag on the right of the list */
export const splitLabel = (label: string): [string, string | null] => {
  const at = label.lastIndexOf(" | ");
  return at > 0 ? [label.slice(0, at), label.slice(at + 3)] : [label, null];
};

interface PopBox {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  listMax: number;
}

const SEARCH_AFTER = 8;
const EDGE = 8;

/**
 * The one dropdown of the whole app. Same job as the browser <select> (a value, a list of options, onChange(value)),
 * but the list is drawn by us: rounded panel, selected tick, code tag, ONE styled scroll bar when the list is long,
 * a search box when there are more than 8 options, keyboard (arrows / Home / End / Enter / Esc / first letter)
 * and a list that opens over the page (never cut off by a card) and always stays inside the screen - phone included.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  id,
  name,
  disabled,
  invalid,
  required,
  autoFocus,
  className,
  placeholder,
  "aria-label": ariaLabel,
  onBlur,
  onFocus,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<PopBox | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const searchable = options.length > SEARCH_AFTER;
  // like <select>: a value that is not in the list shows the first usable option
  const selected = options.find((o) => o.value === value) ?? options.find((o) => !o.disabled) ?? options[0];
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 132), vw - EDGE * 2);
    const left = Math.min(Math.max(EDGE, r.left), Math.max(EDGE, vw - width - EDGE));
    const below = vh - r.bottom - EDGE - 6;
    const above = r.top - EDGE - 6;
    const up = below < 220 && above > below;
    const room = up ? above : below;
    setBox({
      left,
      width,
      ...(up ? { bottom: vh - r.top + 6 } : { top: r.bottom + 6 }),
      listMax: Math.max(120, Math.min(room - (searchable ? 60 : 16), 320)),
    });
  }, [searchable]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (pop.current?.contains(t) || btn.current?.contains(t)) return;
      close();
    };
    const onMove = (e: Event) => {
      if (e.target instanceof Node && pop.current?.contains(e.target)) return; // scrolling inside the list
      place();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, close, place]);

  // on open: highlight the picked option; the cursor goes to the search box (not on phones - it would pop the keyboard up)
  useEffect(() => {
    if (!open) return;
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    (searchable && !touch ? searchRef.current : pop.current)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, box]);

  // the list closes if the box got disabled / removed while open
  useEffect(() => {
    if (disabled && open) close();
  }, [disabled, open, close]);

  const pick = (o: DropdownOption | undefined) => {
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
    btn.current?.focus();
  };

  const step = (from: number, dir: 1 | -1) => {
    let i = from + dir;
    while (i >= 0 && i < shown.length && shown[i]?.disabled) i += dir;
    return i < 0 || i >= shown.length ? from : i;
  };

  const firstLetter = (key: string, from: number, list: DropdownOption[]) => {
    const ch = key.toLowerCase();
    const next = list.findIndex((o, i) => i > from && !o.disabled && o.label.toLowerCase().startsWith(ch));
    return next >= 0 ? next : list.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(ch));
  };

  const onPopKey = (e: React.KeyboardEvent) => {
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === "Escape") {
      handled();
      close();
      btn.current?.focus();
    } else if (e.key === "Tab") {
      close();
    } else if (e.key === "ArrowDown") {
      handled();
      setActive((i) => step(i, 1));
    } else if (e.key === "ArrowUp") {
      handled();
      setActive((i) => step(i, -1));
    } else if (e.key === "Home") {
      handled();
      setActive(step(-1, 1));
    } else if (e.key === "End") {
      handled();
      setActive(step(shown.length, -1));
    } else if (e.key === "Enter") {
      handled();
      pick(shown[active]);
    } else if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const at = firstLetter(e.key, active, shown);
      if (at >= 0) setActive(at);
    }
  };

  const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
      e.preventDefault();
      if (!open) setOpen(true);
    } else if (e.key === "Enter") {
      // like the old <select>: Enter does not open it (forms use Enter to go to the next field)
      e.preventDefault();
    } else if (!open && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // typing a letter on the closed box picks the next option starting with it, as the old <select> did
      const cur = options.findIndex((o) => o.value === selected?.value);
      const at = firstLetter(e.key, cur, options);
      if (at >= 0 && options[at] && options[at]!.value !== value) onChange(options[at]!.value);
    }
  };

  const [selName, selCode] = splitLabel(selected?.label ?? "");

  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        data-dd=""
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-invalid={invalid ? true : undefined}
        onBlur={onBlur}
        onFocus={onFocus}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onTriggerKey}
        className={cn(
          "relative flex items-center text-left disabled:cursor-not-allowed aria-[invalid=true]:border-danger",
          className,
          open && "!border-brand ring-4 ring-brand/15",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-mute/70")}>
          {selected ? selName : placeholder}
          {selCode && <span className="text-mute"> | {selCode}</span>}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      {open &&
        box &&
        createPortal(
          <div
            ref={pop}
            tabIndex={-1}
            data-dd-pop=""
            onKeyDown={onPopKey}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: "fixed", left: box.left, width: box.width, top: box.top, bottom: box.bottom, zIndex: 120 }}
            className="overflow-hidden rounded-xl border border-line bg-panel text-ink shadow-pop outline-none"
          >
            {searchable && (
              <div className="relative border-b border-line">
                <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search"
                  autoComplete="off"
                  className="h-11 w-full bg-transparent pl-9 pr-3 text-base text-ink outline-none placeholder:text-mute/70 sm:text-sm"
                />
              </div>
            )}
            <ul
              ref={listRef}
              role="listbox"
              style={{ maxHeight: box.listMax }}
              className="dd-scroll overflow-y-auto overscroll-contain p-1.5"
            >
              {shown.map((o, i) => {
                const [name2, code] = splitLabel(o.label);
                const isSel = o.value === value;
                return (
                  <li
                    key={`${o.value}-${i}`}
                    data-i={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onClick={() => pick(o)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors sm:py-2",
                      o.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
                      i === active && !o.disabled && "bg-brand/[0.09]",
                      isSel ? "font-semibold text-brand" : "text-ink",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{name2}</span>
                    {code && (
                      <span className="tnum shrink-0 rounded-md bg-soft px-1.5 py-0.5 text-xs font-medium text-mute">{code}</span>
                    )}
                    {isSel && <Check size={15} className="shrink-0 text-brand" aria-hidden />}
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-mute">Nothing matches.</li>}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
};
