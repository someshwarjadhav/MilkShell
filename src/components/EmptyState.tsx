import type * as React from 'react';
import type { ReactNode } from 'react';
import { MilkCan } from './Illustrations';

export const EmptyState: React.FC<{ title: string; hint?: string; action?: ReactNode }> = ({ title, hint, action }) => {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center">
      <MilkCan size={56} className="animate-drift opacity-90" />
      <p className="font-display text-lg font-bold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-mute">{hint}</p>}
      {action}
    </div>
  );
};
