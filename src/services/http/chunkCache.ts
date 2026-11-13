/**
 * Day cache: every finished day (per scope + centre + milk type + shift) is remembered in memory AND in the browser
 * (IndexedDB), so it survives a page reload. A report asks the server only for the days that are not remembered yet,
 * so the second time the same (or an overlapping) date range opens at once.
 *
 *  - today (and later) is never remembered: it is still changing
 *  - the last few days are remembered only briefly (late centre syncs can still add milk to them)
 *  - older days are remembered for hours
 *  - a forced refresh (Retry / Submit again with the same filters) clears everything
 */
const DB_NAME = 'smartx-day-cache';
const STORE = 'days';
const RECENT_DAYS = 3;
const RECENT_KEEP_MS = 5 * 60_000;
const OLD_KEEP_MS = 6 * 60 * 60_000;
/** most days kept in memory (the browser copy in IndexedDB holds the rest, so a big background load does not fill the memory) */
const MAX_MEM_DAYS = 1500;

interface Saved { at: number; rows: unknown[] }
const mem = new Map<string, Saved>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayIso = (): string => iso(new Date());
const recentFrom = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - RECENT_DAYS);
  return iso(d);
};

/** how long the answer for this day may be reused (0 = never) */
function keepMs(day: string): number {
  if (day >= todayIso()) return 0;
  return day >= recentFrom() ? RECENT_KEEP_MS : OLD_KEEP_MS;
}
/** the day is the last part of the key: "scope|id|code|shift|yyyy-mm-dd" */
const dayOf = (key: string): string => key.slice(key.lastIndexOf('|') + 1);

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        resolve(db);
        sweep(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** removes entries that are too old to be used, once per visit */
function sweep(db: IDBDatabase): void {
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const cur = store.openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return;
      const v = c.value as Saved | undefined;
      if (!v || Date.now() - v.at > OLD_KEEP_MS) c.delete();
      c.continue();
    };
  } catch {
    /* cache only */
  }
}

/** Remembered rows per key (only keys that are present and still fresh). */
export async function dayCacheGet(keys: string[]): Promise<Map<string, unknown[]>> {
  const out = new Map<string, unknown[]>();
  const missing: string[] = [];
  const now = Date.now();
  for (const k of keys) {
    const hit = mem.get(k);
    if (hit) {
      if (now - hit.at <= keepMs(dayOf(k))) out.set(k, hit.rows);
    } else missing.push(k);
  }
  if (!missing.length) return out;
  const db = await openDb();
  if (!db) return out;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      for (const k of missing) {
        const r = store.get(k);
        r.onsuccess = () => {
          const v = r.result as Saved | undefined;
          if (v && Array.isArray(v.rows) && now - v.at <= keepMs(dayOf(k))) {
            mem.set(k, v);
            out.set(k, v.rows);
          }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  return out;
}

/** Remember finished days. Today / future days are skipped. */
export function dayCacheSet(entries: Array<[string, unknown[]]>): void {
  const keep = entries.filter(([k]) => keepMs(dayOf(k)) > 0);
  if (!keep.length) return;
  const at = Date.now();
  for (const [k, rows] of keep) mem.set(k, { at, rows });
  while (mem.size > MAX_MEM_DAYS) {
    const oldest = mem.keys().next().value;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
  void openDb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const [k, rows] of keep) store.put({ at, rows } satisfies Saved, k);
    } catch {
      /* e.g. storage full: the report just is not remembered */
    }
  });
}

export function clearChunkCache(): void {
  mem.clear();
  void openDb().then((db) => {
    if (!db) return;
    try {
      db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
    } catch {
      /* ignore */
    }
  });
}
