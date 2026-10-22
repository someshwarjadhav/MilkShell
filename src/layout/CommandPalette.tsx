import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, Search } from 'lucide-react';
import { flattenNav, useNav } from './nav';
import { useFarmerMaster, useSamples } from '../hooks/useSmartxData';
import { buildFarmerBook } from '../services/farmer/farmerBook';
import { addDays, todayISO } from '../lib/format';
import { cn } from '../lib/cn';
import { vlccOption } from '../services/vlcc/names';

export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const menu = useNav();
  const today = todayISO();
  const master = useFarmerMaster(open);
  const samples = useSamples(addDays(today, -29), today, open);
  const farmers = useMemo(() => (open ? buildFarmerBook(master.rows, samples.rows, today) : []), [open, master.rows, samples.rows, today]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pages = flattenNav(menu).filter((p) => !s || p.label.toLowerCase().includes(s) || (p.hint ?? '').toLowerCase().includes(s) || p.section.toLowerCase().includes(s)).map((p) => ({ key: p.to, label: p.label, hint: p.hint ?? p.section, to: p.to }));
    const people = s.length > 1
      ? farmers.filter((f) => f.name.toLowerCase().includes(s) || f.farmerId.includes(s)).slice(0, 4).map((f) => ({ key: f.key, label: f.name, hint: `Farmer ${f.farmerId} · ${vlccOption(f.vlccid)}${f.village ? ` · ${f.village}` : ''}`, to: `/farmers?open=${encodeURIComponent(f.key)}` }))
      : [];
    return [...pages, ...people];
  }, [q, farmers, menu]);

  useEffect(() => { if (open) { setQ(''); setI(0); } }, [open]);
  useEffect(() => setI(0), [q]);

  const go = (to: string) => { nav(to); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] grid place-items-start justify-items-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Quick search">
          <motion.div className="absolute inset-0 bg-deep/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-panel shadow-pop" initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search size={18} className="text-mute" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose();
                  if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(results.length - 1, x + 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
                  if (e.key === 'Enter' && results[i]) go(results[i].to);
                }}
                placeholder="Jump to a page or find a farmer"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-mute"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {results.map((r, idx) => (
                <li key={r.key}>
                  <button onMouseEnter={() => setI(idx)} onClick={() => go(r.to)} className={cn('flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left', idx === i ? 'bg-brand/12' : 'hover:bg-soft')}>
                    <span><span className="block text-sm font-semibold">{r.label}</span><span className="block text-xs text-mute">{r.hint}</span></span>
                    {idx === i && <CornerDownLeft size={15} className="text-brand" />}
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-mute">Nothing matches “{q}”.</li>}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
