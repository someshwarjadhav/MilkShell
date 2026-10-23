import { useSyncExternalStore } from 'react';
import { useCenters } from './useSessionData';
import { getSession } from '../services/session';
import { vlccName } from '../services/vlcc/names';

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
  const code = station || id;
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
