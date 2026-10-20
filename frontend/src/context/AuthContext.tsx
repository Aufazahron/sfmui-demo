import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { apiFetch, clearTokens, getAccessToken, onSessionExpired, setTokens } from '@/services/api';
import type { AuthUser, UserRole } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch('/api/auth/me') as { user: AuthUser | null };
      setUser(data.user);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    return onSessionExpired(() => {
      setUser(null);
      toast.error('Session expired. Please log in again.');
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }) as { user: AuthUser; accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken: localStorage.getItem('sfm_refresh_token') },
      });
    } catch {
      /* still clear local session */
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login,
    logout,
    setUser,
    isSuperAdmin: user?.role === 'super_admin',
  }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function hasRole(user: AuthUser | null, ...roles: UserRole[]) {
  return !!user && roles.includes(user.role);
}
