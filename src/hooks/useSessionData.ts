import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  getCenters,
  getMenuTree,
  getReportConfig,
  restoreSession,
} from "../services/bootstrap";
import { columnOrder, columnVisible } from "../services/report/report.api";
import type { Center } from "../services/mappers/center.mapper";
import type { LoginProfile } from "../services/auth/auth.api";

export function useLoginData(): LoginProfile | null {
  const { pathname } = useLocation();
  return useMemo(() => restoreSession(), [pathname]);
}


export const useCenters = (): Center[] => getCenters();

export const useMenuTree = () => getMenuTree();

export function useReportColumns(report: string) {
  const cfg = getReportConfig();
  return {
    isVisible: (key: string, aliases: string[] = []) =>
      columnVisible(cfg, report, [key, ...aliases]),
    arrange: <T>(
      items: T[],
      keyOf: (t: T) => string,
      aliases: Record<string, string[]>,
    ): T[] =>
      items
        .filter((t) =>
          columnVisible(cfg, report, [keyOf(t), ...(aliases[keyOf(t)] ?? [])]),
        )
        .map((t, i) => ({
          t,
          i,
          o: columnOrder(cfg, report, [keyOf(t), ...(aliases[keyOf(t)] ?? [])]),
        }))
        .sort((a, b) => (a.o ?? Infinity) - (b.o ?? Infinity) || a.i - b.i)
        .map((x) => x.t),
  };
}
