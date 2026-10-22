import type * as React from 'react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
interface ThemeCtx { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }
const Ctx = createContext<ThemeCtx | null>(null);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('dhara-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('dhara-theme', theme);
  }, [theme]);
  const value = useMemo(() => ({ theme, setTheme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }), [theme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used inside ThemeProvider');
  return c;
}

export function useChartColors() {
  const { theme } = useTheme();
  return theme === 'dark'
    ? { grid: '#1E3B4B', tick: '#86A4B2', panel: '#0F222D', ink: '#E2EEF4', brand: '#38BEC3', line: '#2A4B5D' }
    : { grid: '#E1ECF0', tick: '#627D8C', panel: '#FFFFFF', ink: '#0E2A3A', brand: '#14969B', line: '#D6E2E8' };
}
