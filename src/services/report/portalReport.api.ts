import { directGet, gatewayGet } from '../http/client';
import { ApiError } from '../http/errors';
import { fanOut, needSession, waves, type Emit, type QueryData } from '../http/fanout';
import { BASE_URL } from '../config';
import type { ShiftCode } from '../types/raw';
import { apiDate } from '../utils/date';

export const CLEANING_REPORT_PATH = import.meta.env.VITE_CLEANING_REPORT_PATH || '/dairy/dairy/cleaningReport';
export const EKO_CALIBRATION_PATH = import.meta.env.VITE_EKO_CALIBRATION_PATH || '/dairy/dairy/getekocleaningdata';

const ALTERNATES: Record<string, string[]> = {};

export type PortalRow = Record<string, unknown>;

export interface PortalReportParams {
  from: string;
  to: string;
  shift?: ShiftCode;
  vlccIds: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const WRAP_KEYS = ['Data', 'data', 'Result', 'result', 'Table', 'table', 'Rows', 'rows', 'Report', 'report', 'Records', 'records'];


function collect(v: unknown, label: string | null, out: PortalRow[]): void {
  if (v === null || v === undefined || typeof v !== 'object') return;
  if (Array.isArray(v)) {
    for (const item of v) {
      if (isObj(item)) {
        const hasNested = Object.values(item).some((x) => Array.isArray(x) && x.some(isObj));
        if (hasNested) collect(item, label, out);
        else out.push(label && item.date === undefined && item.Date === undefined ? { Date: label, ...item } : item);
      } else if (Array.isArray(item)) collect(item, label, out);
    }
    return;
  }
  const o = v as Record<string, unknown>;
  const nested = Object.entries(o).filter(([, x]) => x !== null && typeof x === 'object');
  const scalars = Object.entries(o).filter(([, x]) => x === null || typeof x !== 'object');
  if (nested.length === 0) {
    if (scalars.length) out.push(label ? { Date: label, ...o } : o);
    return;
  }
  const wrapped = nested.filter(([k]) => WRAP_KEYS.includes(k));
  for (const [k, x] of wrapped.length ? wrapped : nested) {
    const isWrap = WRAP_KEYS.includes(k);
    if (isObj(x) && !isWrap && Object.values(x).every((y) => y === null || typeof y !== 'object')) out.push({ Date: k, ...x });
    else collect(x, isWrap ? label : k, out);
  }
}

function rowsOf(json: unknown): PortalRow[] {
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    const msg = String(json.Message ?? json.message ?? '').trim();
    if (ok === false) {
      if (/no\s*record|not\s*found|no\s*data/i.test(msg)) return [];
      throw new ApiError(msg || 'The server reported a failure.', 'server');
    }
  }
  const out: PortalRow[] = [];
  collect(json, null, out);
  return out;
}


const query = (path: string, id: string, from: string, to: string) =>
  /getekocleaningdata/i.test(path)
    ? `${path}?vlccid=${encodeURIComponent(id)}`
    : `${path}?stationid=${encodeURIComponent(id)}&fromdate=${encodeURIComponent(apiDate(from))}&todate=${encodeURIComponent(apiDate(to))}`;


async function ask(path: string, id: string, from: string, to: string): Promise<PortalRow[]> {
  const q = query(path, id, from, to);
  try {
    return rowsOf(await gatewayGet(q, 1));
  } catch (first) {
    if (first instanceof ApiError && first.kind === 'auth') throw first;
    try {

      const base = BASE_URL || 'https://smartx.shivinfotech.co.in';
      return rowsOf(await directGet(`${base}/gateway/Interceptor?path=${q}`, 1));
    } catch {
      throw first;
    }
  }
}

const workingPath = new Map<string, string>();

async function fetchOne(endpoint: string, id: string, from: string, to: string): Promise<PortalRow[]> {
  const known = workingPath.get(endpoint);
  if (known) return ask(known, id, from, to);
  const candidates = [endpoint, ...(ALTERNATES[endpoint] ?? [])];
  let firstError: unknown;
  for (const path of candidates) {
    try {
      const rows = await ask(path, id, from, to);
      workingPath.set(endpoint, path);
      return rows;
    } catch (e) {
      firstError ??= e;
    }
  }
  throw firstError;
}

export function fetchPortalReport(endpoint: string, p: PortalReportParams, emit?: Emit<PortalRow>): Promise<QueryData<PortalRow>> {
  needSession();
  const jobs = waves<PortalRow>(p.vlccIds, (id) => [
    async () => {
      const rows = await fetchOne(endpoint, id, p.from, p.to);
      
      return rows.map((r) => (r.vlccid === undefined || r.vlccid === null || r.vlccid === '' ? { ...r, vlccid: id } : r));
    },
  ]);
  return fanOut<PortalRow>(jobs, emit, true);
}
