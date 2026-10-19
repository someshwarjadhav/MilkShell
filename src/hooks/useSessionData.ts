import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getCenters, getMenuTree, getReportConfig, restoreSession } from '../services/bootstrap';
import { columnOrder, columnVisible } from '../services/report/report.service';
import type { Center } from '../services/mappers/center.mapper';
import type { LoginProfile } from '../services/auth/auth.service';

/** Decrypts the saved login for the page that calls it (runs again whenever another page opens). */
export function useLoginData(): LoginProfile | null {
  const { pathname } = useLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => restoreSession(), [pathname]);
}

/** The centre list for any combo box. Loaded once at sign-in (getCenter); forms never call the API themselves. */
export const useCenters = (): Center[] => getCenters();

export const useMenuTree = () => getMenuTree();

/**
 * Report columns switched on for this user (getReportAccess).
 *   const { isVisible } = useReportColumns('farmercollection');
 *   columns.filter((c) => isVisible(c.key, ALIASES[c.key]))
 */
export function useReportColumns(report: string) {
  const cfg = getReportConfig();
  return {
    isVisible: (key: string, aliases: string[] = []) => columnVisible(cfg, report, [key, ...aliases]),
    /** Keeps only the visible columns and puts them in the portal's order. */
    arrange: <T,>(items: T[], keyOf: (t: T) => string, aliases: Record<string, string[]>): T[] =>
      items
        .filter((t) => columnVisible(cfg, report, [keyOf(t), ...(aliases[keyOf(t)] ?? [])]))
        .map((t, i) => ({ t, i, o: columnOrder(cfg, report, [keyOf(t), ...(aliases[keyOf(t)] ?? [])]) }))
        .sort((a, b) => (a.o ?? Infinity) - (b.o ?? Infinity) || a.i - b.i)
        .map((x) => x.t),
  };
}
