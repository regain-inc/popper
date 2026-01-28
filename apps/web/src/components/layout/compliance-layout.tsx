'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ComplianceHeader } from './compliance-header';
import { ComplianceSidebar } from './compliance-sidebar';

interface ComplianceLayoutProps {
  children: ReactNode;
}

export function ComplianceLayout({ children }: ComplianceLayoutProps) {
  const { isAuthenticated, isLoading, canAccessCompliance } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!isLoading && isAuthenticated && !canAccessCompliance) {
      // Redirect non-compliance users to main dashboard
      router.push('/');
    }
  }, [isLoading, isAuthenticated, canAccessCompliance, router]);

  // Show loading or nothing while checking auth
  if (isLoading || !isAuthenticated || !canAccessCompliance) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <ComplianceSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ComplianceHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
