
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

// OLD: gateway/Interceptor (commented out)
// export const GATEWAY_PATH = import.meta.env.VITE_GATEWAY_PATH || '/gateway/Interceptor';

/** NEW: data APIs now go straight to stipldrive. In local dev you can set VITE_STIPL_BASE_URL=/stipl (see vite proxy). */
export const STIPL_BASE = (import.meta.env.VITE_STIPL_BASE_URL || 'https://stipldrive.ddns.net').replace(/\/+$/, '');

export const REPORT_CONFIG_URL = import.meta.env.VITE_REPORT_CONFIG_URL || 'https://stipldrive.ddns.net/home/userReportConfig';

export const environment = {
  // staticIP: `${BASE_URL}${GATEWAY_PATH}?path=`,
  staticIP: STIPL_BASE,
};

/** The portal is slow (up to ~45 s on the original site), so every call gets 90 s. */
export const REQUEST_TIMEOUT_MS = 90_000;

/** Browsers allow 6 connections per host; the priority queue in http/client.ts decides who gets them first. */
export const MAX_PARALLEL_REQUESTS = 6;

export const FRESH_FOR_MS = 5 * 60_000;

/** Format of fromdate / todate in POST bodies. yyyy-MM-dd | dd-MM-yyyy | dd/MM/yyyy | dd MMM yyyy */
export const DATE_FORMAT = import.meta.env.VITE_API_DATE_FORMAT || 'yyyy-MM-dd';

export const ALL_MILK_CODE = import.meta.env.VITE_ALL_MILK_CODE || '';

export const FARMER_MILK_CODES = (import.meta.env.VITE_FARMER_MILK_CODES || 'C,B,M').split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean);

/** Optional fallbacks, used only when the login response carries no ids. */
export const ENV_VLCC_IDS = import.meta.env.VITE_VLCC_IDS || '';
export const ENV_STATION_ID = import.meta.env.VITE_STATION_ID || '';
export const ENV_MCC_ID = import.meta.env.VITE_MCC_ID || '';

/** Optional: rate chart id sent as `rateid` to /home/FarmerMilkEntry (Farmerwise collection). */
export const ENV_RATE_ID = import.meta.env.VITE_RATE_ID || '';

export const DEV_EMAIL = import.meta.env.DEV ? import.meta.env.VITE_DEV_EMAIL || '' : '';
export const DEV_PASSWORD = import.meta.env.DEV ? import.meta.env.VITE_DEV_PASSWORD || '' : '';