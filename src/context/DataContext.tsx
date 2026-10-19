import type * as React from 'react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Thresholds } from '../types';
import { DEFAULT_THRESHOLDS } from '../lib/quality';
import { useAuth } from './AuthContext';

interface DataCtx {
  dairyName: string;
  thresholds: Thresholds;
  setThresholds: (t: Thresholds) => void;
}

const Ctx = createContext<DataCtx | null>(null);
const KEY = 'dhara-thresholds';

function loadThresholds(): Thresholds {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    const v = JSON.parse(raw) as Partial<Thresholds>;
    return { fat: { ...DEFAULT_THRESHOLDS.fat, ...v.fat }, snf: { ...DEFAULT_THRESHOLDS.snf, ...v.snf }, water: v.water ?? DEFAULT_THRESHOLDS.water };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [thresholds, setT] = useState<Thresholds>(loadThresholds);
  const setThresholds = useCallback((t: Thresholds) => {
    setT(t);
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* storage blocked: the limits still apply for this visit */ }
  }, []);
  const value = useMemo<DataCtx>(() => ({ dairyName: user?.dairyName || 'SmartX dairy', thresholds, setThresholds }), [user?.dairyName, thresholds, setThresholds]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData must be used inside DataProvider');
  return c;
}
