import { invites } from '@popper/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, password } = body;

    if (!token || !name || !password) {
      return NextResponse.json(
        { error: 'Token, name, and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
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
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 });
    }

    // Create user via better-auth admin API
    // Map 'viewer' role to 'user' if needed (better-auth defaults)
    const role = invite.role === 'viewer' ? 'user' : invite.role;
    const createResult = await auth.api.createUser({
      body: {
        email: invite.email,
        password,
        name,
        role: role as 'user' | 'admin',
        data: {
          invitedBy: invite.invitedBy,
        },
      },
    });

    if (!createResult?.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Mark invite as used
    await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));

    // Sign in the user to get session token
    const signInResult = await auth.api.signInEmail({
      body: {
        email: invite.email,
        password,
      },
    });

    // Set session cookie manually
    if (signInResult?.token) {
      const cookieStore = await cookies();
      cookieStore.set('better-auth.session_token', signInResult.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    // Return success with session info
    return NextResponse.json({
      success: true,
      user: {
        id: createResult.user.id,
        email: createResult.user.email,
        name: createResult.user.name,
        role: createResult.user.role,
      },
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET to validate invite token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token is required' });
    }

    const invite = await db.query.invites.findFirst({
      where: and(
        eq(invites.token, token),
        isNull(invites.usedAt),
        gt(invites.expiresAt, new Date()),
      ),
    });

    if (!invite) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired invite' });
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      role: invite.role,
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    return NextResponse.json({ valid: false, error: 'Internal server error' });
  }
}
