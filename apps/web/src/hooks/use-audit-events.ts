'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { getMockAuditEventsResponse, getMockTimeseries } from '@/lib/mock-data';
import type {
  AuditEventsParams,
  AuditEventsResponse,
  AuditTimeseriesParams,
  AuditTimeseriesResponse,
} from '@/types/api';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

async function fetchAuditEvents(params: AuditEventsParams): Promise<AuditEventsResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return getMockAuditEventsResponse(params.offset || 0, params.limit || 50);
  }

  const { data, error } = await api.v1.popper.dashboard['audit-events'].get({
    query: {
      organization_id: params.organization_id,
      event_type: params.event_type,
      decision: params.decision,
      trace_id: params.trace_id,
      since: params.since,
      until: params.until,
      limit: params.limit,
      offset: params.offset,
    },
  });

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as AuditEventsResponse;
}

async function fetchAuditTimeseries(
  params: AuditTimeseriesParams,
): Promise<AuditTimeseriesResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return getMockTimeseries();
  }

  const { data, error } = await api.v1.popper.dashboard['audit-events'].timeseries.get({
    query: {
      organization_id: params.organization_id,
      since: params.since,
      until: params.until,
      bucket: params.bucket,
      group_by: params.group_by,
    },
  });

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as AuditTimeseriesResponse;
}

export function useAuditEvents(params: AuditEventsParams = {}) {
  return useQuery({
    queryKey: ['audit-events', params],
    queryFn: () => fetchAuditEvents(params),
    refetchInterval: 30_000,
    staleTime: 10000,
  });
}

export function useAuditTimeseries(params: AuditTimeseriesParams) {
  return useQuery({
    queryKey: ['audit-timeseries', params],
    queryFn: () => fetchAuditTimeseries(params),
    refetchInterval: 30_000,
    staleTime: 30000,
  });
}
