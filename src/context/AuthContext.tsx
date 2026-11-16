import type * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../services/http/errors';
import { loginApi } from '../services/auth/auth.api';
import { applySession, clearSessionData, loadSessionData, restoreSession, saveLogin } from '../services/bootstrap';
import { vaultDropLegacy } from '../lib/vault';
import { setSession } from '../services/session';
import { clearSmartxCache } from '../hooks/useQuery';
import { useToast } from './ToastContext';

export interface User {
  name: string;
  email: string;
  role: string;
  dairyName?: string;
  token?: string;
  vlccIds?: string[];
  vlccNames?: Record<string, string>;
  stationId?: string;
  plantId?: string;
  mccId?: string;
  userId?: string;
  centerStationId?: string;
}

export type LoginResult = { ok: true } | { ok: false; message: string };

interface AuthCtx {
  user: User | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);


const envMin = Number(import.meta.env.VITE_IDLE_TIMEOUT_MIN);
const IDLE_LIMIT_MS = (Number.isFinite(envMin) && envMin > 0 ? envMin : 20) * 60 * 1000;
const IDLE_CHECK_MS = 10 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;
const ACTIVITY_KEY = 'dhara-last-activity';
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove', 'mousedown', 'click', 'keydown', 'wheel', 'scroll', 'touchstart', 'touchmove', 'pointerdown',
];
const readLastActivity = (): number => {
  try {
    const v = Number(sessionStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
};
const writeLastActivity = (t: number): void => {
  try { sessionStorage.setItem(ACTIVITY_KEY, String(t)); } catch { /* storage unavailable */ }
};
const clearLastActivity = (): void => {
  try { sessionStorage.removeItem(ACTIVITY_KEY); } catch { /* storage unavailable */ }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    vaultDropLegacy();
    return restoreSession();
  });
  const toast = useToast();

  const logout = useCallback(() => {
    clearLastActivity();
    clearSessionData();
    setSession(null);
    clearSmartxCache();
    setUser(null);
  }, []);

  const lastActivityRef = useRef<number>(Date.now());
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const loggedIn = !!user;

  useEffect(() => {
    if (!loggedIn) return;

    const idleLogout = () => {
      logout();
      toastRef.current('Aap 20 minute se inactive the, isliye security ke liye logout kar diya gaya. Dobara login karein.', 'warn');
    };

    
    const stored = readLastActivity();
    if (stored && Date.now() - stored >= IDLE_LIMIT_MS) {
      idleLogout();
      return;
    }
    lastActivityRef.current = stored || Date.now();
    if (!stored) writeLastActivity(lastActivityRef.current);

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      writeLastActivity(now);
    };
    const checkIdle = () => {
      const last = Math.max(lastActivityRef.current, readLastActivity());
      if (Date.now() - last >= IDLE_LIMIT_MS) idleLogout();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkIdle();
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }));
    window.addEventListener('focus', checkIdle);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(checkIdle, IDLE_CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true }));
      window.removeEventListener('focus', checkIdle);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [loggedIn, logout]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      login: async (username, password) => {
        try {
         
          const { profile, record } = await loginApi(username.trim(), password);
          saveLogin(username.trim(), record);
          writeLastActivity(Date.now());
          if (import.meta.env.DEV) console.info('[static-login] paste this into STATIC_LOGIN_RECORD:', JSON.stringify(record));

          setSession(profile);
          await loadSessionData(profile);
          applySession(profile);
          setUser(profile);
          return { ok: true };
        } catch (error) {
          clearSessionData();
          setSession(null);
          const message = error instanceof ApiError ? error.message : 'Something went wrong while signing in. Please try again.';
          return { ok: false, message };
        }
      },
      logout,
    }),
    [user, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useAuth() {
  const context = useContext(Ctx);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}