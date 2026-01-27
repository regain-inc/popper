import { invites, sessions, users } from '@popper/db';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('popper_session')?.value;

  if (!token) return null;

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
  });

  if (!session) return null;

  return db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  try {
    const { inviteId } = await params;
    const currentUser = await getAuthUser();

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await db.delete(invites).where(eq(invites.id, inviteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
