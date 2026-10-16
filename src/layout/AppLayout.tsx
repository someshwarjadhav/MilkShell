import type * as React from 'react';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { PageLoader } from '../components/PageLoader';
import { useData } from '../context/DataContext';

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dhara-collapsed') === '1');
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  const { pathname } = useLocation();
  const { dairyName } = useData();

  useEffect(() => localStorage.setItem('dhara-collapsed', collapsed ? '1' : '0'), [collapsed]);
  useEffect(() => { setMobile(false); }, [pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden p-3 transition-[width] duration-300 lg:block ${collapsed ? 'w-[92px]' : 'w-[286px]'}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>

      <div
        data-mobile-drawer
        aria-hidden={!mobile}
        className={`fixed inset-0 z-50 lg:hidden ${mobile ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <AnimatePresence>
          {mobile && (
            <motion.div key="mobile-navigation" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="absolute inset-0 bg-deep/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobile(false)} />
              <motion.div className="absolute inset-y-0 left-0 w-[290px] max-w-[88vw] p-3" initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
                <Sidebar mobile collapsed={false} onToggle={() => undefined} onNavigate={() => setMobile(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`transition-[padding] duration-300 ${collapsed ? 'lg:pl-[92px]' : 'lg:pl-[286px]'}`}>
        <Topbar onMenu={() => setMobile(true)} onSearch={() => setPalette(true)} />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<PageLoader />}>
            <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
        <footer className="px-6 pb-8 pt-2 text-center text-xs text-mute">{dairyName} · Dhara dairy cloud · demo data</footer>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
};

export default AppLayout;
