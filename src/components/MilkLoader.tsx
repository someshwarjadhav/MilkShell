import type * as React from 'react';
import { cn } from '../lib/cn';
import loaderImg from '../assets/loader_image.png';

export type LoaderVariant = 'image' | 'glass' | 'drops' | 'ring' | 'bars';


const GLASS = 'M16 24 H64 L58 86 Q57.4 92 51 92 H29 Q22.6 92 22 86 Z';
const DROP = 'M40 2 C44 8 46 11 46 14 A6 6 0 0 1 34 14 C34 11 36 8 40 2 Z';

const CSS = `
  @keyframes ml-fill { 0% { transform: translateY(62px); } 70%, 100% { transform: translateY(4px); } }
  @keyframes ml-wave { to { transform: translateX(-40px); } }
  @keyframes ml-drop { 0% { transform: translateY(-14px) scale(.7); opacity: 0; } 15% { opacity: 1; } 55% { transform: translateY(18px) scale(1); opacity: 1; } 65%, 100% { transform: translateY(24px) scale(.4); opacity: 0; } }
  @keyframes ml-bounce { 0%, 100% { transform: translateY(0) scale(1.1, .85); } 40% { transform: translateY(-22px) scale(.9, 1.1); } 70% { transform: translateY(0) scale(1.1, .85); } }
  @keyframes ml-shadow { 0%, 100% { transform: scaleX(1); opacity: .25; } 40% { transform: scaleX(.5); opacity: .1; } }
  @keyframes ml-spin { to { transform: rotate(360deg); } }
  @keyframes ml-pulse { 0%, 100% { transform: scale(.8); } 50% { transform: scale(1.1); } }
  @keyframes ml-bar { 0%, 100% { transform: scaleY(.25); } 50% { transform: scaleY(1); } }
  .ml-fill { animation: ml-fill 2.8s ease-in-out infinite; }
  .ml-wave { animation: ml-wave 1.1s linear infinite; }
  .ml-drop { transform-box: fill-box; transform-origin: center; animation: ml-drop 2.8s ease-in infinite; }
  .ml-bounce { animation: ml-bounce 1s ease-in-out infinite; }
  .ml-shadow { animation: ml-shadow 1s ease-in-out infinite; }
  .ml-spin { transform-origin: 32px 32px; animation: ml-spin 1s linear infinite; }
  .ml-pulse { transform-box: fill-box; transform-origin: center; animation: ml-pulse 1.2s ease-in-out infinite; }
  .ml-orbit { animation: ml-spin 1.1s linear infinite; }
  .ml-orbit-2 { animation: ml-spin 1.8s linear infinite reverse; }
  .ml-bar { transform-origin: bottom; animation: ml-bar 1s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .ml-fill, .ml-wave, .ml-drop, .ml-bounce, .ml-shadow, .ml-spin, .ml-pulse, .ml-bar, .ml-orbit, .ml-orbit-2 { animation: none; }
    .ml-fill { transform: translateY(30px); }
  }
`;

const Glass = () => (
  <svg viewBox="0 0 80 100" className="h-24 w-20 text-brand" aria-hidden>
    <defs><clipPath id="ml-glass"><path d={GLASS} /></clipPath></defs>
    <path d={GLASS} fill="currentColor" fillOpacity=".08" />
    <g clipPath="url(#ml-glass)">
      <g className="ml-fill"><g className="ml-wave"><path d="M0 6 Q10 0 20 6 T40 6 T60 6 T80 6 T100 6 V80 H0 Z" fill="currentColor" fillOpacity=".85" /></g></g>
    </g>
    <path d={GLASS} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path className="ml-drop" d={DROP} fill="currentColor" />
  </svg>
);

const Logo = () => (
  <div className="relative grid h-36 w-36 place-items-center" aria-hidden>
  
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-brand">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="3" />
    </svg>
   
    <svg viewBox="0 0 100 100" className="ml-orbit absolute inset-0 h-full w-full text-brand">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="90 199" />
    </svg>
   
    <svg viewBox="0 0 100 100" className="ml-orbit-2 absolute inset-0 h-full w-full text-cow">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="28 261" />
    </svg>
    <img src={loaderImg} alt="" draggable={false} className="relative h-28 w-28 select-none object-contain" />
  </div>
);

const DROPS = [
  { color: 'bg-brand', delay: '0ms' },
  { color: 'bg-cow', delay: '160ms' },
  { color: 'bg-goat', delay: '320ms' },
];
const Drops = () => (
  <div className="flex h-20 items-end gap-5" aria-hidden>
    {DROPS.map((d) => (
      <div key={d.color} className="flex flex-col items-center">
        <span className="ml-bounce block" style={{ animationDelay: d.delay }}>
          <span className={cn('block h-6 w-6 -rotate-45 rounded-[50%_50%_50%_0]', d.color)} />
        </span>
        <span className="ml-shadow mt-2 block h-1.5 w-6 rounded-full bg-ink" style={{ animationDelay: d.delay }} />
      </div>
    ))}
  </div>
);

const Ring = () => (
  <svg viewBox="0 0 64 64" className="h-20 w-20 text-brand" aria-hidden>
    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="4" />
    <circle className="ml-spin" cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="44 132" />
    <g transform="translate(12 14) scale(.5)"><path className="ml-pulse" d={DROP} fill="currentColor" /></g>
  </svg>
);

const BARS = ['bg-brand', 'bg-cow', 'bg-goat', 'bg-buffalo', 'bg-brand'];
const Bars = () => (
  <div className="flex h-14 items-end gap-1.5" aria-hidden>
    {BARS.map((c, i) => (
      <span key={i} className={cn('ml-bar block h-full w-2.5 rounded-full', c)} style={{ animationDelay: `${i * 120}ms` }} />
    ))}
  </div>
);

export const MilkLoader: React.FC<{
  label?: string;
  variant?: LoaderVariant;
  className?: string;
 
  done?: number;
  total?: number;
}> = ({ label = 'Loading data from the SmartX portal…', variant = 'image', className }) => {
  return (
    <div className={cn('grid place-items-center px-5 py-14 sm:px-6', className)} role="status" aria-live="polite">
      <style>{CSS}</style>
      <div className="flex flex-col items-center gap-4">
        {variant === 'image' ? <Logo /> : variant === 'drops' ? <Drops /> : variant === 'ring' ? <Ring /> : variant === 'bars' ? <Bars /> : <Glass />}
        <div className="text-center">
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-xs text-mute">This can take up to a minute. Please wait.</p>
        </div>
      </div>
    </div>
  );
};