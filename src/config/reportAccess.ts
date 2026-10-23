
export const REPORT_FARMER = '/collections';
export const REPORT_FARMERWISE = '/reports/farmerwise';
export const REPORT_VLCC = '/reports/vlcc';
export const REPORT_VLC_STATUS = '/reports/vlc-status';
export const REPORT_VARIANCE = '/reports/variance';
export const REPORT_CLEANING = '/reports/cleaning';
export const REPORT_EKO = '/reports/eko-calibration';
export const REPORT_UNIONWISE = '/reports/unionwise';

export const PAGE_VLC_MILK_ENTRY = '/transactions/vlc-milk-entry';

export const PAGE_MOBILE_SETTINGS = '/settings/mobile-app';
export const EXCLUSIVE_PAGES: string[] = [PAGE_VLC_MILK_ENTRY, PAGE_MOBILE_SETTINGS];
export const ENTRY_USERS: string[] = ['abc@gmail.com'];

export const EXCLUSIVE_REPORTS: string[] = [REPORT_FARMERWISE, REPORT_VLCC, REPORT_CLEANING, REPORT_EKO];


export const ALL_REPORTS: string[] = [REPORT_FARMER, REPORT_UNIONWISE, REPORT_VLC_STATUS, REPORT_VARIANCE, ...EXCLUSIVE_REPORTS];


export const REPORT_LABELS: Record<string, { label: string; hint: string }> = {
  [REPORT_FARMER]: { label: 'Farmer Collection', hint: 'Every farmer sample at a centre' },
  [REPORT_FARMERWISE]: { label: 'Farmerwise Collection', hint: 'Farmer by farmer totals of the milk poured' },
  [REPORT_VLCC]: { label: 'Vlcc Collection', hint: 'Milk collected per VLC centre' },
  [REPORT_VLC_STATUS]: { label: 'VLC Status', hint: 'Which centres are active or in active' },
  [REPORT_VARIANCE]: { label: 'Variance Report', hint: 'DOC collection against VLC collection, with the difference' },
  [REPORT_CLEANING]: { label: 'Cleaning Report', hint: 'Cleaning done at each centre' },
  [REPORT_EKO]: { label: 'Eko Calibration', hint: 'Eko analyser calibration records' },
  [REPORT_UNIONWISE]: { label: 'Unionwise Collection', hint: 'Litres, fat, SNF and amount per union and society' },
};


export const REPORTS_BY_USER: Record<string, string[]> = {

  'abc@gmail.com': [REPORT_FARMER, REPORT_FARMERWISE, REPORT_VLCC, REPORT_VLC_STATUS, REPORT_VARIANCE, REPORT_CLEANING, REPORT_EKO],

  'prachidairykaladera@gmail.com': [REPORT_FARMER, REPORT_FARMERWISE, REPORT_VLCC, REPORT_UNIONWISE, REPORT_VLC_STATUS, REPORT_VARIANCE],
};

export const reportsFor = (email?: string | null): string[] | null =>
  (email ? REPORTS_BY_USER[email.trim().toLowerCase()] : undefined) ?? null;


export function canOpenReport(email: string | null | undefined, route: string): boolean {
  if (EXCLUSIVE_PAGES.includes(route)) return !!email && ENTRY_USERS.includes(email.trim().toLowerCase());
  const own = reportsFor(email);
  if (own) return !ALL_REPORTS.includes(route) || own.includes(route);
  return !EXCLUSIVE_REPORTS.includes(route);
}
