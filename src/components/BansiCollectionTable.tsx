import type * as React from 'react';
import { BANSI_DECIMALS, BANSI_HEAD, bansiDmy, type BansiLine } from '../lib/bansiExcel';
import { cn } from '../lib/cn';
import { clipTitle } from '../lib/clipTitle';

/**
 * Bansi's Farmer Collection table - the same layout as the Excel sheet:
 * From Date / To Date, the heading, then for every centre a "VSP Name" row, its farmers, the centre's own bold total row,
 * and the bold grand "Total :" row at the end. Column widths are fixed (a long name ends with "...", hover shows it all),
 * so the table fits the page without a long sideways scroll.
 */

/** Only the name column has a fixed width (a long name ends with "...", hover shows it all); every other column fits its own values. */
const NAME_WIDTH = 230;
const NCOL = BANSI_HEAD.length;

const num = (v: number, dec: number): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const NAME_CELL = 'overflow-hidden whitespace-nowrap';
const NAME_STYLE: React.CSSProperties = { maxWidth: NAME_WIDTH };
const BORDER = 'border border-line/80';
const CELL = `${BORDER} px-2 py-1.5 text-[13px]`;

interface Props {
  from: string;
  to: string;
  lines: BansiLine[];
}

export const BansiCollectionTable: React.FC<Props> = ({ from, to, lines }) => (
  <div className="overflow-x-auto">
    <table
      aria-label="Farmer collection"
      className="clip-cells w-full border-collapse text-sm"
      onMouseOver={clipTitle}
    >
      <thead>
        <tr className="bg-soft/30">
          <th className={cn(CELL, 'text-left font-semibold')} />
          <th className={cn(CELL, 'text-left font-bold')}>From Date</th>
          <th className={cn(CELL, 'text-left font-semibold tnum')} colSpan={2}>{bansiDmy(from)}</th>
          <th className={cn(CELL, 'text-left font-bold')} colSpan={2}>To Date</th>
          <th className={cn(CELL, 'text-left font-semibold tnum')} colSpan={3}>{bansiDmy(to)}</th>
          <th className={CELL} colSpan={NCOL - 9} />
        </tr>
        <tr className="bg-soft/60">
          {BANSI_HEAD.map((h, i) => (
            <th key={h} scope="col" style={i === 1 ? NAME_STYLE : undefined} className={cn(CELL, 'whitespace-nowrap font-bold', i < 2 ? (i === 0 ? 'text-center' : 'text-left') : 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => {
          if (l.kind === 'vsp') {
            return (
              <tr key={l.key} className="bg-soft/40">
                <td colSpan={NCOL} className={cn(CELL, 'font-bold')}>VSP Name</td>
              </tr>
            );
          }
          if (l.kind === 'farmer') {
            return (
              <tr key={l.key} className="transition-colors hover:bg-brand/5">
                <td className={cn(CELL, 'tnum text-center')}>{l.sr}</td>
                <td className={cn(CELL, NAME_CELL)} style={NAME_STYLE}><span className="block truncate">{l.name}</span></td>
                {l.v.map((v, i) => (
                  <td key={i} className={cn(CELL, 'tnum whitespace-nowrap text-right')}>{num(v, BANSI_DECIMALS[i] ?? 2)}</td>
                ))}
              </tr>
            );
          }
          const total = l.kind === 'total';
          return (
            <tr key={l.key} className={cn('font-bold', total ? 'bg-brand/20' : 'bg-brand/10')}>
              <td className={cn(CELL, total && 'border-t-2 border-t-ink/40')} />
              <td className={cn(CELL, NAME_CELL, total && 'border-t-2 border-t-ink/40')} style={NAME_STYLE}><span className="block truncate">{l.text}</span></td>
              {l.v.map((v, i) => (
                <td key={i} className={cn(CELL, 'tnum whitespace-nowrap text-right', total && 'border-t-2 border-t-ink/40')}>{num(v, BANSI_DECIMALS[i] ?? 2)}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
