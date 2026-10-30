import type * as React from "react";
import { AnimalHead } from "./Illustrations";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/cn";
import type { MilkType } from "../types";
import { KIND_META, type Kind } from "../services/utils/milk";

const headOf = (k: Kind): MilkType => (k === "goat" ? "mix" : k);

export const KindChip: React.FC<{
  kind: Kind | null;
  label?: string;
  compact?: boolean;
}> = ({ kind, label, compact }) => {
  if (!kind) return <Badge>{label || "—"}</Badge>;
  const m = KIND_META[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-semibold",
        m.chip,
      )}
    >
      <AnimalHead type={headOf(kind)} size={22} />
      {compact ? m.label[0] : m.label}
    </span>
  );
};

export const KindDot: React.FC<{ kind: Kind; size?: number }> = ({
  kind,
  size = 24,
}) => <AnimalHead type={headOf(kind)} size={size} />;
