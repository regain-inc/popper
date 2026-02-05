'use client';

import type { auth } from '@popper/auth';
import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Auth client for web app
 *
 * Points to the API server which handles all auth operations.
 * Web app never accesses the database directly.
 */
export const authClient = createAuthClient<typeof auth>({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9001',
  plugins: [inferAdditionalFields<typeof auth>(), adminClient()],
});

export const { signIn, signOut, signUp, useSession, getSession } = authClient;

export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
