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
import { useSettings } from './use-settings';

async function fetchAuditEvents(
  mockMode: boolean,
  params: AuditEventsParams,
): Promise<AuditEventsResponse> {
  if (mockMode) {
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
  mockMode: boolean,
  params: AuditTimeseriesParams,
): Promise<AuditTimeseriesResponse> {
  if (mockMode) {
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
  const { mockMode } = useSettings();

  return useQuery({
    queryKey: ['audit-events', params, { mockMode }],
    queryFn: () => fetchAuditEvents(mockMode, params),
    refetchInterval: 30_000,
    staleTime: 10000,
  });
}

export function useAuditTimeseries(params: AuditTimeseriesParams) {
  const { mockMode } = useSettings();

  return useQuery({
    queryKey: ['audit-timeseries', params, { mockMode }],
    queryFn: () => fetchAuditTimeseries(mockMode, params),
    refetchInterval: 30_000,
    staleTime: 30000,
  });
}
