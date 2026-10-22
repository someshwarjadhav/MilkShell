import type * as React from 'react';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../services/http/errors';
import { loginApi } from '../services/auth/auth.api';
import { applySession, clearSessionData, loadSessionData, restoreSession, saveLogin } from '../services/bootstrap';
import { vaultDropLegacy } from '../lib/vault';
import { setSession } from '../services/session';
import { clearSmartxCache } from '../hooks/useQuery';

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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    vaultDropLegacy();
    return restoreSession();
  });

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      login: async (username, password) => {
        try {
         
          const { profile, record } = await loginApi(username.trim(), password);
          saveLogin(username.trim(), record);
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
      logout: () => {
        clearSessionData();
        setSession(null);
        clearSmartxCache();
        setUser(null);
      },
    }),
    [user],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useAuth() {
  const context = useContext(Ctx);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
