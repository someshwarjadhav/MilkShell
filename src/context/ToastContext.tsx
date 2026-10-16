import type * as React from 'react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, AlertTriangle, Info } from 'lucide-react';

type Tone = 'ok' | 'warn' | 'info';
interface Toast { id: number; msg: string; tone: Tone }
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Tone = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200);
  }, []);
  const Icon = { ok: Check, warn: AlertTriangle, info: Info };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const I = Icon[t.tone];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-deep px-4 py-3 text-sm font-medium text-white shadow-pop"
              >
                <span className={`grid h-6 w-6 place-items-center rounded-full ${t.tone === 'ok' ? 'bg-ok' : t.tone === 'warn' ? 'bg-warn' : 'bg-brand'}`}>
                  <I size={14} />
                </span>
                {t.msg}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
};

export const useToast = () => useContext(Ctx);
