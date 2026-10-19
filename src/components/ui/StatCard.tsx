import type * as React from 'react';
import type { ReactNode } from 'react';
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
  /** Data layer states: show a skeleton while loading, or a message + retry when the request failed. */
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export const StatCard: React.FC<Props> = ({ label, value, decimals = 0, prefix = '', suffix = '', icon, tone = 'text-brand', delta, spark, hint, loading, error, onRetry }) => {
  const v = useCountUp(value);
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-mute">{label}</span>
        <span className={cn('grid h-9 w-9 place-items-center rounded-xl bg-current/10', tone)}>
          <span className={tone}>{icon}</span>
        </span>
      </div>
      {loading ? <Skeleton className="h-9 w-32" /> : error ? (
        <p className="text-sm text-mute">{error} {onRetry && <button onClick={onRetry} className="font-semibold text-brand underline">Retry</button>}</p>
      ) : (
      <div className="flex items-end justify-between gap-2">
        <p className="font-display text-3xl font-extrabold leading-none tnum">{prefix}{nf(v, decimals)}<span className="ml-1 text-base font-semibold text-mute">{suffix}</span></p>
        {delta !== undefined && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold', up ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger')}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      )}
      {spark && !loading && !error && <div className={tone}><Sparkline values={spark} /></div>}
      {hint && <p className="-mt-1 text-xs text-mute">{hint}</p>}
    </Card>
  );
};
