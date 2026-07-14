import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActiveSignal } from '@/lib/cognitive/active-signal';

// GET /api/cognitive/active-signal — the one platform signal "Ahora →" and
// the AI chat context should show right now, already priority-resolved
// (Notion > Calendar) server-side.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signal = await getActiveSignal(session.user.id);
  return NextResponse.json({ signal });
}
