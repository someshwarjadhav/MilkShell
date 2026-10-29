import type * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertTriangle, Info, X } from "lucide-react";

type Tone = "ok" | "warn" | "info" | "error";
interface Toast {
  id: number;
  msg: string;
  tone: Tone;
  detail?: string;
}
const Ctx = createContext<(msg: string, tone?: Tone, detail?: string) => void>(
  () => undefined,
);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback(
    (msg: string, tone: Tone = "ok", detail?: string) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s, { id, msg, tone, detail }]);
      setTimeout(
        () => setItems((s) => s.filter((t) => t.id !== id)),
        tone === "error" ? 5200 : 3200,
      );
    },
    [],
  );
  const BG: Record<Tone, string> = {
    ok: "bg-ok",
    error: "bg-danger",
    warn: "bg-warn",
    info: "bg-brand",
  };
  const Icon = { ok: Check, warn: AlertTriangle, info: Info, error: X };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[90] flex flex-col gap-2"
        aria-live="polite"
      >
        <AnimatePresence>
          {items.map((t) => {
            const I = Icon[t.tone];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                role={t.tone === "error" ? "alert" : undefined}
                className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-md px-5 py-4 text-base font-medium text-white shadow-lg ${BG[t.tone]}`}
              >
                {t.tone === "error" ? (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-danger">
                    <I size={14} strokeWidth={3} />
                  </span>
                ) : (
                  <I size={22} strokeWidth={3} className="shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block">{t.msg}</span>
                  {t.detail && (
                    <span className="mt-0.5 block text-xs font-normal opacity-90">
                      {t.detail}
                    </span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
};

export const useToast = () => useContext(Ctx);
