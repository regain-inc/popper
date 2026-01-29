'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Header } from './header';
import { Sidebar } from './sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, isLoading, isCompliance, canAccessDashboard } = useAuth();
  const router = useRouter();
  // Add a small delay before redirecting to login to allow session to load
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // Wait a bit before allowing redirect to login (session might still be loading)
    const timer = setTimeout(() => {
      setShouldRedirect(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only redirect to login after the delay and when we're sure auth has loaded
    if (shouldRedirect && !isLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!isLoading && isAuthenticated && isCompliance && !canAccessDashboard) {
      // Compliance-only users should be redirected to compliance dashboard immediately
      router.push('/compliance');
    }
  }, [isLoading, isAuthenticated, isCompliance, canAccessDashboard, router, shouldRedirect]);

  // Show loading while auth is being determined
  if (isLoading || !shouldRedirect || (!isLoading && isCompliance && !canAccessDashboard)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  // If not authenticated after loading, show nothing (redirect will happen)
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
