import { useMemo } from 'react';
import { fetchFarmerCollection, fetchFarmerMaster, fetchFarmersOf } from '../services/farmer/farmer.api';
import { mapFarmers, type FarmerRow } from '../services/mappers/farmer.mapper';
import { mapMaster, type MasterFarmer } from '../services/farmer/farmerBook';
import { getSession } from '../services/session';
import { useQuery, type QueryState } from './useQuery';
import type { RawFarmerRow, RawLoose } from '../services/types/raw';

export function useSamples(from: string, to: string, enabled = true, priority: 0 | 1 | 2 = 1): { q: QueryState<RawFarmerRow>; rows: FarmerRow[] } {
  const ids = getSession()?.vlccIds ?? [];
  const idKey = ids.join(',');
  const q = useQuery<RawFarmerRow>(enabled ? `farmer:${from}:${to}:Z:ALL:${idKey}` : null, (emit) =>
    fetchFarmerCollection({ from, to, shift: 'Z', milk: 'ALL', vlccIds: ids, priority }, emit));
  const rows = useMemo(() => mapFarmers(q.rows), [q.rows]);
  return { q, rows };
}

export function useFarmerMaster(enabled = true): { q: QueryState<RawLoose>; rows: MasterFarmer[] } {
  const ids = getSession()?.vlccIds ?? [];
  const idKey = ids.join(',');
  const q = useQuery<RawLoose>(enabled ? `master2:${idKey}` : null, (emit) => fetchFarmerMaster(ids, emit));
  const rows = useMemo(() => mapMaster(q.rows), [q.rows]);
  return { q, rows };
}

export function useFarmersOf(vlcid: string, enabled = true): { q: QueryState<RawLoose>; rows: MasterFarmer[] } {
  const q = useQuery<RawLoose>(enabled && vlcid ? `getfarmer:${vlcid}` : null, () => fetchFarmersOf(vlcid));
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return mapMaster(q.rows).filter((m) => m.farmerId && !seen.has(m.farmerId) && seen.add(m.farmerId));
  }, [q.rows]);
  return { q, rows };
}

export const isLoadingQ = (q: QueryState<unknown>) => q.status === 'loading' || (q.fetching && q.rows.length === 0);
