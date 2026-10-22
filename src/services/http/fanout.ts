import { ALL_MILK_CODE, FARMER_MILK_CODES } from '../config';
import { getSession } from '../session';
import type { MilkCode, ShiftCode } from '../types/raw';
import { apiDate } from '../utils/date';
import { gatewayPost, listOf, type Priority } from './client';
import { ApiError } from './errors';

export interface QueryData<T> {
  rows: T[];
  failed: number;
  total: number;
 
  done: number;
 
  note?: string;
}
export type Emit<T> = (partial: QueryData<T>) => void;
export type Job<T> = () => Promise<T[]>;

export interface CollectionParams {
  from: string; 
  to: string;
  shift: ShiftCode;
  milk: MilkCode | 'ALL';
  vlccIds: string[];
 
  priority?: Priority;
}

export const needSession = () => {
  const s = getSession();
  if (!s || s.vlccIds.length === 0) {
    throw new ApiError(
      'No VLC id found. Put VITE_VLCC_IDS=7090809,7090810,7090812 on its own line in .env.local, then stop and restart `npm run dev` (Ctrl+C). Or sign out and sign in again.',
      'config',
    );
  }
  return s;
};

export async function fanOut<T>(waveList: Array<Array<Job<T>>>, emit: Emit<T> | undefined, dedupe: boolean): Promise<QueryData<T>> {
  const rows: T[] = [];
  const seen = new Map<string, number>();
  let failed = 0;
  let done = 0;
  let firstError: unknown;
  let index = 0;
  const total = waveList.reduce((n, w) => n + w.length, 0);
  for (const wave of waveList) {
    await Promise.all(
      wave.map(async (job) => {
        const me = index++;
        try {
          const got = await job();
          for (const r of got) {
            if (dedupe) {
              
              const sig = JSON.stringify(r);
              const owner = seen.get(sig);
              if (owner !== undefined && owner !== me) continue;
              seen.set(sig, me);
            }
            rows.push(r);
          }
        } catch (e) {
          failed++;
          firstError ??= e;
        }
        done++;
        emit?.({ rows: [...rows], failed, total, done });
      }),
    );
  }
  if (failed === total && firstError) throw firstError;
  return { rows, failed, total, done };
}


export function waves<T>(ids: string[], jobsFor: (id: string) => Array<Job<T>>): Array<Array<Job<T>>> {
  return [ids.flatMap(jobsFor)];
}

const milkCodes = (m: MilkCode | 'ALL'): MilkCode[] =>
  m !== 'ALL' ? [m] : ALL_MILK_CODE ? ([ALL_MILK_CODE] as MilkCode[]) : (FARMER_MILK_CODES as MilkCode[]);


export function collectionWaves<T>(endpoint: string, p: CollectionParams, extra: Record<string, string> = {}) {
  const s = needSession();
  return waves<T>(p.vlccIds, (id) =>
    milkCodes(p.milk).map((code) => async () =>
      listOf<T>(
        await gatewayPost(endpoint, {
          id,
          shift: p.shift,
          milktype: code,
          fromdate: apiDate(p.from),
          todate: apiDate(p.to),
    
          ...(s.stationId ? { stationid: s.stationId } : {}),
          ...(s.mccId ? { mccid: s.mccId } : {}),
          ...extra,
        }, p.priority ?? 1),
      ),
    ),
  );
}


export function joinedWaves<T>(endpoint: string, p: CollectionParams): Array<Array<Job<T>>> {
  const s = needSession();
  const ids = p.vlccIds.join(',');
  const codes = p.milk === 'ALL' ? ['Z', 'M'] : [p.milk];
  return [
    codes.map((code) => async () =>
      listOf<T>(
        await gatewayPost(endpoint, {
          id: ids,
          shift: p.shift,
          milktype: code,
          fromdate: apiDate(p.from),
          todate: apiDate(p.to),
          stationid: s.stationId || ids,
          ...(s.mccId ? { mccid: s.mccId } : {}),
        }, p.priority ?? 1),
      ),
    ),
  ];
}

const rowVlcc = (r: unknown) => String((r as Record<string, unknown>)?.vlccid ?? '').trim();
let joinedUnsupported = false;

export async function adaptiveCollection<T>(endpoint: string, p: CollectionParams, emit?: Emit<T>): Promise<QueryData<T>> {
  if (p.vlccIds.length > 1 && !joinedUnsupported) {
    try {
      const joined = await fanOut<T>(joinedWaves<T>(endpoint, p), emit, true);
      const centres = new Set(joined.rows.map(rowVlcc).filter(Boolean));
      const looksComplete = joined.failed === 0 && (joined.rows.length === 0 || centres.size > 1);
      if (looksComplete) return joined;
      if (joined.failed > 0) joinedUnsupported = true; 
    } catch {
      joinedUnsupported = true;
    }
  }
  return fanOut<T>(collectionWaves<T>(endpoint, p), emit, true);
}
