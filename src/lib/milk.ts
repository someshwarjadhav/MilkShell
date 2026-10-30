import type { MilkType } from "../types";
import { MILK_BUFFALO, MILK_COW, MILK_MIX } from "./global";

export const MILK_TYPES: MilkType[] = ["cow", "buffalo", "mix"];

export const MILK_META: Record<
  MilkType,
  {
    label: string;
    local: string;
    hex: string;
    chip: string;
    dot: string;
    bar: string;
    ring: string;
  }
> = {
  cow: {
    label: MILK_COW,
    local: "गाय",
    hex: "#E8A33D",
    chip: "bg-cow/15 text-cow",
    dot: "bg-cow",
    bar: "bg-cow",
    ring: "ring-cow/40",
  },
  buffalo: {
    label: MILK_BUFFALO,
    local: "म्हैस",
    hex: "#5668B8",
    chip: "bg-buffalo/15 text-buffalo",
    dot: "bg-buffalo",
    bar: "bg-buffalo",
    ring: "ring-buffalo/40",
  },
 
  mix: {
    label: MILK_MIX,
    local: "मिक्स",
    hex: "#3EA076",
    chip: "bg-goat/15 text-goat",
    dot: "bg-goat",
    bar: "bg-goat",
    ring: "ring-goat/40",
  },
};
