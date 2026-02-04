'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { mockIncidents } from '@/lib/mock-data';
import type {
  Incident,
  IncidentStatus,
  IncidentsResponse,
  IncidentUpdateResponse,
  ResolveIncidentRequest,
} from '@/types/api';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

async function fetchIncidents(
  organizationId?: string,
  status?: 'open' | 'all',
): Promise<IncidentsResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    let filtered = mockIncidents;
    if (status === 'open') {
      filtered = mockIncidents.filter((i) => i.status === 'open');
    }
    return {
      organization_id: organizationId || null,
      incidents: filtered,
      total: filtered.length,
    };
  }

  const { data, error } = await api.v1.popper.control.incidents.get({
    query: { organization_id: organizationId, status },
  });

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as IncidentsResponse;
}

async function fetchIncident(id: string): Promise<Incident> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const incident = mockIncidents.find((i) => i.id === id);
    if (!incident) throw new Error('Incident not found');
    return incident;
  }

  const { data, error } = await api.v1.popper.control.incidents({ id }).get();

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as Incident;
}

async function acknowledgeIncident(id: string): Promise<IncidentUpdateResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id,
      status: 'acknowledged',
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await api.v1.popper.control.incidents({ id }).acknowledge.post();

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as IncidentUpdateResponse;
}

async function resolveIncident(
  id: string,
  request: ResolveIncidentRequest,
): Promise<IncidentUpdateResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id,
      status: 'resolved',
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await api.v1.popper.control.incidents({ id }).resolve.post(request);

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as IncidentUpdateResponse;
}

export function useIncidents(organizationId?: string, status?: 'open' | 'all') {
  return useQuery({
    queryKey: ['incidents', organizationId, status],
    queryFn: () => fetchIncidents(organizationId, status),
    refetchInterval: 60_000,
    staleTime: 10000,
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: ['incident', id],
    queryFn: () => fetchIncident(id),
    staleTime: 5000,
  });
}

export function useAcknowledgeIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident'] });
    },
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ResolveIncidentRequest }) =>
      resolveIncident(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident'] });
    },
  });
}

// Helper to get status color
export function getIncidentStatusColor(status: IncidentStatus): string {
  switch (status) {
    case 'open':
      return 'destructive';
    case 'acknowledged':
      return 'warning';
    case 'resolved':
      return 'success';
    default:
      return 'secondary';
  }
}

// Helper to get trigger level color
export function getTriggerLevelColor(level: 'warning' | 'critical' | null): string {
  switch (level) {
    case 'critical':
      return 'destructive';
    case 'warning':
      return 'warning';
    default:
      return 'secondary';
  }
}
