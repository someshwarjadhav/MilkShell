export const nf = (n: number, d = 0) =>
  n.toLocaleString("en-IN", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  });
export const inr = (n: number, d = 0) => "₹" + nf(n, d);

const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());
export const addDays = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const fmtDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export const fmtShort = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

export const timeAgo = (isoStr: string) => {
  const m = Math.max(
    0,
    Math.round((Date.now() - new Date(isoStr).getTime()) / 60000),
  );
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
};
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (new Date(b + "T00:00:00").getTime() -
      new Date(a + "T00:00:00").getTime()) /
      86400000,
  );
