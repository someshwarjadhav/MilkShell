import type * as React from 'react';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from './Card';
import { useCountUp } from '../hooks';
import { cn } from '../../lib/cn';
import { nf } from '../../lib/format';
import { Skeleton } from '../Widget';

export const Sparkline: React.FC<{ values: number[]; color?: string; height?: number }> = ({ values, color = 'currentColor', height = 36 }) => {
  if (values.length < 2) return null;
  const w = 120;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 4 - ((v - min) / span) * (height - 8)}`);
  const d = 'M' + pts.join(' L');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L${w},${height} L0,${height} Z`} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

interface Props {
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  icon: ReactNode;
  tone?: string;
  delta?: number;
  spark?: number[];
  hint?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;

  idle?: boolean;

  compact?: boolean;
}

const bigIcon = (icon: ReactNode) => (isValidElement(icon) ? cloneElement(icon as ReactElement<{ size?: number; strokeWidth?: number }>, { size: 24, strokeWidth: 2 }) : icon);

export const StatCard: React.FC<Props> = ({ label, value, decimals = 0, prefix = '', suffix = '', icon, delta, spark, hint, loading, error, onRetry, idle, compact }) => {
  const v = useCountUp(value);
  const up = (delta ?? 0) >= 0;
  const tone = 'text-brand';
  return (
    <Card className={cn('relative overflow-hidden', compact ? 'p-4' : 'p-5')}>
      
      <span aria-hidden className={cn('pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-current opacity-[0.07]', tone)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-mute">{label}</p>
          <div className="mt-1.5 flex min-h-9 items-end">
            {idle ? (
              <p className="font-display text-3xl font-extrabold leading-none text-mute/50">—</p>
            ) : loading ? <Skeleton className="h-8 w-32" /> : error ? (
              <p className="text-sm text-mute">{error} {onRetry && <button onClick={onRetry} className="font-semibold text-brand underline">Retry</button>}</p>
            ) : (
              <div className="flex min-w-0 items-end gap-2">
                <p className="truncate font-display text-3xl font-extrabold leading-none tnum">{prefix}{nf(v, decimals)}<span className="ml-1 text-base font-semibold text-mute">{suffix}</span></p>
                {delta !== undefined && (
                  <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold', up ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger')}>
                    {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
          {(hint || idle) && <p className="mt-1.5 min-h-4 truncate text-xs text-mute">{idle ? 'Press Submit to load' : hint}</p>}
        </div>
        <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-current/10 ring-1 ring-current/15', tone)}>
          <span className={tone}>{bigIcon(icon)}</span>
        </span>
      </div>
      {spark && !loading && !error && !idle && <div className={cn('relative mt-2', tone)}><Sparkline values={spark} /></div>}
    </Card>
  );
};