import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SESSION_COOKIE_NAME = 'popper_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BCRYPT_ROUNDS = 12;

export type UserRole = 'admin' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface SessionData {
  user: AuthUser;
  expiresAt: Date;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get session expiration date
 */
export function getSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

/**
 * Get invite expiration date (48 hours)
 */
export function getInviteExpiry(): Date {
  return new Date(Date.now() + 48 * 60 * 60 * 1000);
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

/**
 * Get session token from cookie
 */
export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in server components or route handlers
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session.user;
}

/**
 * Require admin role - redirects to home if not admin
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'admin') {
    redirect('/');
  }
  return user;
}

/**
 * Get current session (placeholder - will be implemented with DB)
 * This will be called by middleware and server components
 */
export async function getSession(): Promise<SessionData | null> {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  // TODO: Implement database lookup
  // For now, return a mock session for development
  // This will be replaced with actual DB query
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/auth/session`,
    {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      cache: 'no-store',
    },
  ).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const data = await response.json();
  if (!data.user) {
    return null;
  }

  return {
    user: data.user,
    expiresAt: new Date(data.expiresAt),
  };
}
