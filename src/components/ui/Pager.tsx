import type * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from './Fields';
import { cn } from '../../lib/cn';

interface Props {
  total: number;
  page: number;
  size: number;
  onPage: (page: number) => void;
  onSize?: (size: number) => void;
  sizes?: number[];
  className?: string;
}

const pagesAround = (page: number, pages: number): number[] => {
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  const end = Math.min(pages, start + 2);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

export const Pager: React.FC<Props> = ({ total, page, size, onPage, onSize, sizes = [5, 10, 25, 50], className }) => {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages);
  const from = total === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(total, current * size);
  const btn = 'grid h-8 min-w-8 place-items-center rounded-lg border border-line bg-panel px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-mute', className)}>
      <span className="tnum">{from} - {to} of {total}</span>
      <div className="flex items-center gap-2">
        {onSize && (
          <div className="w-20">
            <Select value={size} onChange={(e) => onSize(Number(e.target.value))} className="h-8 text-xs">
              {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </div>
        )}
        <button className={btn} disabled={current <= 1} onClick={() => onPage(current - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
        {pagesAround(current, pages).map((n) => (
          <button key={n} className={cn(btn, n === current ? 'border-brand bg-brand text-white' : 'text-ink hover:border-brand')} onClick={() => onPage(n)}>{n}</button>
        ))}
        <button className={btn} disabled={current >= pages} onClick={() => onPage(current + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
      </div>
    </div>
  );
};
