import type { Collection, Flag, Thresholds } from '../types';

export const DEFAULT_THRESHOLDS: Thresholds = {
  fat: { cow: 3.2, buffalo: 5.5, goat: 3.5 },
  snf: { cow: 8.0, buffalo: 8.5, goat: 7.8 },
  temp: 30,
};

export const FLAG_META: Record<Flag, { label: string; hint: string }> = {
  water: { label: 'Water suspected', hint: 'SNF far below normal for this milk' },
  'low-fat': { label: 'Low fat', hint: 'Fat below the alert limit' },
  'low-snf': { label: 'Low SNF', hint: 'SNF below the alert limit' },
  'high-temp': { label: 'Warm sample', hint: 'Sample temperature above the limit' },
};

export function flagOf(c: Collection, t: Thresholds): Flag | null {
  if (c.snf < t.snf[c.milk] - 0.7) return 'water';
  if (c.fat < t.fat[c.milk]) return 'low-fat';
  if (c.snf < t.snf[c.milk]) return 'low-snf';
  if (c.temp > t.temp) return 'high-temp';
  return null;
}
