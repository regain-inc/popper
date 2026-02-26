import { treaty } from '@elysiajs/eden';
import type { App } from '@popper/server';
import type { Organization } from '@/types/api';

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/proxy`;
  }
  return 'http://localhost:3000';
}

const API_BASE_URL = getApiBaseUrl();

export const api = treaty<App>(API_BASE_URL);

export const authApi = treaty<App>(API_BASE_URL, {
  fetch: {
    credentials: 'include',
  },
});

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Organizations API (mock for now - in production this comes from auth)
export async function getOrganizations(): Promise<Organization[]> {
  return [
    { id: 'org_regain', name: 'Regain Health' },
    { id: 'org_demo', name: 'Demo Organization' },
  ];
}
