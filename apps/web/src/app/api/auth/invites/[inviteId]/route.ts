import { invites } from '@popper/db';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  return session.user;
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
