import type * as React from 'react';
import { Children, isValidElement } from 'react';
import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Dropdown, type DropdownOption } from './Dropdown';

const base =
  'h-10 w-full rounded-xl border border-line bg-panel px-3 text-sm text-ink placeholder:text-mute/70 transition-colors hover:border-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15';

export const Field: React.FC<{ label: string; hint?: string; children: ReactNode; className?: string }> = ({ label, hint, children, className }) => {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
};

export const Input: React.FC<InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }> = ({ className, icon, ...rest }) => {
  if (!icon) return <input {...rest} className={cn(base, className)} />;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">{icon}</span>
      <input {...rest} className={cn(base, 'pl-9', className)} />
    </div>
  );
};

/** flattens the <option> children of a <Select> (arrays, fragments, falsy values) into dropdown options */
function optionsOf(children: ReactNode): DropdownOption[] {
  const out: DropdownOption[] = [];
  const walk = (node: ReactNode): void => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
      if (child.type === 'option') {
        const label = Children.toArray(props.children).map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('');
        out.push({ value: props.value !== undefined ? String(props.value) : label, label, disabled: props.disabled });
      } else if (props.children) {
        walk(props.children); // <Fragment> / <optgroup>
      }
    });
  };
  walk(children);
  return out;
}

/**
 * The dropdown of the whole app (same look as SmartX: rounded panel, tick on the picked option, search box for long lists,
 * keyboard, always inside the screen on a phone), drawn in the MilkShell colours.
 * It keeps the API of the old <select>: `value`, <option> children and onChange(e) with e.target.value, so no page needed a change.
 */
export const Select: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, value, onChange, disabled, id, name, required, autoFocus, 'aria-label': ariaLabel }) => {
  const options = optionsOf(children);
  return (
    <div className="relative">
      <Dropdown
        value={value === undefined || value === null ? '' : String(value)}
        options={options}
        onChange={(v) => onChange?.({ target: { value: v, name }, currentTarget: { value: v, name } } as unknown as ChangeEvent<HTMLSelectElement>)}
        id={id}
        name={name}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className={cn(base, 'pr-9 font-medium disabled:cursor-not-allowed disabled:opacity-55', className)}
      />
    </div>
  );
};

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-xl bg-soft p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
            value === o.value ? 'bg-panel text-ink shadow-sm' : 'text-mute hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
