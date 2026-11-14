/**
 * Every Excel download is named "<name>_<DD-MM-YYYY>.xlsx": the name of the report / master plus the date of the download.
 * A name that already carries a date (a report for 2026-10-11 to 2026-10-20, 11-10-2026 ...) is left as it is,
 * so the report's own date range is never replaced by today's date.
 * (Same rule as the SmartX portal.)
 */
const DATE_IN_NAME = /\d{4}[-_.]\d{1,2}[-_.]\d{1,2}|\d{1,2}[-_.\/]\d{1,2}[-_.\/]\d{2,4}|\d{8}/;

export const todayStamp = (d: Date = new Date()): string =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

/** the name is used exactly as given (no date added), e.g. "farmercollection" -> "farmercollection.xlsx" */
export const exactExcelFileName = (name: string): string =>
  `${name.replace(/\.xlsx?$/i, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Export'}.xlsx`;

/** `name` with or without ".xlsx"; always returns "<name with date>.xlsx" */
export const excelFileName = (name: string): string => {
  const base = name.replace(/\.xlsx?$/i, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Export';
  return `${DATE_IN_NAME.test(base) ? base : `${base}_${todayStamp()}`}.xlsx`;
};
