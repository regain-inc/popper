/**
 * Auth context plugin for Elysia
 *
 * Extracts user and session from Better Auth and makes them available
 * in all route handlers via context.
 */

import { auth } from '@popper/auth';
import { Elysia } from 'elysia';

/**
 * User data in the auth context
 */
export interface AuthContextUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  role: string;
  banned: boolean;
}

/**
 * Session data in the auth context
 */
export interface AuthContextSession {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Auth context plugin - adds user and session to context
 *
 * Usage:
 * .use(authContext)
 * .get('/protected', ({ user, session, isAuthenticated }) => { ... })
 */
export const authContext = new Elysia({ name: 'auth-context' }).derive(
  { as: 'scoped' },
  async ({ headers }) => {
    // Build a proper Headers object for Better Auth compatibility
    const headersRecord = headers as Record<string, string | undefined>;
    const cleanHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headersRecord)) {
      if (value !== undefined) {
        cleanHeaders[key] = value;
      }
    }

    // Get session from Better Auth
    const localSession = await auth.api.getSession({
      headers: new Headers(cleanHeaders),
    });

    const user = localSession?.user ?? null;
    const session = localSession?.session ?? null;

    return {
      user: user as AuthContextUser | null,
      session: session as AuthContextSession | null,
      isAuthenticated: !!user,
    };
  },
);
