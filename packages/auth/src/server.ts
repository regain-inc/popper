/**
 * Better Auth server configuration
 *
 * This module configures Better Auth with Drizzle adapter for Popper.
 * Auth endpoints are mounted in apps/server via auth.handler.
 */

import { account, createDB, session, user, verification } from '@popper/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/popper';
const db = createDB(DATABASE_URL);

/**
 * Type for user data passed to sign-up callbacks.
 */
export interface SignUpUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  role?: string | null;
}

// Callback for logout (cache invalidation)
let onLogoutCallback: ((userId: string) => Promise<void>) | null = null;

// Callback for user creation (invite processing, etc.)
let onUserCreatedCallback: ((user: SignUpUser) => Promise<void>) | null = null;

/**
 * Register a callback to be called on user logout for cache invalidation
 */
export function registerLogoutCallback(callback: (userId: string) => Promise<void>): void {
  onLogoutCallback = callback;
}

/**
 * Register a callback to be called after user creation
 */
export function registerUserCreatedCallback(callback: (user: SignUpUser) => Promise<void>): void {
  onUserCreatedCallback = callback;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url, token }) => {
      // TODO: Implement email sending via Resend
      console.log(`[Auth] Password reset requested for ${user.email}`);
      console.log(`[Auth] Reset URL: ${url}`);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      invitedBy: {
        type: 'string',
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (onUserCreatedCallback) {
            try {
              await onUserCreatedCallback({
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified ?? false,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                role: typeof user.role === 'string' ? user.role : null,
              });
              console.log(`[Auth] User created callback completed for user ${user.id}`);
            } catch (error) {
              console.error(`[Auth] User created callback failed for user ${user.id}:`, error);
            }
          }
        },
      },
    },
    session: {
      delete: {
        after: async (session) => {
          const userId = session.userId;
          if (userId && onLogoutCallback) {
            try {
              await onLogoutCallback(userId);
              console.log(`[Auth] Cache invalidated for user ${userId} on logout`);
            } catch (error) {
              console.error('[Auth] Failed to invalidate cache on logout:', error);
            }
          }
        },
      },
    },
  },
  plugins: [
    admin({
      defaultRole: 'viewer',
      adminRoles: ['admin'],
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),
  ],
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:9001',
    'http://localhost:9002',
    process.env.CORS_ORIGIN || '',
  ].filter(Boolean),
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
});

export type Auth = typeof auth;
