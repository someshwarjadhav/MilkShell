import { directGet } from '../http/client';
import { REPORT_CONFIG_URL } from '../config';
import { isObj, norm, pick, pickValue, rowsFrom, type Obj } from '../utils/loose';


export const getReportAccess = (userid: string): Promise<unknown> => {
  const url = new URL(REPORT_CONFIG_URL);
  url.searchParams.set('userid', userid);
  return directGet(url.toString(), 0);
};


export interface ReportRule { hidden: Set<string>; shown: Set<string>;
   order: Map<string, number> }
export interface ReportConfig {

  rules: Map<string, ReportRule>;
}
export const EMPTY_REPORT_CONFIG: ReportConfig = { rules: new Map() };

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


export function parseReportConfig(json: unknown): ReportConfig {
  const cfg: ReportConfig = { rules: new Map() };
  const rows = rowsFrom(json);
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


export function columnVisible(cfg: ReportConfig, reportHint: string, names: string[]): boolean {
  const hint = norm(reportHint);
  const wanted = names.map(norm);
  const rules = [...cfg.rules].filter(([report]) => !report || hint.includes(report) || report.includes(hint)).map(([, r]) => r);
  const named = [...cfg.rules.keys()].some((k) => k);
  
  if (named && rules.length === 0) return true;
  if (rules.some((r) => wanted.some((w) => r.hidden.has(w)))) return false;
  return true;
}



export function columnOrder(cfg: ReportConfig, reportHint: string, names: string[]): number | undefined {
  const hint = norm(reportHint);
  const wanted = names.map(norm);
  for (const [report, rule] of cfg.rules) {
    if (report && !(hint.includes(report) || report.includes(hint))) continue;
    for (const w of wanted) if (rule.order.has(w)) return rule.order.get(w);
  }
  return undefined;
}
