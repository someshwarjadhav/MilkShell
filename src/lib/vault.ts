import { decryptPayload, encryptPayload } from './crypto';


export const LOGIN_KEY = 'dhara-login';
export const DATA_KEY = 'dhara-session-data';

const LEGACY_KEYS = ['dhara-user'];

export function vaultSave(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, encryptPayload(value));
  } catch {
  
  }
}

export function vaultLoad<T>(key: string): T | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = decryptPayload(raw);
    return value && typeof value === 'object' ? (value as T) : null;
  } catch {
    if (raw) localStorage.removeItem(key); // tampered or unreadable: drop it
    return null;
  }
}

export function vaultClear(): void {
  for (const k of [LOGIN_KEY, DATA_KEY, ...LEGACY_KEYS]) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

export function vaultDropLegacy(): void {
  for (const k of LEGACY_KEYS) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}
