import type * as React from "react";
import { Select } from "./Fields";
import { cn } from "../../lib/cn";
/** same sizes as every other MilkShell table */
const SIZES = [10, 25, 50, 100, 250];

/** "Result per page" - the page-size picker that sits at the TOP of a table (same as SmartX). */
export const ResultPerPage: React.FC<{ size: number; onSize: (n: number) => void; className?: string }> = ({ size, onSize, className }) => (
  <label className={cn("flex items-center gap-2 text-sm", className)}>
    <span className="whitespace-nowrap font-bold">Result per page:</span>
    <div className="w-24">
      <Select value={String(size)} onChange={(e) => onSize(Number(e.target.value))} className="h-9">
        {SIZES.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
    </div>
  </label>
);

/** Slim bar above a table: Record Count (from - to of total) + Result per page. */
export const TableTopBar: React.FC<{ total: number; page: number; size: number; onSize: (n: number) => void }> = ({ total, page, size, onSize }) => {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-soft/50 px-4 py-2.5 sm:px-5">
      <p className="tnum text-sm text-mute">
        <span className="font-bold text-ink">Record Count:</span> {from} - {to} of {total}
      </p>
      <ResultPerPage size={size} onSize={onSize} />
    </div>
  );
};
