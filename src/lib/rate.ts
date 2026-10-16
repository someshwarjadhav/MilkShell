import type { MilkType, RateRule, RateTable } from '../types';

export const DEFAULT_RATES: RateTable = {
  cow: { fatRate: 5.4, snfRate: 2.0, base: 0, minFat: 3.2, minSnf: 8.0 },
  buffalo: { fatRate: 6.0, snfRate: 2.4, base: 0, minFat: 5.5, minSnf: 8.5 },
  goat: { fatRate: 6.4, snfRate: 2.6, base: 0, minFat: 3.5, minSnf: 7.8 },
};

export const PENALTY = 0.9;

/** Rate per litre from fat and SNF. A 10% cut applies when either is below the minimum. */
export function rateFor(rule: RateRule, fat: number, snf: number): number {
  let r = rule.base + fat * rule.fatRate + snf * rule.snfRate;
  if (fat < rule.minFat || snf < rule.minSnf) r *= PENALTY;
  return Math.round(Math.max(r, 0) * 100) / 100;
}

export const rateOf = (rates: RateTable, milk: MilkType, fat: number, snf: number) =>
  rateFor(rates[milk], fat, snf);
