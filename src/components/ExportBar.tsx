import type * as React from 'react';
import { useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';

export interface ExportAction {
  id: string;
  label: string;
  icon: LucideIcon;
  variant: 'primary' | 'danger' | 'success' | 'outline';
  run: () => void | Promise<void>;
}

interface Props {
  actions: ExportAction[];
  disabled?: boolean;
}

/** Same coloured buttons as the SmartX Farmer Collection report: blue Excel, red PDF, plain Print, green CSV. */
const LOOK: Record<ExportAction['variant'], string> = {
  primary: '!bg-[#2f6df6] !text-white hover:!bg-[#1f57d6] dark:!bg-[#3b78ff] dark:hover:!bg-[#5b90ff]',
  danger: '!bg-[#e5393e] !text-white hover:!bg-[#c92b30]',
  success: '!bg-[#1f9d55] !text-white hover:!bg-[#178045]',
  outline: '',
};

export const ExportBar: React.FC<Props> = ({ actions, disabled }) => {
  // every button keeps its own "running" flag: pressing one never greys out or blocks the others
  const [running, setRunning] = useState<ReadonlySet<string>>(() => new Set());
  const lock = useRef<Set<string>>(new Set());

  const run = async (action: ExportAction) => {
    if (lock.current.has(action.id)) return; // double click on the SAME button only
    lock.current.add(action.id);
    setRunning(new Set(lock.current));
    try {
      await action.run();
    } finally {
      // keep the spinner visible for a moment so a very fast export still gives feedback
      window.setTimeout(() => {
        lock.current.delete(action.id);
        setRunning(new Set(lock.current));
      }, 450);
    }
  };

  return (
    <>
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.id}
            size="sm"
            variant={a.variant === 'outline' ? 'outline' : 'primary'}
            icon={<Icon size={15} aria-hidden />}
            loading={running.has(a.id)}
            disabled={disabled}
            className={cn('shadow-none', LOOK[a.variant])}
            onClick={() => void run(a)}
          >
            {a.label}
          </Button>
        );
      })}
    </>
  );
};
