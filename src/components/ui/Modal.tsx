import type * as React from 'react';
import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Props { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }

function useLock(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', key);
    };
  }, [open, onClose]);
}

export const Modal: React.FC<Props> = ({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) => {
  useLock(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-deep/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={cn('relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[1.75rem] border border-line bg-panel shadow-pop', width)}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                <h3 className="text-lg font-bold">{title}</h3>
                {subtitle && <p className="text-sm text-mute">{subtitle}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-mute hover:bg-soft hover:text-ink"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-soft/50 px-6 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Drawer: React.FC<Omit<Props, 'footer'>> = ({ open, onClose, title, subtitle, children, width = 'max-w-xl' }) => {
  useLock(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-deep/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className={cn('absolute right-0 top-0 flex h-full w-full flex-col border-l border-line bg-panel shadow-pop', width)}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                <h3 className="text-xl font-bold">{title}</h3>
                {subtitle && <p className="text-sm text-mute">{subtitle}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-mute hover:bg-soft hover:text-ink"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
