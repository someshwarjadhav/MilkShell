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

/** Farmer id as SmartX shows it: numeric ids are padded to 4 digits ("1" -> "0001"); anything else is left as it is. */
export const farmerCode = (id: string | number | null | undefined): string => {
  const s = String(id ?? "").trim();
  return /^\d+$/.test(s) && s.length < 4 ? s.padStart(4, "0") : s;
};

/* ---- Farmer Collection (STIPL portal formats) ---- */
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-03" -> "03-11-2026" */
export const fmtDMY = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}-${m}-${y}` : iso;
};

/** "2026-11-03" -> "03 Nov 2026" (the date format of the STIPL portal tables and Excel sheets) */
export const fmtDateLong = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  const mon = MON3[Number(m) - 1];
  return y && m && d && mon ? `${d} ${mon} ${y}` : iso;
};

/** "2026-11-03" -> "03.11.2026" (Collection Date column of the Excel export) */
export const fmtDateDots = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

/** "09:30 AM" / "7:05 pm" / "13:20" -> "09:30:00" / "19:05:00" / "13:20:00" (Collection Time column of the Excel export) */
export const time24 = (t: string): string => {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(String(t ?? "").trim());
  if (!m) return String(t ?? "");
  let h = Number(m[1]);
  const ap = m[4]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`;
};
