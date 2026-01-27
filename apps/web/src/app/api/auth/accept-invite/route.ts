import { invites, sessions, users } from '@popper/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { generateToken, getSessionExpiry, hashPassword } from '@/lib/auth-server';
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

    // Create user
    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        email: invite.email,
        passwordHash,
        name,
        role: invite.role,
        invitedBy: invite.invitedBy,
      })
      .returning();

    // Mark invite as used
    await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));

    // Create session
    const sessionToken = generateToken();
    const expiresAt = getSessionExpiry();

    await db.insert(sessions).values({
      userId: user.id,
      token: sessionToken,
      expiresAt,
    });

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('popper_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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
