import { directGet } from '../http/client';
import { dpuGet } from '../http/dpu';
import { REPORT_CONFIG_URL } from '../config';
import { isObj, norm, pick, pickValue, rowsFrom, type Obj } from '../utils/loose';
import { REPORT_INDEX } from '../../config/reportAccess';


/**
 * Report column access: DPU `GET /api/Login/UserReportConfig?userid=<id>`.
 * If the DPU call fails the old STIPL report-config URL is used so the columns never disappear.
 */
export const getReportAccess = async (userid: string): Promise<unknown> => {
  try {
    return await dpuGet(`/Login/UserReportConfig?userid=${encodeURIComponent(userid)}`, 0);
  } catch (e) {
    console.warn('[UserReportConfig] DPU call failed, using the old report-config URL:', e instanceof Error ? e.message : e);
    const url = new URL(REPORT_CONFIG_URL);
    url.searchParams.set('userid', userid);
    return directGet(url.toString(), 0);
  }
};


export interface ReportRule { hidden: Set<string>; shown: Set<string>;
   order: Map<string, number> }
export interface ReportConfig {

  rules: Map<string, ReportRule>;
  /** Same as the portal's `report[0]`, `report[1]` ...: one rule per element of the userReportConfig array, in the order the API sent it. */
  byIndex: Map<number, ReportRule>;
}
export const EMPTY_REPORT_CONFIG: ReportConfig = { rules: new Map(), byIndex: new Map() };

const REPORT_KEYS = ['reportname', 'report', 'formname', 'form', 'screen', 'screenname', 'pagename', 'page', 'reporttype', 'menuname'];
const COLUMN_KEYS = ['columnname', 'column', 'colname', 'col', 'fieldname', 'field', 'headername', 'header', 'caption', 'columnheader'];
const FLAG_KEYS = ['isvisible', 'visible', 'isshow', 'show', 'status', 'isactive', 'active', 'enabled', 'isenabled', 'ischecked', 'checked', 'access', 'flag', 'display', 'isdisplay', 'allow', 'isallowed'];

const META_KEYS = new Set(['userid', 'id', 'uid', 'user', 'username', 'reportname', 'report', 'formname', 'form', 'screen', 'pagename', 'reporttype', 'createddate', 'createdon', 'updateddate', 'dtdate', 'maxid']);

const TRUE = new Set(['1', 'true', 'yes', 'y', 'show', 'shown', 'visible', 'active', 'enabled', 'on', 'allow', 'allowed']);
const FALSE = new Set(['0', 'false', 'no', 'n', 'hide', 'hidden', 'invisible', 'inactive', 'disabled', 'off', 'deny', 'denied']);


export function asFlag(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : undefined; 
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (TRUE.has(s)) return true;
    if (FALSE.has(s)) return false;
  }
  return undefined;
}

const ruleOf = (cfg: ReportConfig, report: string) => {
  let r = cfg.rules.get(report);
  if (!r) cfg.rules.set(report, (r = { hidden: new Set(), shown: new Set(), order: new Map() }));
  return r;
};


/** Keys that describe the row itself (not a column flag) when one array element = one report. */
const ROW_META = new Set(['userid', 'uid', 'user', 'username', 'id', 'maxid', 'reportname', 'report', 'formname', 'form', 'screen', 'screenname', 'pagename', 'page', 'reporttype', 'menuname', 'createddate', 'createdon', 'updateddate', 'dtdate']);

/**
 * One element of the userReportConfig array -> one rule.
 * Handles: { Farmerid: 1, Name: 1, Fat: 0 ... }  and  { columns: [{ columnname, isvisible }] }.
 */
export function ruleOfRow(row: Obj): ReportRule {
  const rule: ReportRule = { hidden: new Set(), shown: new Set(), order: new Map() };
  const fields = Object.values(row).find((v) => Array.isArray(v) && v.length > 0 && v.every(isObj)) as Obj[] | undefined;
  if (fields) {
    for (const f of fields) {
      const col = norm(pick(f, COLUMN_KEYS));
      if (!col) continue;
      const flag = asFlag(pickValue(f, FLAG_KEYS));
      if (flag === true) rule.shown.add(col);
      else if (flag === false) rule.hidden.add(col);
      const ord = Number(pickValue(f, ['order', 'sortorder', 'position', 'sequence', 'priority']));
      if (Number.isFinite(ord)) rule.order.set(col, ord);
    }
    return rule;
  }
  const column = pick(row, COLUMN_KEYS);
  const flag = asFlag(pickValue(row, FLAG_KEYS));
  if (column && flag !== undefined) {
    (flag ? rule.shown : rule.hidden).add(norm(column));
    return rule;
  }
  for (const [k, v] of Object.entries(row)) {
    if (ROW_META.has(norm(k)) || isObj(v) || Array.isArray(v)) continue;
    const f = asFlag(v);
    if (f === undefined) continue;
    (f ? rule.shown : rule.hidden).add(norm(k));
  }
  return rule;
}

