/**
 * Invite management plugin
 *
 * Handles user invitations for the Popper dashboard.
 * All endpoints require authentication and admin role.
 */

import { auth } from '@popper/auth';
import { and, createDB, eq, gt, invites, isNull, user } from '@popper/db';
import { Elysia, t } from 'elysia';
import { env } from '../config/env';
import { authContext } from '../lib/auth-context';

// Initialize database
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/popper';
const db = createDB(DATABASE_URL);

/**
 * Generate a secure random token for invites
 */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get invite expiry date (7 days from now)
 */
function getInviteExpiry(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}

export const invitePlugin = new Elysia({ prefix: '/api/invites' })
  .use(authContext)

  // GET /api/invites - List pending invites
  .get(
    '/',
    async ({ user: currentUser, set }) => {
      if (!currentUser || currentUser.role !== 'admin') {
        set.status = 403;
        return { error: 'Unauthorized' };
      }

      const pendingInvites = await db.query.invites.findMany({
        where: and(isNull(invites.usedAt), gt(invites.expiresAt, new Date())),
        orderBy: (invites, { desc }) => [desc(invites.createdAt)],
      });

      return {
        invites: pendingInvites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
          usedAt: invite.usedAt?.toISOString() || null,
        })),
      };
    },
    {
      detail: {
        tags: ['Invites'],
        summary: 'List pending invites',
        description: 'Returns all pending (unused and not expired) invites. Admin only.',
      },
    },
  )

  // POST /api/invites - Create new invite
  .post(
    '/',
    async ({ user: currentUser, body, set }) => {
      if (!currentUser || currentUser.role !== 'admin') {
        set.status = 403;
        return { error: 'Unauthorized' };
      }

      const { email, role } = body;

      if (!['admin', 'viewer', 'compliance'].includes(role)) {
        set.status = 400;
        return { error: 'Invalid role' };
      }

      // Check if user already exists
      const existingUser = await db.query.user.findFirst({
        where: eq(user.email, email.toLowerCase()),
      });

      if (existingUser) {
        set.status = 400;
        return { error: 'User with this email already exists' };
      }

      // Check for existing pending invite
      const existingInvite = await db.query.invites.findFirst({
        where: and(
          eq(invites.email, email.toLowerCase()),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      });

      if (existingInvite) {
        set.status = 400;
        return { error: 'Pending invite already exists for this email' };
      }

      // Create invite
      const token = generateToken();
      const expiresAt = getInviteExpiry();

      const [invite] = await db
        .insert(invites)
        .values({
          email: email.toLowerCase(),
          role,
          token,
          invitedBy: currentUser.id,
          expiresAt,
        })
        .returning();

      const inviteUrl = `${env.CORS_ORIGIN}/accept-invite?token=${token}`;

      // TODO: Send invite email via Resend
      console.log(`[Invite] Created invite for ${email}, URL: ${inviteUrl}`);

      return {
        success: true,
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          token: invite.token,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        },
        inviteUrl,
      };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        role: t.String(),
      }),
      detail: {
        tags: ['Invites'],
        summary: 'Create new invite',
        description: 'Creates a new invite and returns the invite URL. Admin only.',
      },
    },
  )

  // DELETE /api/invites/:inviteId - Delete invite
  .delete(
    '/:inviteId',
    async ({ user: currentUser, params, set }) => {
      if (!currentUser || currentUser.role !== 'admin') {
        set.status = 403;
        return { error: 'Unauthorized' };
      }

      await db.delete(invites).where(eq(invites.id, params.inviteId));

      return { success: true };
    },
    {
      params: t.Object({
        inviteId: t.String(),
      }),
      detail: {
        tags: ['Invites'],
        summary: 'Delete invite',
        description: 'Deletes an invite by ID. Admin only.',
      },
    },
  )

  // GET /api/invites/validate - Validate invite token (public)
  .get(
    '/validate',
    async ({ query }) => {
      const { token } = query;

      if (!token) {
        return { valid: false, error: 'Token is required' };
      }

      const invite = await db.query.invites.findFirst({
        where: and(
          eq(invites.token, token),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      });

      if (!invite) {
        return { valid: false, error: 'Invalid or expired invite' };
      }

      return {
        valid: true,
        email: invite.email,
        role: invite.role,
      };
    },
    {
      query: t.Object({
        token: t.String(),
      }),
      detail: {
        tags: ['Invites'],
        summary: 'Validate invite token',
        description: 'Validates an invite token and returns invite details. Public endpoint.',
      },
    },
  )

  // POST /api/invites/accept - Accept invite and create user
  .post(
    '/accept',
    async ({ body, set }) => {
      const { token, name, password } = body;

      if (password.length < 8) {
        set.status = 400;
        return { error: 'Password must be at least 8 characters' };
      }

      // Find valid invite
      const invite = await db.query.invites.findFirst({
        where: and(
          eq(invites.token, token),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      });

      if (!invite) {
        set.status = 400;
        return { error: 'Invalid or expired invite' };
      }

      // Create user via Better Auth admin API
      const betterAuthRole = invite.role === 'admin' ? 'admin' : 'user';
      const createResult = await auth.api.createUser({
        body: {
          email: invite.email,
          password,
          name,
          role: betterAuthRole,
          data: {
            invitedBy: invite.invitedBy,
          },
        },
      });

      // Update role if needed (compliance or viewer)
      if (createResult?.user && (invite.role === 'compliance' || invite.role === 'viewer')) {
        await db.update(user).set({ role: invite.role }).where(eq(user.id, createResult.user.id));
      }

      if (!createResult?.user) {
        set.status = 500;
        return { error: 'Failed to create user' };
      }

      // Mark invite as used
      await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));

      return {
        success: true,
        user: {
          id: createResult.user.id,
          email: createResult.user.email,
          name: createResult.user.name,
          role: invite.role,
        },
      };
    },
    {
      body: t.Object({
        token: t.String(),
        name: t.String({ minLength: 1 }),
        password: t.String({ minLength: 8 }),
      }),
      detail: {
        tags: ['Invites'],
        summary: 'Accept invite',
        description: 'Accepts an invite, creates the user account, and marks the invite as used.',
      },
    },
  );
