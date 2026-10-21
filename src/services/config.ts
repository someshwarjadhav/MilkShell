/**
 * One place for every SmartX setting. Nothing here is a secret and no ids are hardcoded:
 * VLC / station / MCC ids come from the login response (see session.ts), with optional .env fallbacks.
 */

export const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export const GATEWAY_PATH = import.meta.env.VITE_GATEWAY_PATH || '/gateway/Interceptor';

export const REPORT_CONFIG_URL = import.meta.env.VITE_REPORT_CONFIG_URL || 'https://stipldrive.ddns.net/home/userReportConfig';

/**
 * Same as Angular's `environment.staticIP = '/gateway/Interceptor?path='`.
 * Every call is `environment.staticIP + '/home/<endpoint>'`.
 */
export const environment = {
  staticIP: `${BASE_URL}${GATEWAY_PATH}?path=`,
};

/** The portal is slow (up to ~45 s on the original site), so every call gets 90 s. */
export const REQUEST_TIMEOUT_MS = 90_000;

/** Browsers allow 6 connections per host; the priority queue in http/client.ts decides who gets them first. */
export const MAX_PARALLEL_REQUESTS = 6;

export const FRESH_FOR_MS = 5 * 60_000;

/** Format of fromdate / todate in POST bodies. yyyy-MM-dd | dd-MM-yyyy | dd/MM/yyyy | dd MMM yyyy */
export const DATE_FORMAT = import.meta.env.VITE_API_DATE_FORMAT || 'yyyy-MM-dd';

/**
 * Optional: the milktype code that means "all milk" if the portal has one.
 * When empty, "all milk" is fetched as three requests (C, B, M) and merged.
 */
export const ALL_MILK_CODE = import.meta.env.VITE_ALL_MILK_CODE || '';

/**
 * Milk codes used when a farmer report asks for "all milk". Default C,B,M = 3 requests per VLC.
 * Optional speed-up: VITE_FARMER_MILK_CODES=Z,M (Z = cow + buffalo in one request, 2 requests per VLC).
 * Check one Collections > Farmer search with it first: if the portal answers "No Record" for Z, remove it again.
 */
export const FARMER_MILK_CODES = (import.meta.env.VITE_FARMER_MILK_CODES || 'C,B,M').split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean);

/** Optional fallbacks, used only when the login response carries no ids. */
export const ENV_VLCC_IDS = import.meta.env.VITE_VLCC_IDS || '';
export const ENV_STATION_ID = import.meta.env.VITE_STATION_ID || '';
export const ENV_MCC_ID = import.meta.env.VITE_MCC_ID || '';

/** Optional: rate chart id sent as `rateid` to /home/FarmerMilkEntry (Farmerwise collection). */
export const ENV_RATE_ID = import.meta.env.VITE_RATE_ID || '';

export const DEV_EMAIL = import.meta.env.DEV ? import.meta.env.VITE_DEV_EMAIL || '' : '';
export const DEV_PASSWORD = import.meta.env.DEV ? import.meta.env.VITE_DEV_PASSWORD || '' : '';
