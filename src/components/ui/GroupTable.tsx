import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Select } from './Fields';
import { EmptyState } from '../EmptyState';

export interface GCol<T> {
  key: string;
  header: ReactNode;
  /** Columns with the same neighbouring `group` share one heading above them (DOC Collection, VLC Collection ...). */
  group?: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface Props<T> {
  columns: GCol<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  pageSize?: number;
  pageSizes?: number[];
  sizeLabel?: string;
  /** Extra <tr> rows after the data (totals). */
  footer?: ReactNode;
  empty?: ReactNode;
}

const alignOf = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');
const TH = 'whitespace-nowrap border-b border-line bg-soft/70 px-4 py-3 text-xs font-semibold text-mute';

/** Same look as DataTable, with a two-line heading (group over columns) and a totals area. */
export function GroupTable<T>({ columns, rows, rowKey, pageSize = 100, pageSizes = [10, 25, 50, 100, 250], sizeLabel = 'Result per page', footer, empty }: Props<T>) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);
  useEffect(() => setPage(0), [rows.length, size]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * size, cur * size + size);
  const grouped = columns.some((c) => c.group);

  const top = useMemo(() => {
    const out: ReactNode[] = [];
    for (let i = 0; i < columns.length; ) {
      const c = columns[i];
      if (!c.group) {
        out.push(<th key={c.key} rowSpan={grouped ? 2 : 1} scope="col" className={cn(TH, 'border-r border-line/60', alignOf(c.align))}>{c.header}</th>);
        i++;
        continue;
      }
      let n = 1;
      while (i + n < columns.length && columns[i + n].group === c.group) n++;
      out.push(<th key={`g-${c.group}-${i}`} colSpan={n} scope="colgroup" className={cn(TH, 'border-x border-line/60 text-center text-sm text-ink')}>{c.group}</th>);
      i += n;
    }
    return out;
  }, [columns, grouped]);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>{top}</tr>
            {grouped && (
              <tr>
                {columns.filter((c) => c.group).map((c) => (
                  <th key={c.key} scope="col" className={cn(TH, alignOf(c.align))}>{c.header}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={rowKey(r)} className="transition-colors hover:bg-brand/[0.06]">
                {columns.map((c) => (
                  <td key={c.key} className={cn('whitespace-nowrap border-b border-line/70 px-4 py-3 tnum', alignOf(c.align), c.className)}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
            {footer}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (empty ?? <EmptyState title="No records for these filters" hint="Widen the date range or pick another centre." />)}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-mute">
          <div className="flex items-center gap-2">
            <span>{sizeLabel}</span>
            <div className="w-24"><Select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-8 text-xs">{pageSizes.map((n) => <option key={n}>{n}</option>)}</Select></div>
            <span className="tnum">{cur * size + 1}–{Math.min(rows.length, cur * size + size)} of {rows.length}</span>
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
