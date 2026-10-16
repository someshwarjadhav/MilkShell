import type * as React from 'react';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError, loginApi } from '../lib/api';

export interface User {
  name: string;
  email: string;
  role: string;
  
  token?: string;
}

export type LoginResult = { ok: true } | { ok: false; message: string };

interface AuthCtx {
  user: User | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  createAccount: (name: string, email: string) => boolean;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = 'dhara-user';

function saveUser(user: User) {
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      login: async (username, password) => {
        try {
          const profile = await loginApi(username.trim(), password);
          setUser(saveUser(profile));
          return { ok: true };
        } catch (error) {
          const message = error instanceof ApiError ? error.message : 'Something went wrong while signing in. Please try again.';
          return { ok: false, message };
        }
      },
      createAccount: (name, email) => {
        const cleanName = name.trim();
        const cleanEmail = email.trim();
        if (cleanName.length < 2 || !cleanEmail.includes('@')) return false;

        setUser(saveUser({ name: cleanName, email: cleanEmail, role: 'Dairy administrator' }));
        return true;
      },
      logout: () => {
        localStorage.removeItem(KEY);
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
