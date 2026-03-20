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

// Demo mode: bypass auth and use a mock admin user
const DEMO_MODE = false;

const DEMO_USER: AuthUser = {
  id: 'demo-admin-001',
  email: 'admin@regain.local',
  name: 'Dr. Sarah Chen',
  role: 'admin',
  image: null,
};

const DEMO_VALUE: AuthContextValue = {
  user: DEMO_USER,
  isLoading: false,
  isAuthenticated: true,
  isAdmin: true,
  isCompliance: false,
  canAccessDashboard: true,
  canAccessCompliance: true,
  login: async () => ({ success: true }),
  logout: async () => {},
  refresh: async () => {},
};

function RealAuthProvider({ children }: { children: ReactNode }) {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  if (DEMO_MODE) {
    return <AuthContext.Provider value={DEMO_VALUE}>{children}</AuthContext.Provider>;
  }
  return <RealAuthProvider>{children}</RealAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
