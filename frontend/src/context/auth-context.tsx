"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearSession, getStoredUser, getToken, saveSession } from "@/lib/session";
import type { LoginResponse, SessionUser } from "@/lib/types";

interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  // false tant que le localStorage n'a pas été relu (évite un flash de redirection vers /login).
  ready: boolean;
  startSession: (res: LoginResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getToken();
    const u = getStoredUser();
    if (t && u) {
      setToken(t);
      setUser(u);
    }
    setReady(true);
  }, []);

  const startSession = useCallback((res: LoginResponse) => {
    saveSession(res.access_token, res.user);
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, ready, startSession, logout }),
    [user, token, ready, startSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
