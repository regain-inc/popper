'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { mockStatus } from '@/lib/mock-data';
import type { StatusResponse } from '@/types/api';
import { useSettings } from './use-settings';

async function fetchStatus(mockMode: boolean, organizationId?: string): Promise<StatusResponse> {
  if (mockMode) {
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
  const { mockMode } = useSettings();

  return useQuery({
    queryKey: ['status', organizationId, { mockMode }],
    queryFn: () => fetchStatus(mockMode, organizationId),
    refetchInterval: refetchInterval ? refetchInterval * 1000 : 10_000,
    staleTime: 10000,
  });
}
