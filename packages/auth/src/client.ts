/**
 * Better Auth client for React/Next.js
 *
 * This client is used in the web app to interact with the auth API.
 * It sends requests to the server's /api/auth/* endpoints.
 */

import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { auth } from './server';

export const authClient = createAuthClient<typeof auth>({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9001',
  plugins: [inferAdditionalFields<typeof auth>(), adminClient()],
});

export type AuthClient = typeof authClient;

// Export commonly used functions
export const { signIn, signUp, signOut, useSession } = authClient;
