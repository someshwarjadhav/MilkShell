import type * as React from 'react';
import type { MilkType } from '../types';
import { MILK_META } from '../lib/milk';
import { AnimalHead } from './Illustrations';
import { cn } from '../lib/cn';

export const MilkTypeChip: React.FC<{ type: MilkType; compact?: boolean }> = ({ type, compact }) => {
  const m = MILK_META[type];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-semibold', m.chip)}>
      <AnimalHead type={type} size={22} />
      {compact ? m.label[0] : m.label}
    </span>
  );
};
