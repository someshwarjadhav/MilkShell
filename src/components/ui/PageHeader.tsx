import type * as React from 'react';
import type { ReactNode } from 'react';

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: ReactNode }> = ({ title, subtitle, actions }) => {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};
