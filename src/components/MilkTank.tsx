import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useId } from 'react';

interface Props { percent: number; color?: string; height?: number; className?: string; track?: string; outline?: string }

export const MilkTank: React.FC<Props> = ({ percent, color = '#14969B', height = 260, className, track = 'rgb(var(--soft))', outline = 'rgb(var(--ink) / .16)' }) => {
  const id = useId().replace(/:/g, '');
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(Math.min(100, Math.max(0, percent))), 120);
    return () => clearTimeout(t);
  }, [percent]);
  const top = 14, bottom = 246;
  const y = bottom - ((bottom - top) * shown) / 100;
  const wavePath = 'M0 0 q22.5 -12 45 0 t45 0 t45 0 t45 0 t45 0 t45 0 t45 0 t45 0 V300 H0 Z';
  return (
    <svg viewBox="0 0 200 260" style={{ height }} className={className} role="img" aria-label={`Tank ${Math.round(percent)} percent full`}>
      <defs>
        <clipPath id={`clip-${id}`}><rect x="22" y={top} width="156" height="232" rx="44" /></clipPath>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".95" />
          <stop offset="1" stopColor={color} stopOpacity=".65" />
        </linearGradient>
      </defs>
      <rect x="22" y={top} width="156" height="232" rx="44" fill={track} />
      <g clipPath={`url(#clip-${id})`}>
        <g style={{ transform: `translateY(${y}px)`, transition: 'transform 1.8s cubic-bezier(.2,.8,.2,1)' }}>
          <g className="wave-b" style={{ opacity: 0.45 }}><path d={wavePath} transform="translate(-30 -4)" fill={color} /></g>
          <g className="wave-a"><path d={wavePath} fill={`url(#g-${id})`} /></g>
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={52 + i * 28} cy={30 + (i % 3) * 22} r={2 + (i % 2)} fill="#fff" opacity=".28" />
          ))}
        </g>
        <rect x="34" y="30" width="10" height="190" rx="5" fill="#fff" opacity=".22" />
      </g>
      <rect x="22" y={top} width="156" height="232" rx="44" fill="none" stroke={outline} strokeWidth="3" />
      {[25, 50, 75].map((t) => {
        const ty = bottom - ((bottom - top) * t) / 100;
        return (
          <g key={t}>
            <line x1="178" x2="190" y1={ty} y2={ty} stroke="rgb(var(--mute))" strokeWidth="2" strokeLinecap="round" />
            <text x="194" y={ty + 3.5} fontSize="9" fill="rgb(var(--mute))" textAnchor="start" style={{ display: 'none' }}>{t}</text>
          </g>
        );
      })}
    </svg>
  );
};
