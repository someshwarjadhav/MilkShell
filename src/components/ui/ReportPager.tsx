import type * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from './Fields';

interface Props {
  total: number;

  page: number;
  size: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  sizes?: number[];
  sizeLabel?: string;
}


export const ReportPager: React.FC<Props> = ({ total, page, size, onPage, onSize, sizes = [10, 25, 50, 100, 250], sizeLabel = 'Result per page' }) => {
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (cur - 1) * size + 1;
  const to = Math.min(total, cur * size);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-mute">
      <div className="flex items-center gap-2">
        <span>{sizeLabel}</span>
        <div className="w-24">
          <Select value={size} onChange={(e) => onSize(Number(e.target.value))} className="h-8 text-xs">
            {sizes.map((n) => <option key={n}>{n}</option>)}
          </Select>
        </div>
        <span className="tnum">{from}–{to} of {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button aria-label="Previous page" disabled={cur <= 1} onClick={() => onPage(cur - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:border-brand disabled:opacity-40"><ChevronLeft size={16} /></button>
        <span className="px-2 tnum">Page {cur} / {pages}</span>
        <button aria-label="Next page" disabled={cur >= pages} onClick={() => onPage(cur + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:border-brand disabled:opacity-40"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
};
