import type * as React from 'react';

/**
 * Report tables clip long names / fields to a fixed width and end them with "..." (see `.clip-cells` in index.css).
 * Hover a clipped cell and the full text is shown as its tooltip.
 */
export const clipTitle = (e: React.MouseEvent<HTMLElement>): void => {
  const target = e.target as HTMLElement | null;
  const cell = target?.closest('td,th') as HTMLElement | null;
  if (!cell || cell.title) return;
  const inner = (cell.querySelector('.truncate') as HTMLElement | null) ?? cell;
  if (inner.scrollWidth > inner.clientWidth + 1) cell.title = (cell.textContent ?? '').trim();
};
