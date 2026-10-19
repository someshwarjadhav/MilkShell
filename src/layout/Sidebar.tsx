import type * as React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { buildNav } from './nav';
import { useMenuTree } from '../hooks/useSessionData';
import { Logo } from '../components/Illustrations';
import { cn } from '../lib/cn';
import { useData } from '../context/DataContext';
import { Tanker } from '../components/Illustrations';

interface Props { collapsed: boolean; onToggle: () => void; onNavigate?: () => void; mobile?: boolean }

export const Sidebar: React.FC<Props> = ({ collapsed, onToggle, onNavigate, mobile }) => {
  const { dairyName } = useData();
  const tree = useMenuTree();
  const NAV = useMemo(() => buildNav(tree), [tree]);
  const slim = collapsed && !mobile;
  return (
    <nav aria-label="Main" className="flex h-full flex-col rounded-[2rem] border border-line bg-panel p-3 shadow-lift">
      <div className={cn('flex items-center gap-3 px-2 py-3', slim && 'justify-center px-0')}>
        <Logo size={slim ? 38 : 44} />
        {!slim && (
          <div className="min-w-0">
            <p className="font-display text-xl font-extrabold leading-none">Dhara</p>
            <p className="mt-1 truncate text-xs text-mute">{dairyName}</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex-1 space-y-4 overflow-y-auto pr-1">
        {NAV.map((g) => (
          <div key={g.title}>
            {!slim && <p className="px-3 pb-1 text-xs font-semibold text-mute/80">{g.title}</p>}
            {slim && <div className="mx-3 mb-1 border-t border-line" />}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.to === '/'}
                    onClick={onNavigate}
                    title={slim ? it.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors',
                        slim && 'justify-center px-0',
                        isActive ? 'text-brand' : 'text-mute hover:bg-soft hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId={mobile ? 'nav-pill-m' : 'nav-pill'} className="absolute inset-0 rounded-2xl bg-brand/12" transition={{ type: 'spring', damping: 28, stiffness: 340 }} />}
                        <it.icon size={19} className="relative shrink-0" />
                        {!slim && <span className="relative truncate">{it.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {!slim && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-deep p-4 text-white">
          <Tanker size={92} className="-ml-1 opacity-95" />
          <p className="mt-2 text-sm font-semibold">Tanker leaves at 9:30</p>
          <p className="text-xs text-white/60">Check stock before dispatch.</p>
        </div>
      )}
      {!mobile && (
        <button onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="mt-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-mute hover:bg-soft hover:text-ink">
          {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Collapse</>}
        </button>
      )}
    </nav>
  );
};
