'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Incident,
  IncidentStatus,
  IncidentsResponse,
  IncidentUpdateResponse,
  ResolveIncidentRequest,
} from '@/types/api';

// Mock incidents data for development
const mockIncidents: Incident[] = [
  {
    id: 'inc_1',
    organization_id: 'org_demo',
    type: 'drift_threshold_breach',
    status: 'open',
    trigger_signal: 'validation_failure_rate',
    trigger_level: 'critical',
    trigger_value: '0.15',
    threshold_value: '0.10',
    baseline_value: '0.02',
    title: 'Critical: validation_failure_rate exceeded threshold',
    description: 'Validation failure rate spiked to 15%, exceeding critical threshold of 10%',
    metadata: null,
    safe_mode_enabled: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    cooldown_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'inc_2',
    organization_id: 'org_demo',
    type: 'drift_threshold_breach',
    status: 'acknowledged',
    trigger_signal: 'hard_stop_rate',
    trigger_level: 'warning',
    trigger_value: '0.08',
    threshold_value: '0.06',
    baseline_value: '0.03',
    title: 'Warning: hard_stop_rate approaching threshold',
    description: 'Hard stop rate increased to 8%, approaching critical threshold',
    metadata: null,
    safe_mode_enabled: null,
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    cooldown_until: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'inc_3',
    organization_id: 'org_demo',
    type: 'manual',
    status: 'resolved',
    trigger_signal: null,
    trigger_level: null,
    trigger_value: null,
    threshold_value: null,
    baseline_value: null,
    title: 'Manual incident: Scheduled maintenance',
    description: 'Safe-mode enabled for scheduled system maintenance',
    metadata: null,
    safe_mode_enabled: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    resolved_by: 'ops@regain.health',
    resolution_notes: 'Maintenance completed successfully. All systems operational.',
    cooldown_until: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
  },
];

// Always use mock mode for now (backend not connected)
const USE_MOCK = true;

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

  const params = new URLSearchParams();
  if (organizationId) params.set('organization_id', organizationId);
  if (status) params.set('status', status);

  const response = await fetch(`/api/popper/control/incidents?${params}`);
  if (!response.ok) throw new Error('Failed to fetch incidents');
  return response.json();
}

async function fetchIncident(id: string): Promise<Incident> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const incident = mockIncidents.find((i) => i.id === id);
    if (!incident) throw new Error('Incident not found');
    return incident;
  }

  const response = await fetch(`/api/popper/control/incidents/${id}`);
  if (!response.ok) throw new Error('Failed to fetch incident');
  return response.json();
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

  const response = await fetch(`/api/popper/control/incidents/${id}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to acknowledge incident');
  return response.json();
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

  const response = await fetch(`/api/popper/control/incidents/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to resolve incident');
  return response.json();
}

export function useIncidents(organizationId?: string, status?: 'open' | 'all') {
  return useQuery({
    queryKey: ['incidents', organizationId, status],
    queryFn: () => fetchIncidents(organizationId, status),
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
