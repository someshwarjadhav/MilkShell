import type { MilkCode } from '../types/raw';

export type Kind = 'cow' | 'buffalo' | 'goat' | 'mix';

export const FILTER_KINDS: { value: 'cow' | 'buffalo' | 'mix'; label: string; code: MilkCode }[] = [
  { value: 'cow', label: 'Cow', code: 'C' },
  { value: 'buffalo', label: 'Buffalo', code: 'B' },
  { value: 'mix', label: 'Mix', code: 'M' },
];

export const KIND_META: Record<Kind, { label: string; hex: string; chip: string; bar: string }> = {
  cow: { label: 'Cow', hex: '#E8A33D', chip: 'bg-cow/15 text-cow', bar: 'bg-cow' },
  buffalo: { label: 'Buffalo', hex: '#5668B8', chip: 'bg-buffalo/15 text-buffalo', bar: 'bg-buffalo' },
  goat: { label: 'Goat', hex: '#3EA076', chip: 'bg-goat/15 text-goat', bar: 'bg-goat' },
  mix: { label: 'Mix', hex: '#3EA076', chip: 'bg-goat/15 text-goat', bar: 'bg-goat' },
};

export function kindOf(v: unknown): Kind | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'c' || s === 'cow') return 'cow';
  if (s === 'b' || s === 'buffalo') return 'buffalo';
  if (s === 'm' || s === 'mix' || s === 'mixed') return 'mix';
  if (s === 'g' || s === 'goat') return 'goat';
  return null;
}

export type ShiftName = 'Morning' | 'Evening' | 'Both';

export function shiftOf(v: unknown): ShiftName | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'm' || s === 'morning') return 'Morning';
  if (s === 'e' || s === 'evening') return 'Evening';
  if (s === 'z' || s === 'both') return 'Both';
  return null;
}
