import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CircleUserRound, LifeBuoy, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useSamples } from '../hooks/useSmartxData';
import { isoFromTrdate } from '../services/utils/date';
import { sampleStamp } from '../services/farmer/farmerBook';
import { flagOf, FLAG_META } from '../lib/quality';
import { initials, todayISO } from '../lib/format';
import { Badge } from '../components/ui/Badge';

interface Props { onMenu: () => void; onSearch: () => void }

function useOutside(ref: React.RefObject<HTMLElement>, fn: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fn(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, fn]);
}

export const Topbar: React.FC<Props> = ({ onMenu, onSearch }) => {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { thresholds } = useData();
  const { rows: samples } = useSamples(todayISO(), todayISO(), true, 2);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutside(bellRef, () => setBell(false));
  useOutside(menuRef, () => setMenu(false));

  const alerts = useMemo(() => {
    const today = todayISO();
    return samples
      .filter((c) => isoFromTrdate(c.date) === today)
      .map((c) => ({ c, f: flagOf(c, thresholds) }))
      .filter((x) => x.f)
      .sort((a, b) => (sampleStamp(a.c) < sampleStamp(b.c) ? 1 : -1))
      .slice(0, 6);
  }, [samples, thresholds]);
  const count = alerts.length;
  const hour = new Date().getHours();
  const shift = hour < 12 ? 'Morning shift' : 'Evening shift';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6">
      <button onClick={onMenu} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-mute hover:text-ink lg:hidden"><Menu size={18} /></button>
      <button onClick={onSearch} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-left text-sm text-mute transition-colors hover:border-brand/60 sm:max-w-md">
        <Search size={16} /><span className="truncate">Search pages or farmers</span>
        <kbd className="ml-auto hidden rounded-md bg-soft px-1.5 py-0.5 text-[11px] font-semibold sm:block">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <Badge tone="brand" dot className="hidden md:inline-flex">{shift} · live</Badge>
        <button onClick={toggle} aria-label="Switch theme" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-mute hover:text-ink">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="relative" ref={bellRef}>
          <button onClick={() => setBell((b) => !b)} aria-label="Alerts" className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-mute hover:text-ink">
            <Bell size={17} />
            {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{count}</span>}
          </button>
          <AnimatePresence>
            {bell && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-12 w-80 overflow-hidden rounded-3xl border border-line bg-panel shadow-pop">
                <p className="border-b border-line px-5 py-3 text-sm font-bold">Needs attention</p>
                <ul className="max-h-80 divide-y divide-line/70 overflow-y-auto">
                  {alerts.map(({ c, f }) => (
                    <li key={c.key} className="px-5 py-3 text-sm"><p className="font-semibold">{FLAG_META[f!].label}: {c.farmerName}</p><p className="text-xs text-mute">Fat {c.fat} · SNF {c.snf} · {c.time}</p></li>
                  ))}
                  {count === 0 && <li className="px-5 py-8 text-center text-sm text-mute">All clear for now.</li>}
                </ul>
                <Link to="/quality" onClick={() => setBell(false)} className="block border-t border-line bg-soft/60 px-5 py-3 text-center text-sm font-semibold text-brand">Open quality watch</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenu((m) => !m)} aria-label="Account menu" className="flex h-10 items-center gap-2 rounded-xl border border-line bg-panel pl-1 pr-3 hover:border-brand/60">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-deep text-xs font-bold text-white dark:bg-brand dark:text-[#06222a]">{initials(user?.name ?? 'U')}</span>
            <span className="hidden text-sm font-semibold sm:block">{user?.name.split(' ')[0]}</span>
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-12 w-64 rounded-3xl border border-line bg-panel p-2 shadow-pop">
                <div className="px-3 py-2"><p className="font-bold">{user?.name}</p><p className="truncate text-xs text-mute">{user?.email}</p><p className="mt-1 text-xs text-brand">{user?.role}</p></div>
                <Link to="/settings" onClick={() => setMenu(false)} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-soft"><CircleUserRound size={16} />Account and settings</Link>
                <Link to="/contact" onClick={() => setMenu(false)} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-soft"><LifeBuoy size={16} />Contact support</Link>
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"><LogOut size={16} />Sign out</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
