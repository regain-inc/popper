import { sessions, users } from '@popper/db';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('popper_session')?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    // Find valid session
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
    });

    if (!session) {
      // Clear invalid cookie
      cookieStore.delete('popper_session');
      return NextResponse.json({ user: null });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!user || !user.isActive) {
      // Clear cookie if user not found or inactive
      cookieStore.delete('popper_session');
      await db.delete(sessions).where(eq(sessions.token, token));
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null });
  }
}
