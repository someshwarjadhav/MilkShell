import type * as React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Card: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => {
  return <div {...rest} className={cn('rounded-[1.75rem] border border-line bg-panel shadow-lift', className)} />;
};

export const CardHeader: React.FC<{ title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }> = ({ title, subtitle, action, className }) => {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      <div className="min-w-0">
        <h3 className="text-lg font-bold leading-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
};
