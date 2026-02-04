import { treaty } from '@elysiajs/eden';
import type { App } from '@popper/server';
import type { Organization } from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = treaty<App>(API_BASE_URL, {
  headers: () => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    return apiKey ? { 'X-API-Key': apiKey } : {};
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
