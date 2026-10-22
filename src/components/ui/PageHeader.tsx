import type * as React from 'react';
import type { ReactNode } from 'react';

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: ReactNode }> = ({ title, subtitle, actions }) => {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-3xl text-sm text-mute sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};
