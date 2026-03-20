'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { mockSafeModeHistory } from '@/lib/mock-data';
import type {
  SafeModeHistoryResponse,
  SafeModeRequest,
  SafeModeResponse,
  SafeModeState,
} from '@/types/api';
import { useSettings } from './use-settings';

async function fetchSafeMode(mockMode: boolean, organizationId?: string): Promise<SafeModeState> {
  if (mockMode) {
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

  const { data, error } = await api.v1.popper.control['safe-mode'].get({
    query: { organization_id: organizationId },
  });

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as SafeModeState;
}

async function fetchSafeModeHistory(
  mockMode: boolean,
  organizationId?: string,
): Promise<SafeModeHistoryResponse> {
  if (mockMode) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const history = organizationId
      ? mockSafeModeHistory.filter(
          (h) => h.organization_id === organizationId || h.scope === 'global',
        )
      : mockSafeModeHistory;
    return { history };
  }

  const { data, error } = await api.v1.popper.control['safe-mode'].history.get({
    query: { limit: 20, organization_id: organizationId },
  });

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as SafeModeHistoryResponse;
}

async function updateSafeMode(
  mockMode: boolean,
  request: SafeModeRequest,
): Promise<SafeModeResponse> {
  if (mockMode) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      success: true,
      safe_mode: {
        enabled: request.enabled,
        reason: request.reason,
        effective_at: request.effective_at || new Date().toISOString(),
        effective_until: request.effective_until || null,
        enabled_by: 'ops@regain.ai',
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

  const { data, error } = await api.v1.popper.control['safe-mode'].post(request);

  if (error) {
    throw new ApiError(error.status, error.value as string);
  }

  return data as SafeModeResponse;
}

export function useSafeMode(organizationId?: string) {
  const { mockMode } = useSettings();

  return useQuery({
    queryKey: ['safe-mode', organizationId, { mockMode }],
    queryFn: () => fetchSafeMode(mockMode, organizationId),
    staleTime: 5000,
  });
}

export function useSafeModeHistory(organizationId?: string) {
  const { mockMode } = useSettings();

  return useQuery({
    queryKey: ['safe-mode-history', organizationId, { mockMode }],
    queryFn: () => fetchSafeModeHistory(mockMode, organizationId),
    staleTime: 30000,
  });
}

export function useSetSafeMode() {
  const queryClient = useQueryClient();
  const { mockMode } = useSettings();

  return useMutation({
    mutationFn: (request: SafeModeRequest) => updateSafeMode(mockMode, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safe-mode'] });
      queryClient.invalidateQueries({ queryKey: ['safe-mode-history'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
