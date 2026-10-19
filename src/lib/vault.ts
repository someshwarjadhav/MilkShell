import { decryptPayload, encryptPayload } from './crypto';

/**
 * Encrypted localStorage.
 * Nothing about the session (login record, centres, menu, report access) is saved as readable JSON:
 * it is saved as "ciphertext:iv" (AES-CBC, same helper as the login call). Every page decrypts it when it opens
 * (see restoreSession in services/bootstrap.ts), so the readable copy only ever lives in memory.
 */
export const LOGIN_KEY = 'dhara-login';
export const DATA_KEY = 'dhara-session-data';
/** Older builds saved the user as readable JSON. It is removed on start so no readable copy stays behind. */
const LEGACY_KEYS = ['dhara-user'];

export function vaultSave(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, encryptPayload(value));
  } catch {
    /* storage blocked or key missing: the session simply lives for this visit */
  }
}

/** Returns null when nothing is stored, or when the stored text cannot be decrypted (edited by hand / wrong key). */
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
