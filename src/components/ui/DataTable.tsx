import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Select } from './Fields';
import { EmptyState } from '../EmptyState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  pageSize?: number;
  pageSizes?: number[];
  onRowClick?: (r: T) => void;
  empty?: ReactNode;
  footerRow?: ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, pageSize = 10, pageSizes = [10, 25, 50, 100], onRowClick, empty, footerRow }: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);

  useEffect(() => setPage(0), [rows.length, size]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return dir === 'asc' ? r : -r;
    });
  }, [rows, columns, sortKey, dir]);

  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const cur = Math.min(page, pages - 1);
  const slice = sorted.slice(cur * size, cur * size + size);
  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  const toggle = (c: Column<T>) => {
    if (!c.sort) return;
    if (sortKey === c.key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(c.key); setDir('desc'); }
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('sticky top-0 whitespace-nowrap border-b border-line bg-soft/70 px-4 py-3 text-xs font-semibold text-mute first:rounded-tl-xl last:rounded-tr-xl', align(c.align), c.className)}
                >
                  {c.sort ? (
                    <button onClick={() => toggle(c)} className={cn('inline-flex items-center gap-1 hover:text-ink', c.align === 'right' && 'flex-row-reverse')}>
                      {c.header}
                      {sortKey === c.key ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-50" />}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn('group transition-colors hover:bg-brand/[0.06]', onRowClick && 'cursor-pointer')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('whitespace-nowrap border-b border-line/70 px-4 py-3 tnum', align(c.align), c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            {footerRow}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (empty ?? <EmptyState title="No records for these filters" hint="Widen the date range or pick another centre." />)}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-mute">
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <div className="w-24"><Select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-8 text-xs">{pageSizes.map((n) => <option key={n}>{n}</option>)}</Select></div>
            <span className="tnum">{cur * size + 1}–{Math.min(sorted.length, cur * size + size)} of {sorted.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:border-brand disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="px-2 tnum">Page {cur + 1} / {pages}</span>
            <button aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:border-brand disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
