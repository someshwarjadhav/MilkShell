import type * as React from 'react';
import { AnimalHead } from './Illustrations';
import { Badge } from './ui/Badge';
import { cn } from '../lib/cn';
import { KIND_META, type Kind } from '../services/utils/milk';

export const KindChip: React.FC<{ kind: Kind | null; label?: string; compact?: boolean }> = ({ kind, label, compact }) => {
  if (!kind) return <Badge>{label || '—'}</Badge>;
  const m = KIND_META[kind];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-semibold', m.chip)}>
      {kind === 'mix' ? <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-goat/20 text-[10px] font-bold">M</span> : <AnimalHead type={kind} size={22} />}
      {compact ? m.label[0] : m.label}
    </span>
  );
};

export const KindDot: React.FC<{ kind: Kind; size?: number }> = ({ kind, size = 24 }) =>
  kind === 'mix' ? (
    <span style={{ width: size, height: size }} className="grid place-items-center rounded-full bg-goat/20 text-[11px] font-bold text-goat">M</span>
  ) : (
    <AnimalHead type={kind} size={size} />
  );
