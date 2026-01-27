import { invites, user } from '@popper/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateToken, getInviteExpiry } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { sendInviteEmail } from '@/lib/email';

async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  return session.user;
}

export async function GET() {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get pending invites (not used and not expired)
    const pendingInvites = await db.query.invites.findMany({
      where: and(isNull(invites.usedAt), gt(invites.expiresAt, new Date())),
      orderBy: (invites, { desc }) => [desc(invites.createdAt)],
    });

    return NextResponse.json({
      invites: pendingInvites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        usedAt: invite.usedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Get invites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    if (!['admin', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if user already exists (using better-auth user table)
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email.toLowerCase()),
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
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
      return NextResponse.json(
        { error: 'Pending invite already exists for this email' },
        { status: 400 },
      );
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

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/accept-invite?token=${token}`;

    // Send invite email
    const emailResult = await sendInviteEmail({
      to: email.toLowerCase(),
      inviterName: currentUser.name,
      inviteUrl,
      role,
    });

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
      },
      inviteUrl,
    });
  } catch (error) {
    console.error('Create invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
