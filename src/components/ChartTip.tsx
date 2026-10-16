import type * as React from "react";
interface Entry {
  name?: string | number;
  value?: number | string;
  color?: string;
}
interface Props {
  active?: boolean;
  payload?: Entry[];
  label?: string | number;
  format?: (v: number) => string;
  title?: (l: string | number) => string;
}

export const ChartTip: React.FC<Props> = ({
  active,
  payload,
  label,
  format,
  title,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs shadow-pop">
      {label !== undefined && (
        <p className="mb-1 font-bold">{title ? title(label) : label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-mute">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          {p.name}
          <span className="ml-auto pl-3 font-bold text-ink tnum">
            {format && typeof p.value === "number" ? format(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};
