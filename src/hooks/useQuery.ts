import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { ApiError } from '../services/http/errors';
import { FRESH_FOR_MS } from '../services/config';
import { clearRequestMemo } from '../services/http/client';
import { type Emit, type QueryData } from '../services/http/fanout';
import { getSession } from '../services/session';

export interface QueryState<R> {
  status: 'loading' | 'ready' | 'error';
  rows: R[];
  fetching: boolean;
  stale: boolean;
  failed: number;
  total: number;
  done: number;
  error: ApiError | null;
  updatedAt: number | null;
  note: string | null;
  retry: () => void;
}

type Fetcher<R> = (emit: Emit<R>) => Promise<QueryData<R>>;
interface Entry<R> {
  state: Omit<QueryState<R>, 'retry'>;
  listeners: Set<() => void>;
  fetcher: Fetcher<R>;
  inflight: boolean;
}

const store = new Map<string, Entry<unknown>>();
const PREFIX = 'smartx:';

function readCache<R>(key: string): { at: number; rows: R[]; note?: string } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; rows: R[]; note?: string };
    return Array.isArray(v.rows) ? v : null;
  } catch {
    return null;
  }
}
function writeCache<R>(key: string, rows: R[], note?: string) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), rows, note }));
  } catch {
  }
}

export function clearSmartxCache() {
  store.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
  }
}

const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError('Something went wrong while loading this data.', 'server'));

function notify(e: Entry<unknown>) {
  e.listeners.forEach((l) => l());
}

function run<R>(key: string, entry: Entry<R>, force = false) {
  if (entry.inflight) return;
  if (force) { clearRequestMemo(); }
  entry.inflight = true;
  const prev = entry.state;
  entry.state = { ...prev, fetching: true, error: null, done: 0, total: 0 };
  notify(entry as Entry<unknown>);

  const emit: Emit<R> = (p) => {

    const hasRows = p.rows.length > 0;
    entry.state = {
      ...entry.state,
      ...(hasRows ? { status: 'ready' as const, rows: p.rows, stale: false } : {}),
      failed: p.failed,
      total: p.total,
      done: p.done,
      note: p.note ?? entry.state.note,
    };
    notify(entry as Entry<unknown>);
  };

  Promise.resolve().then(() => entry.fetcher(emit)).then(
    (data) => {
      entry.inflight = false;
      entry.state = { status: 'ready', rows: data.rows, fetching: false, stale: false, failed: data.failed, total: data.total, done: data.done, error: null, updatedAt: Date.now(), note: data.note ?? null };
      if (data.failed === 0) writeCache(key, data.rows, data.note);
      notify(entry as Entry<unknown>);
    },
    (err) => {
      entry.inflight = false;
      const hasRows = entry.state.rows.length > 0;
      entry.state = {
        ...entry.state,
        status: hasRows ? 'ready' : 'error',
        fetching: false,
        stale: hasRows,
        error: toApiError(err),
      };
      notify(entry as Entry<unknown>);
    },
  );
}

function entryFor<R>(key: string, fetcher: Fetcher<R>): Entry<R> {
  let e = store.get(key) as Entry<R> | undefined;
  if (!e) {
    const cached = readCache<R>(key);
    e = {
      state: {
        status: cached ? 'ready' : 'loading',
        rows: cached?.rows ?? [],
        fetching: false,
        stale: !!cached,
        failed: 0,
        total: 0,
        done: 0,
        error: null,
        updatedAt: cached?.at ?? null,
        note: cached?.note ?? null,
      },
      listeners: new Set(),
      fetcher,
      inflight: false,
    };
    store.set(key, e as Entry<unknown>);
  }
  e.fetcher = fetcher;
  return e;
}


export function refetchAll() {
  store.forEach((e, key) => { if (e.listeners.size > 0) run(key, e, true); });
}

const IDLE: QueryState<never> = {
  status: 'loading', rows: [], fetching: false, stale: false, failed: 0, total: 0, done: 0, error: null, updatedAt: null, note: null, retry: () => {},
};


export function useQuery<R>(key: string | null, fetcher: Fetcher<R>): QueryState<R> {
  const scoped = key ? `${getSession()?.scope ?? 'anon'}:${key}` : null;
  const entry = scoped ? entryFor(scoped, fetcher) : null;

  const subscribe = useCallback(
    (cb: () => void) => {
      entry?.listeners.add(cb);
      return () => void entry?.listeners.delete(cb);
    },
    [entry],
  );
  const snapshot = useSyncExternalStore(subscribe, () => entry?.state ?? null);

  useEffect(() => {
    if (!entry || !scoped) return;
    const fresh = entry.state.updatedAt !== null && !entry.state.stale && Date.now() - entry.state.updatedAt < FRESH_FOR_MS;
    if (!fresh) run(scoped, entry);
  }, [entry, scoped]);

  const retry = useCallback(() => {
    if (entry && scoped) run(scoped, entry, true);
  }, [entry, scoped]);

  return snapshot ? { ...snapshot, retry } : (IDLE as QueryState<R>);
}
