import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useCenters } from './useSessionData';
import { getSession } from '../services/session';
import { vlccName } from '../services/vlcc/names';
import { GLOBALS } from '../lib/global';
import { getMccRoute, getVillageDetails } from '../services/master/vlcMaster.api';

export interface CentreOption {
  id: string;
  label: string;
}

export interface MccOption {
  id: string;
  label: string;
}

let selectedMcc = '';
const listeners = new Set<() => void>();

export function setSelectedMcc(id: string) {
  if (id === selectedMcc) return;
  selectedMcc = id;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const ALL_CENTRES = 'ALL';

const centreLabel = (id: string, name: string, station?: string): string => {
 
  const mapped = getSession()?.stationByVlcc?.[id];
  const code = mapped || station || id;
  return name ? `${name} | ${code}` : code;
};

const allCentres = (centers: ReturnType<typeof useCenters>): CentreOption[] => {
  const s = getSession();
  if (centers.length) return centers.map((c) => ({ id: c.id, label: centreLabel(c.id, c.name || vlccName(c.id), c.stationId) }));
  return (s?.vlccIds ?? []).map((id) => ({ id, label: centreLabel(id, vlccName(id), s?.stationByVlcc[id]) }));
};

export function useMccOptions(): MccOption[] {
  const centers = useCenters();
  const s = getSession();
  const prefixes = [...new Set(allCentres(centers).map((c) => c.id.slice(0, 3)))];
  const own = s?.mccId ?? '';
  const list = prefixes.length ? prefixes : own ? [own] : [];
  return list.map((id) => {
    const route = centers.find((c) => c.id.startsWith(id) && c.routeName)?.routeName;
    return { id, label: route || s?.mccName || id };
  });
}

export function useSelectedMcc(): string {
  const options = useMccOptions();
  const picked = useSyncExternalStore(subscribe, () => selectedMcc);
  return options.some((o) => o.id === picked) ? picked : options[0]?.id ?? '';
}

export function useCentreOptions(): CentreOption[] {
  const centers = useCenters();
  const mcc = useSelectedMcc();
  const all = allCentres(centers);
  const own = all.filter((c) => c.id.startsWith(mcc));
  return own.length ? own : all;
}

export const useFirstCentre = (): string => useCentreOptions()[0]?.id ?? '';

export const useCentreIds = (): string[] => useCentreOptions().map((c) => c.id);

export const ALL_PLANTS = 'ALL';

type RouteOf = Map<string, { id: string; name: string }>;
const routeCache = new Map<string, Promise<RouteOf>>();

function loadRouteMap(mccid: string, plantid: string, total: number): Promise<RouteOf> {
  const key = `${mccid}|${plantid}`;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<RouteOf> => {
    const out: RouteOf = new Map();
    try {
      const routes = await getMccRoute(mccid, plantid);
      const lists = await Promise.all(
        routes.map((r) =>
          getVillageDetails(mccid, r.routeId)
            .then((v) => ({ r, v }))
            .catch(() => ({ r, v: [] as Awaited<ReturnType<typeof getVillageDetails>> })),
        ),
      );
      for (const { r, v } of lists) {
      
        if (routes.length > 1 && total > 0 && v.length >= total) continue;
        for (const x of v) if (x.villageId && !out.has(x.villageId)) out.set(x.villageId, { id: r.routeId, name: r.routeName || r.routeId });
      }
      console.info(`[routes] ${routes.length} route(s):`, routes.map((r) => `${r.routeName} | ${r.routeId}`), `-> ${out.size} centres placed`);
    } catch (e) {
      console.warn('[routes] could not load the routes:', e instanceof Error ? e.message : e);
    }
    return out;
  })();
  routeCache.set(key, p);
  void p.then((m) => {
    if (!m.size) routeCache.delete(key);
  });
  return p;
}

export interface ScopeCentre extends CentreOption {
  plant: string;
}

export function usePlantScope() {
  const centers = useCenters();
  const session = getSession();
  const [routeOf, setRouteOf] = useState<RouteOf>(new Map());
  const [picked, setPicked] = useState<string>(ALL_PLANTS);

  const base = useMemo(() => allCentres(centers), [centers]);
  const baseCount = base.length;
  const scope = session?.scope ?? '';

  useEffect(() => {
    const mccid = session?.mccLoginId || GLOBALS.mccLoginId || session?.mccId || GLOBALS.mccid || '';
    if (!mccid || !baseCount) return;
    let alive = true;
    void loadRouteMap(mccid, GLOBALS.plantid || '', baseCount).then((m) => {
      if (alive) setRouteOf(m);
    });
    return () => {
      alive = false;
    };
   
  }, [scope, baseCount]);

  const plantNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const r of routeOf.values()) if (!names.has(r.id)) names.set(r.id, r.name);
    for (const c of centers) {
      const k = c.routeId || c.routeName;
      if (k && c.routeName && !names.has(k)) names.set(k, c.routeName);
    }
    return names;
  }, [routeOf, centers]);

  const withPlant = useMemo<ScopeCentre[]>(() => {
    const byId = new Map(centers.map((c) => [c.id, c]));
    return base.map((c) => {
      const raw = byId.get(c.id);
      const plant = routeOf.get(c.id)?.id || raw?.routeId || raw?.routeName || c.id.slice(0, 3) || session?.mccId || '';
      return { ...c, plant };
    });
  }, [base, centers, routeOf, session?.mccId]);

  const realPlants = useMemo(() => {
    const seen = new Set<string>();
    const out: MccOption[] = [];
    for (const c of withPlant) {
      if (seen.has(c.plant)) continue;
      seen.add(c.plant);
      out.push({ id: c.plant, label: plantNames.get(c.plant) || session?.mccName || c.plant });
    }
    return out;
  }, [withPlant, plantNames, session?.mccName]);

  const plantOptions = useMemo<MccOption[]>(
    () => (realPlants.length ? [{ id: ALL_PLANTS, label: 'All' }, ...realPlants] : realPlants),
    [realPlants],
  );
  const plant = plantOptions.some((o) => o.id === picked) ? picked : plantOptions[0]?.id ?? '';

  const centreOptions = useMemo(
    () => withPlant.filter((c) => plant === ALL_PLANTS || c.plant === plant),
    [withPlant, plant],
  );
  const centreIds = useMemo(() => centreOptions.map((c) => c.id), [centreOptions]);
  const setPlant = useCallback((id: string) => setPicked(id), []);

  return { plantOptions, plant, setPlant, centreOptions, centreIds };
}
