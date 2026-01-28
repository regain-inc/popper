'use client';

import { createContext, type ReactNode, useCallback, useContext } from 'react';
import { authClient } from '@/lib/auth-client';

export type UserRole = 'admin' | 'viewer' | 'compliance';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  image?: string | null;
}

// Role-based access helpers
export function canAccessDashboard(role: UserRole): boolean {
  return role === 'admin' || role === 'viewer';
}

export function canAccessCompliance(role: UserRole): boolean {
  return role === 'compliance' || role === 'admin';
}

export function canModifySafeMode(role: UserRole): boolean {
  return role === 'admin';
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCompliance: boolean;
  canAccessDashboard: boolean;
  canAccessCompliance: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, refetch } = authClient.useSession();

  const user: AuthUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: (session.user.role as UserRole) || 'viewer',
        image: session.user.image,
      }
    : null;

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result.error) {
          return { success: false, error: result.error.message || 'Login failed' };
        }

        // Refresh session data after login
        await refetch();
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        return { success: false, error: message };
      }
    },
    [refetch],
  );

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      window.location.href = '/login';
    }
  }, []);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const userRole = user?.role || 'viewer';

  const value: AuthContextValue = {
    user,
    isLoading: isPending,
    isAuthenticated: !!user,
    isAdmin: userRole === 'admin',
    isCompliance: userRole === 'compliance',
    canAccessDashboard: canAccessDashboard(userRole),
    canAccessCompliance: canAccessCompliance(userRole),
    login,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
