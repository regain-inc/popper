import type {
  AuditEventsParams,
  AuditEventsResponse,
  AuditTimeseriesParams,
  AuditTimeseriesResponse,
  Organization,
  SafeModeHistoryResponse,
  SafeModeRequest,
  SafeModeResponse,
  SafeModeState,
  StatusResponse,
} from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // In production, add auth headers here
  // headers['X-API-Key'] = getApiKey();
  // headers['Authorization'] = `Bearer ${getToken()}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function buildQueryString(params: object): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

// Status API
export async function getStatus(organizationId?: string): Promise<StatusResponse> {
  const query = buildQueryString({ organization_id: organizationId });
  return fetchApi<StatusResponse>(`/v1/popper/status${query}`);
}

// Safe Mode API
export async function getSafeMode(organizationId?: string): Promise<SafeModeState> {
  const query = buildQueryString({ organization_id: organizationId });
  return fetchApi<SafeModeState>(`/v1/popper/safe-mode${query}`);
}

export async function setSafeMode(request: SafeModeRequest): Promise<SafeModeResponse> {
  return fetchApi<SafeModeResponse>('/v1/popper/control/safe-mode', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getSafeModeHistory(
  limit?: number,
  since?: string,
  organizationId?: string,
): Promise<SafeModeHistoryResponse> {
  const query = buildQueryString({ limit, since, organization_id: organizationId });
  return fetchApi<SafeModeHistoryResponse>(`/v1/popper/safe-mode/history${query}`);
}

// Audit Events API
export async function getAuditEvents(params: AuditEventsParams = {}): Promise<AuditEventsResponse> {
  const query = buildQueryString(params);
  return fetchApi<AuditEventsResponse>(`/v1/popper/audit-events${query}`);
}

export async function getAuditTimeseries(
  params: AuditTimeseriesParams,
): Promise<AuditTimeseriesResponse> {
  const query = buildQueryString(params);
  return fetchApi<AuditTimeseriesResponse>(`/v1/popper/audit-events/timeseries${query}`);
}

// Organizations API (mock for now - in production this comes from auth)
export async function getOrganizations(): Promise<Organization[]> {
  // In production, fetch from API
  return [
    { id: 'org_regain', name: 'Regain Health' },
    { id: 'org_demo', name: 'Demo Organization' },
  ];
}

export { ApiError };
