import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Persists the cognitive engine's `reorganizedDay` suggestions onto the
// actual Task records, so the recommended hour survives past the /cognitive
// page and shows up as a real time-blocked entry on /today.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reorganizedDay } = await req.json();
  if (!Array.isArray(reorganizedDay) || reorganizedDay.length === 0) {
    return NextResponse.json({ error: 'reorganizedDay array is required' }, { status: 400 });
  }

  const userId = session.user.id;
  const validItems = reorganizedDay.filter(
    (item: any) => item?.id && item.scheduledHour !== undefined && item.scheduledHour !== null
  );

  const results = await Promise.all(
    validItems.map((item: any) =>
      prisma.task.updateMany({
        where: { id: item.id, userId },
        data: {
          scheduledHour: item.scheduledHour,
          scheduledReason: item.reason || null,
        },
      })
    )
  );
  const applied = results.reduce((sum, r) => sum + r.count, 0);

  return NextResponse.json({ success: true, applied });
}
