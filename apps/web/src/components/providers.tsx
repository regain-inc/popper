'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { type ReactNode, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OrganizationProvider } from '@/hooks/use-organization';
import { SettingsProvider } from '@/hooks/use-settings';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SettingsProvider>
          <OrganizationProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
            <ReactQueryDevtools initialIsOpen={false} />
          </OrganizationProvider>
        </SettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