export function parseReportConfig(json: unknown): ReportConfig {
  const cfg: ReportConfig = { rules: new Map(), byIndex: new Map() };
  const rows = rowsFrom(json);
  rows.forEach((row, i) => cfg.byIndex.set(i, ruleOfRow(row)));
  for (const row of rows) {

    const fields = Object.values(row).find((v) => Array.isArray(v) && v.length > 0 && v.every(isObj)) as Obj[] | undefined;
    if (fields) {
      const rule = ruleOf(cfg, norm(pick(row, REPORT_KEYS)));
      for (const f of fields) {
        const col = norm(pick(f, COLUMN_KEYS));
        if (!col) continue;
        const flag = asFlag(pickValue(f, FLAG_KEYS));
        if (flag === true) rule.shown.add(col);
        else if (flag === false) rule.hidden.add(col);
        const ord = Number(pickValue(f, ['order', 'sortorder', 'position', 'sequence', 'priority']));
        if (Number.isFinite(ord)) rule.order.set(col, ord);
      }
      continue;
    }
    const column = pick(row, COLUMN_KEYS);
    const flag = asFlag(pickValue(row, FLAG_KEYS));
    if (column && flag !== undefined) {
 
      const rule = ruleOf(cfg, norm(pick(row, REPORT_KEYS)));
      (flag ? rule.shown : rule.hidden).add(norm(column));
      continue;
    }
   
    const rule = ruleOf(cfg, norm(pick(row, REPORT_KEYS)));
    for (const [k, v] of Object.entries(row)) {
      if (META_KEYS.has(norm(k)) || norm(k).endsWith('id') || isObj(v) || Array.isArray(v)) continue;
      const f = asFlag(v);
      if (f === undefined) continue;
      (f ? rule.shown : rule.hidden).add(norm(k));
    }
  }
  for (const [name, rule] of [...cfg.rules]) if (rule.hidden.size === 0 && rule.shown.size === 0 && rule.order.size === 0) cfg.rules.delete(name);
  return cfg;
}


/**
 * Which element of the userReportConfig array belongs to which report (0 = first element).
 * Farmer Collection = 0 and VLC Collection = 1 as told by the portal team; the next reports get 2, 3 ...
 * in the order of their report lines. Change a number here if the array order changes.
 */
const reportIndexOf = (hint: string): number | undefined => {
  const h = norm(hint);
  const hit = Object.entries(REPORT_INDEX).find(([k]) => norm(k) === h);
  return hit?.[1];
};

/**
 * Rule(s) of one report. Order of trust:
 *  1. the reply names the report inside the data (reportname / formname ...) -> match by that name
 *  2. otherwise the position in the array (REPORT_INDEX: report[0], report[1] ...)
 *  3. otherwise rules that carry no report name (apply to every report)
 */
function rulesFor(cfg: ReportConfig, reportHint: string): ReportRule[] {
  const hint = norm(reportHint);
  const named = [...cfg.rules].filter(([report]) => report && (hint.includes(report) || report.includes(hint))).map(([, r]) => r);
  if (named.length) return named;
  const idx = reportIndexOf(reportHint);
  if (idx !== undefined && cfg.byIndex.has(idx)) return [cfg.byIndex.get(idx)!];
  return [...cfg.rules].filter(([report]) => !report).map(([, r]) => r);
}

export function columnVisible(cfg: ReportConfig, reportHint: string, names: string[]): boolean {
  const wanted = names.map(norm);
  const rules = rulesFor(cfg, reportHint);
  if (rules.some((r) => wanted.some((w) => r.hidden.has(w)))) return false;
  return true;
}

export function columnOrder(cfg: ReportConfig, reportHint: string, names: string[]): number | undefined {
  const wanted = names.map(norm);
  for (const rule of rulesFor(cfg, reportHint)) {
    for (const w of wanted) if (rule.order.has(w)) return rule.order.get(w);
  }
  return undefined;
}
