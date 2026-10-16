import type * as React from 'react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Center, Collection, Farmer, Machine, MilkType, RateTable, Sale, SyncLog, Thresholds } from '../types';
import { buildCenters, buildCollections, buildFarmers, buildMachines, buildSales, buildSyncLogs, DAIRY_NAME } from '../lib/mockData';
import { DEFAULT_RATES } from '../lib/rate';
import { DEFAULT_THRESHOLDS } from '../lib/quality';
import { todayISO } from '../lib/format';

interface NewFarmer { name: string; village: string; centerId: string; phone: string; milkTypes: MilkType[] }

interface DataCtx {
  dairyName: string;
  centers: Center[];
  farmers: Farmer[];
  machines: Machine[];
  collections: Collection[];
  sales: Sale[];
  syncLogs: SyncLog[];
  rates: RateTable;
  thresholds: Thresholds;
  farmerById: Map<string, Farmer>;
  centerById: Map<string, Center>;
  addFarmer: (f: NewFarmer) => Farmer;
  toggleFarmer: (id: string) => void;
  addCollection: (c: Collection) => void;
  syncCenter: (id: string) => void;
  syncAll: () => void;
  calibrate: (machineId: string) => void;
  setRates: (r: RateTable) => void;
  setThresholds: (t: Thresholds) => void;
  addSale: (s: Omit<Sale, 'id'>) => void;
  toggleSalePaid: (id: string) => void;
  resetData: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

function seed() {
  const centers = buildCenters();
  const farmers = buildFarmers(centers);
  return {
    centers,
    farmers,
    machines: buildMachines(centers),
    collections: buildCollections(farmers, centers),
    sales: buildSales(),
    syncLogs: buildSyncLogs(centers),
  };
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [init] = useState(seed);
  const [centers, setCenters] = useState(init.centers);
  const [farmers, setFarmers] = useState(init.farmers);
  const [machines, setMachines] = useState(init.machines);
  const [collections, setCollections] = useState(init.collections);
  const [sales, setSales] = useState(init.sales);
  const [syncLogs, setSyncLogs] = useState(init.syncLogs);
  const [rates, setRates] = useState<RateTable>(DEFAULT_RATES);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  const farmerById = useMemo(() => new Map(farmers.map((f) => [f.id, f])), [farmers]);
  const centerById = useMemo(() => new Map(centers.map((c) => [c.id, c])), [centers]);

  const addFarmer = useCallback<DataCtx['addFarmer']>(
    (nf) => {
      const n = farmers.length + 1;
      const f: Farmer = { ...nf, id: `f-${n}`, code: String(n).padStart(3, '0'), joined: todayISO(), active: true, advance: 0 };
      setFarmers((s) => [f, ...s]);
      return f;
    },
    [farmers.length],
  );

  const setCenterStatus = (ids: string[], status: Center['status'], stamp?: string) => {
    setCenters((s) => s.map((c) => (ids.includes(c.id) ? { ...c, status, lastSync: stamp ?? c.lastSync } : c)));
    setMachines((s) => s.map((m) => (ids.includes(m.centerId) ? { ...m, status, lastPing: stamp ?? m.lastPing } : m)));
  };

  const syncMany = useCallback((ids: string[]) => {
    setCenterStatus(ids, 'syncing');
    setTimeout(() => {
      const stamp = new Date().toISOString();
      setCenterStatus(ids, 'online', stamp);
      setSyncLogs((s) => [
        ...ids.map((id, i) => ({ id: `sl-${Date.now()}-${i}`, at: stamp, centerId: id, records: 8 + ((id.length * 7 + i * 5) % 40), status: 'ok' as const, via: 'Collector app' as const })),
        ...s,
      ].slice(0, 30));
    }, 1800);
  }, []);

  const value: DataCtx = {
    dairyName: DAIRY_NAME,
    centers, farmers, machines, collections, sales, syncLogs, rates, thresholds, farmerById, centerById,
    addFarmer,
    toggleFarmer: (id) => setFarmers((s) => s.map((f) => (f.id === id ? { ...f, active: !f.active } : f))),
    addCollection: (c) => setCollections((s) => [...s, c]),
    syncCenter: (id) => syncMany([id]),
    syncAll: () => syncMany(centers.map((c) => c.id)),
    calibrate: (id) => setMachines((s) => s.map((m) => (m.id === id ? { ...m, calibratedOn: todayISO() } : m))),
    setRates,
    setThresholds,
    addSale: (sale) => setSales((s) => [{ ...sale, id: `s-${Date.now()}` }, ...s]),
    toggleSalePaid: (id) => setSales((s) => s.map((x) => (x.id === id ? { ...x, paid: !x.paid } : x))),
    resetData: () => {
      const f = seed();
      setCenters(f.centers); setFarmers(f.farmers); setMachines(f.machines);
      setCollections(f.collections); setSales(f.sales); setSyncLogs(f.syncLogs);
      setRates(DEFAULT_RATES); setThresholds(DEFAULT_THRESHOLDS);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData must be used inside DataProvider');
  return c;
}
