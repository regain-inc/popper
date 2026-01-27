/**
 * Auth server utilities
 *
 * Minimal utilities for invite tokens. Better-auth handles password hashing,
 * session management, and authentication.
 */

export type UserRole = 'admin' | 'viewer';

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
 * Get invite expiration date (48 hours)
 */
export function getInviteExpiry(): Date {
  return new Date(Date.now() + 48 * 60 * 60 * 1000);
}
