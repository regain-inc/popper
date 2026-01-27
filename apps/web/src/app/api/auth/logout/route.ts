import { sessions } from '@popper/db';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('popper_session')?.value;

    if (token) {
      // Delete session from database
      await db.delete(sessions).where(eq(sessions.token, token));

      // Clear cookie
      cookieStore.delete('popper_session');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
