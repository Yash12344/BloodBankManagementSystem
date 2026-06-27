"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  branchId: string;
  role: string;
  permissions: string[];
}

type LoginResponse =
  | { mfaRequired: true; challengeId: string }
  | { mfaRequired: false; user: SessionUser };

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  verifyOtp: (challengeId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** True if the user has `module.action` (honouring wildcards). */
  can: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function hasPermission(perms: string[], module: string, action: string): boolean {
  return (
    perms.includes(`${module}.${action}`) ||
    perms.includes(`${module}.*`) ||
    perms.includes(`*.${action}`) ||
    perms.includes("*.*")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate the session on mount from the auth cookie.
  useEffect(() => {
    api<{ user: SessionUser }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.mfaRequired) setUser(res.user);
    return res;
  }, []);

  const verifyOtp = useCallback(async (challengeId: string, code: string) => {
    const res = await api<{ user: SessionUser }>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId, code }),
    });
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const can = useCallback(
    (module: string, action: string) => (user ? hasPermission(user.permissions, module, action) : false),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, verifyOtp, logout, can }),
    [user, loading, login, verifyOtp, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
