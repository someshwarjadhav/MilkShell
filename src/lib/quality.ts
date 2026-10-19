import type { FarmerRow } from '../services/mappers/farmer.mapper';
import type { Flag, LimitKind, Thresholds } from '../types';

/** Starting alert limits. They are settings, not data: change them in Settings. */
export const DEFAULT_THRESHOLDS: Thresholds = {
  fat: { cow: 3.2, buffalo: 5.5, mix: 3.5 },
  snf: { cow: 8.0, buffalo: 8.5, mix: 8.0 },
  water: 5,
};

export const FLAG_META: Record<Flag, { label: string; hint: string }> = {
  water: { label: 'Water suspected', hint: 'SNF far below the limit for this milk' },
  'low-fat': { label: 'Low fat', hint: 'Fat below the alert limit' },
  'low-snf': { label: 'Low SNF', hint: 'SNF below the alert limit' },
  adulterated: { label: 'Added water', hint: 'The analyzer reported water above the limit' },
};

const limitKind = (r: FarmerRow): LimitKind => (r.milk === 'cow' || r.milk === 'buffalo' ? r.milk : 'mix');

export function flagOf(r: FarmerRow, t: Thresholds): Flag | null {
  const k = limitKind(r);
  if (r.water > t.water) return 'adulterated';
  if (r.snf > 0 && r.snf < t.snf[k] - 0.7) return 'water';
  if (r.fat > 0 && r.fat < t.fat[k]) return 'low-fat';
  if (r.snf > 0 && r.snf < t.snf[k]) return 'low-snf';
  return null;
}
