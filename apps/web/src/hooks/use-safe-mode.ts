'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mockSafeModeHistory } from '@/lib/mock-data';
import type {
  SafeModeHistoryResponse,
  SafeModeRequest,
  SafeModeResponse,
  SafeModeState,
} from '@/types/api';

// Always use mock mode for now (backend not connected)
const USE_MOCK = true;

async function fetchSafeMode(organizationId?: string): Promise<SafeModeState> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      enabled: false,
      reason: null,
      effective_at: null,
      effective_until: null,
      enabled_by: null,
      scope: organizationId ? 'organization' : 'global',
      organization_id: organizationId || null,
    };
  }

  const { getSafeMode } = await import('@/lib/api');
  return getSafeMode(organizationId);
}

async function fetchSafeModeHistory(organizationId?: string): Promise<SafeModeHistoryResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const history = organizationId
      ? mockSafeModeHistory.filter(
          (h) => h.organization_id === organizationId || h.scope === 'global',
        )
      : mockSafeModeHistory;
    return { history };
  }

  const { getSafeModeHistory } = await import('@/lib/api');
  return getSafeModeHistory(20, undefined, organizationId);
}

async function updateSafeMode(request: SafeModeRequest): Promise<SafeModeResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      success: true,
      safe_mode: {
        enabled: request.enabled,
        reason: request.reason,
        effective_at: request.effective_at || new Date().toISOString(),
        effective_until: request.effective_until || null,
        enabled_by: 'ops@regain.health',
        scope: request.organization_id ? 'organization' : 'global',
        organization_id: request.organization_id || null,
      },
      control_command: {
        command_id: `cmd_${Date.now()}`,
        command_type: 'SET_SAFE_MODE',
        issued_at: new Date().toISOString(),
      },
    };
  }

  const { setSafeMode } = await import('@/lib/api');
  return setSafeMode(request);
}

export function useSafeMode(organizationId?: string) {
  return useQuery({
    queryKey: ['safe-mode', organizationId],
    queryFn: () => fetchSafeMode(organizationId),
    staleTime: 5000,
  });
}

export function useSafeModeHistory(organizationId?: string) {
  return useQuery({
    queryKey: ['safe-mode-history', organizationId],
    queryFn: () => fetchSafeModeHistory(organizationId),
    staleTime: 30000,
  });
}

export function useSetSafeMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSafeMode,
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['safe-mode'] });
      queryClient.invalidateQueries({ queryKey: ['safe-mode-history'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
