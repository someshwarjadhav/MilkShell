import type { MilkCode } from '../types/raw';
import { MILK_BUFFALO, MILK_COW, MILK_MIX, shiftName } from '../../lib/global';

export type Kind = 'cow' | 'buffalo' | 'goat' | 'mix';

export const FILTER_KINDS: { value: 'cow' | 'buffalo' | 'mix'; label: string; code: MilkCode }[] = [
  { value: 'cow', label: MILK_COW, code: 'C' },
  { value: 'buffalo', label: MILK_BUFFALO, code: 'B' },
  { value: 'mix', label: MILK_MIX, code: 'M' },
];

export const KIND_META: Record<Kind, { label: string; hex: string; chip: string; bar: string }> = {
  cow: { label: MILK_COW, hex: '#E8A33D', chip: 'bg-cow/15 text-cow', bar: 'bg-cow' },
  buffalo: { label: MILK_BUFFALO, hex: '#5668B8', chip: 'bg-buffalo/15 text-buffalo', bar: 'bg-buffalo' },
  goat: { label: 'Goat', hex: '#3EA076', chip: 'bg-goat/15 text-goat', bar: 'bg-goat' },
  mix: { label: MILK_MIX, hex: '#3EA076', chip: 'bg-goat/15 text-goat', bar: 'bg-goat' },
};

export function kindOf(v: unknown): Kind | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'c' || s === MILK_COW.toLowerCase()) return 'cow';
  if (s === 'b' || s === MILK_BUFFALO.toLowerCase()) return 'buffalo';
  if (s === 'm' || s === 'mix' || s === 'mixed' || s === MILK_MIX.toLowerCase()) return 'mix';
  if (s === 'g' || s === 'goat') return 'goat';
  return null;
}

export type ShiftName = string;

export function shiftOf(v: unknown): ShiftName | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  for (const o of ['M', 'E', 'Z']) {
    if (s === o.toLowerCase() || s === shiftName(o).toLowerCase()) return shiftName(o);
  }
  return null;
}
