export type MilkType = "cow" | "buffalo" | "goat";

export type Flag = "low-fat" | "low-snf" | "water" | "adulterated";

export type LimitKind = "cow" | "buffalo" | "mix";
export interface Thresholds {
  fat: Record<LimitKind, number>;
  snf: Record<LimitKind, number>;
  water: number;
}
