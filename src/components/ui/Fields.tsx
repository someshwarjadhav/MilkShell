import type * as React from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

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

export const Select: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => {
  return (
    <div className="relative">
      <select {...rest} className={cn(base, 'appearance-none pr-9', className)}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute" />
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
