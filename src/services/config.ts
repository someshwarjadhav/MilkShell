
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');


export const STIPL_BASE = (import.meta.env.VITE_STIPL_BASE_URL || 'https://stipldrive.ddns.net').replace(/\/+$/, '');

export const REPORT_CONFIG_URL = import.meta.env.VITE_REPORT_CONFIG_URL || 'https://stipldrive.ddns.net/home/userReportConfig';

export const environment = {
  staticIP: STIPL_BASE,
};


export const REQUEST_TIMEOUT_MS = 90_000;


export const MAX_PARALLEL_REQUESTS = 6;

export const FRESH_FOR_MS = 5 * 60_000;


export const DATE_FORMAT = import.meta.env.VITE_API_DATE_FORMAT || 'yyyy-MM-dd';

export const ALL_MILK_CODE = import.meta.env.VITE_ALL_MILK_CODE || '';

export const FARMER_MILK_CODES = (import.meta.env.VITE_FARMER_MILK_CODES || 'C,B,M').split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean);


export const ENV_VLCC_IDS = import.meta.env.VITE_VLCC_IDS || '';
export const ENV_STATION_ID = import.meta.env.VITE_STATION_ID || '';
export const ENV_MCC_ID = import.meta.env.VITE_MCC_ID || '';


export const ENV_RATE_ID = import.meta.env.VITE_RATE_ID || '';

export const DEV_EMAIL = import.meta.env.DEV ? import.meta.env.VITE_DEV_EMAIL || '' : '';
export const DEV_PASSWORD = import.meta.env.DEV ? import.meta.env.VITE_DEV_PASSWORD || '' : '';

export const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL || 'https://smartx.shivinfotech.co.in/prodigy/#').replace(/\/+$/, '');
