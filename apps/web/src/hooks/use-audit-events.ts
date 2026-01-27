'use client';

import { useQuery } from '@tanstack/react-query';
import { getMockAuditEventsResponse, getMockTimeseries } from '@/lib/mock-data';
import type {
  AuditEventsParams,
  AuditEventsResponse,
  AuditTimeseriesParams,
  AuditTimeseriesResponse,
} from '@/types/api';

async function fetchAuditEvents(params: AuditEventsParams): Promise<AuditEventsResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  return getMockAuditEventsResponse(params.offset || 0, params.limit || 50);
}

async function fetchAuditTimeseries(
  _params: AuditTimeseriesParams,
): Promise<AuditTimeseriesResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  return getMockTimeseries();
}

export function useAuditEvents(params: AuditEventsParams = {}) {
  return useQuery({
    queryKey: ['audit-events', params],
    queryFn: () => fetchAuditEvents(params),
    staleTime: 10000,
  });
}

export function useAuditTimeseries(params: AuditTimeseriesParams) {
  return useQuery({
    queryKey: ['audit-timeseries', params],
    queryFn: () => fetchAuditTimeseries(params),
    staleTime: 30000,
  });
}
