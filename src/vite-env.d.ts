/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_LOGIN_PATH: string;
  readonly VITE_ENCRYPTION_KEY: string;
  readonly VITE_GATEWAY_PATH?: string;
  readonly VITE_REPORT_CONFIG_URL?: string;
  readonly VITE_API_DATE_FORMAT?: string;
  readonly VITE_ALL_MILK_CODE?: string;
  readonly VITE_VLCC_IDS?: string;
  readonly VITE_STATION_ID?: string;
  readonly VITE_CENTER_ID_FIELD?: string;
  readonly VITE_MENU_ONLY?: string;
  readonly VITE_MCC_ID?: string;
  readonly VITE_PORTAL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
