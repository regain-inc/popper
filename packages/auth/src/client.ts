/**
 * Better Auth client for React/Next.js
 *
 * This client is used in the web app to interact with the auth API.
 * It sends requests to the server's /api/auth/* endpoints.
 */

import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { auth } from './server';

function getAuthBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:9001';
}

export const authClient = createAuthClient<typeof auth>({
  baseURL: getAuthBaseUrl(),
  plugins: [inferAdditionalFields<typeof auth>(), adminClient()],
});

export type AuthClient = typeof authClient;

// Export commonly used functions
export const { signIn, signUp, signOut, useSession } = authClient;
