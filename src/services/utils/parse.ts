
export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

export const str = (v: unknown) => String(v ?? '').trim();
