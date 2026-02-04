'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { mockStatus } from '@/lib/mock-data';
import type { StatusResponse } from '@/types/api';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

async function fetchStatus(organizationId?: string): Promise<StatusResponse> {
  if (USE_MOCK) {
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

  const { data, error } = await api.v1.popper.dashboard.status.get({
    query: { organization_id: organizationId },
  });

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as StatusResponse;
}

export function useStatus(organizationId?: string, refetchInterval?: number) {
  return useQuery({
    queryKey: ['status', organizationId],
    queryFn: () => fetchStatus(organizationId),
    refetchInterval: refetchInterval ? refetchInterval * 1000 : 10_000,
    staleTime: 10000,
  });
}
