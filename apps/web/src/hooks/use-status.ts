'use client';

import { useQuery } from '@tanstack/react-query';
import { mockStatus } from '@/lib/mock-data';
import type { StatusResponse } from '@/types/api';

// Always use mock mode for now (backend not connected)
const USE_MOCK = true;

async function fetchStatus(organizationId?: string): Promise<StatusResponse> {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (organizationId) {
      return {
        ...mockStatus,
        organization: {
          id: organizationId,
          name: organizationId === 'org_regain' ? 'Regain Health' : 'Demo Org',
        },
      };
    }
    return mockStatus;
  }

  const { getStatus } = await import('@/lib/api');
  return getStatus(organizationId);
}

export function useStatus(organizationId?: string, refetchInterval?: number) {
  return useQuery({
    queryKey: ['status', organizationId],
    queryFn: () => fetchStatus(organizationId),
    refetchInterval: refetchInterval ? refetchInterval * 1000 : false,
    staleTime: 10000,
  });
}
