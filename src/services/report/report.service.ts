import { gatewayGet } from '../http/client';
import { isObj, norm, pick, pickValue, rowsFrom, type Obj } from '../utils/loose';

/**
 * Angular:
 *   getReportAccess(userid) { return this.http.get<any>('' + environment.staticIP + '/home/userReportConfig?userid=' + userid + ''); }
 * It says which report columns this user may see (one customer sees 10 columns, another 9: the one who does not want a
 * column simply has it switched off here, no code change).
 */
export const getReportAccess = (userid: string): Promise<unknown> => gatewayGet(`/home/userReportConfig?userid=${encodeURIComponent(userid)}`, 0);

/** hidden: normalised column names switched OFF.  shown: normalised column names switched ON. */
export interface ReportRule { hidden: Set<string>; shown: Set<string>; /** column -> position the portal wants it in */ order: Map<string, number> }
export interface ReportConfig {
  /** normalised report name ('' = the reply names no report, the rule is for every report) -> rule */
  rules: Map<string, ReportRule>;
}
export const EMPTY_REPORT_CONFIG: ReportConfig = { rules: new Map() };

const REPORT_KEYS = ['reportname', 'report', 'formname', 'form', 'screen', 'screenname', 'pagename', 'page', 'reporttype', 'menuname'];
const COLUMN_KEYS = ['columnname', 'column', 'colname', 'col', 'fieldname', 'field', 'headername', 'header', 'caption', 'columnheader'];
const FLAG_KEYS = ['isvisible', 'visible', 'isshow', 'show', 'status', 'isactive', 'active', 'enabled', 'isenabled', 'ischecked', 'checked', 'access', 'flag', 'display', 'isdisplay', 'allow', 'isallowed'];
/** Keys that are about the user / record, not about a column (shape B ignores them). */
const META_KEYS = new Set(['userid', 'id', 'uid', 'user', 'username', 'reportname', 'report', 'formname', 'form', 'screen', 'pagename', 'reporttype', 'createddate', 'createdon', 'updateddate', 'dtdate', 'maxid']);

const TRUE = new Set(['1', 'true', 'yes', 'y', 'show', 'shown', 'visible', 'active', 'enabled', 'on', 'allow', 'allowed']);
const FALSE = new Set(['0', 'false', 'no', 'n', 'hide', 'hidden', 'invisible', 'inactive', 'disabled', 'off', 'deny', 'denied']);

/** true / false when `v` is clearly a switch, undefined when it is anything else. */
export function asFlag(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : undefined; // an id like 4 is not a switch
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

/**
 * getReportAccess reply -> rules. Two shapes are understood:
 *  A) one row per column:  { reportname, columnname, isvisible }
 *  B) one record with a switch per column:  { userid, fat: 1, snf: 1, water: 0, ... }
 * A column the reply says nothing about stays visible, so a reply in an unknown shape never hides data.
 */
export function parseReportConfig(json: unknown): ReportConfig {
  const cfg: ReportConfig = { rules: new Map() };
  const rows = rowsFrom(json);
  for (const row of rows) {
    // shape D: { ReportId, Report: 'Farmer Collection', fields: [{ column, visible, order }] }  (a report without `fields` has no rule)
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
      // shape A
      const rule = ruleOf(cfg, norm(pick(row, REPORT_KEYS)));
      (flag ? rule.shown : rule.hidden).add(norm(column));
      continue;
    }
    // shape B
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
 * Is this column visible for `reportHint` (e.g. 'farmercollection')?
 * `names` = every name the portal might use for the column (\"farmerid\", \"farmercode\" ...), compared normalised.
 * A rule that names a report only counts for a report whose name contains it / is contained in it; a rule that names
 * no report counts for all. No matching rule: visible.
 */
export function columnVisible(cfg: ReportConfig, reportHint: string, names: string[]): boolean {
  const hint = norm(reportHint);
  const wanted = names.map(norm);
  const rules = [...cfg.rules].filter(([report]) => !report || hint.includes(report) || report.includes(hint)).map(([, r]) => r);
  const named = [...cfg.rules.keys()].some((k) => k);
  // Rules exist but none is for this report: ignore the config instead of guessing.
  if (named && rules.length === 0) return true;
  if (rules.some((r) => wanted.some((w) => r.hidden.has(w)))) return false;
  return true;
}


/**
 * Position the portal wants this column in (the `order` of getReportAccess), or undefined when the reply gives none.
 * Columns without a position stay after the ones that have one.
 */
export function columnOrder(cfg: ReportConfig, reportHint: string, names: string[]): number | undefined {
  const hint = norm(reportHint);
  const wanted = names.map(norm);
  for (const [report, rule] of cfg.rules) {
    if (report && !(hint.includes(report) || report.includes(hint))) continue;
    for (const w of wanted) if (rule.order.has(w)) return rule.order.get(w);
  }
  return undefined;
}
