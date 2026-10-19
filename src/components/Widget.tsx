import type * as React from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import { EmptyState } from './EmptyState';
import { cn } from '../lib/cn';
import type { QueryState } from '../hooks/useQuery';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-xl bg-soft', className)} aria-hidden />
);

export const LoadingBlock: React.FC<{ height?: string; label?: string; q?: Pick<QueryState<unknown>, 'done' | 'total'> }> = ({ height = 'h-40', label, q }) => (
  <div className="space-y-2 px-5 py-4 sm:px-6" role="status" aria-live="polite">
    <Skeleton className={cn('w-full', height)} />
    <p className="text-xs text-mute">
      {label ?? 'Loading from the SmartX portal. This can take up to a minute.'}
      {q && q.total > 1 ? ` ${q.done} of ${q.total} requests done.` : ''}
    </p>
  </div>
);

export const ErrorBlock: React.FC<{ message: string; onRetry: () => void; busy?: boolean; compact?: boolean }> = ({ message, onRetry, busy, compact }) => (
  <div className={cn('flex flex-wrap items-center gap-3 text-sm', compact ? 'px-1 py-1' : 'px-5 py-8 sm:px-6')} role="alert">
    <AlertTriangle size={18} className="shrink-0 text-danger" />
    <p className="min-w-0 flex-1 text-mute">{message}</p>
    <Button size="sm" variant="outline" icon={<RefreshCw size={14} />} loading={busy} onClick={onRetry}>Retry</Button>
  </div>
);

export function Notice({ q }: { q: QueryState<unknown> }) {
  if (q.note && !q.error) {
    return <p className="flex items-start gap-1.5 px-5 pt-3 text-xs text-mute sm:px-6"><Info size={13} className="mt-px shrink-0" />{q.note}</p>;
  }
  if (q.fetching && q.rows.length > 0) {
    const progress = !q.stale && q.total > 1 ? ` (${q.done} of ${q.total} requests done)` : '';
    return <p className="px-5 pt-2 text-xs text-mute sm:px-6">{q.stale ? 'Showing saved data while the portal answers…' : `Loading the remaining data…${progress}`}</p>;
  }
  if (q.error && q.rows.length > 0) {
    return <div className="px-5 pt-3 sm:px-6"><ErrorBlock compact message={`${q.error.message} Showing the last saved data.`} onRetry={q.retry} /></div>;
  }
  if (q.failed > 0 && !q.fetching) {
    return <div className="px-5 pt-3 sm:px-6"><ErrorBlock compact message={`${q.failed} of ${q.total} requests failed, so these figures may be incomplete.`} onRetry={q.retry} /></div>;
  }
  return null;
}

/**
 * Standard loading / error / empty handling for a widget. `children` renders only when there is data
 * (or `showWhenEmpty` is set, for widgets whose zero state is itself the answer).
 */
export function QueryBoundary({
  q, children, skeleton, emptyTitle = 'No records yet', emptyHint, showWhenEmpty,
}: {
  q: QueryState<unknown>;
  children: ReactNode;
  skeleton?: ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  showWhenEmpty?: boolean;
}) {
  if (q.status === 'loading' || (q.fetching && q.rows.length === 0)) return <>{skeleton ?? <LoadingBlock />}</>;
  if (q.status === 'error') return <ErrorBlock message={q.error?.message ?? 'This data could not be loaded.'} onRetry={q.retry} busy={q.fetching} />;
  if (q.rows.length === 0 && !showWhenEmpty) {
    return (
      <>
        <Notice q={q} />
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </>
    );
  }
  return (
    <>
      <Notice q={q} />
      {children}
    </>
  );
}
