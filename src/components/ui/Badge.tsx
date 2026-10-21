import type * as React from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'brand';
const T: Record<Tone, string> = {
  neutral: 'bg-soft text-mute',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/18 text-warn',
  danger: 'bg-danger/15 text-danger',
  brand: 'bg-brand/15 text-brand',
};

export const Badge: React.FC<{ tone?: Tone; dot?: boolean; children: ReactNode; className?: string; title?: string }> = ({ tone = 'neutral', dot, children, className, title }) => {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', T[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
};
