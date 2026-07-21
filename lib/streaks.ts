// Extracted from app/api/stats/productivity/route.ts so app/api/analytics/
// route.ts could reuse it instead of duplicating the logic - but a route.ts
// file may only export recognized route handlers/config (GET, POST, etc.);
// Next.js's build-time route validation rejects any other export ("... is
// not a valid Route export field"), which a fresh build (no stale cache)
// actually enforces even though an export like this can silently pass a
// cached build first.
import { prisma } from '@/lib/prisma'

export async function calculateCurrentStreak(userId: string): Promise<number> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 366);
    const tasks = await prisma.checklistItem.findMany({
        where: { userId, completed: true, updatedAt: { gte: windowStart } },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
    });

    if (tasks.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 365; i++) {
        const checkDate = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000);
        const hasActivity = tasks.some((t: any) => {
            const taskDate = new Date(t.updatedAt);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === checkDate.getTime();
        });

        if (hasActivity) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }

    return streak;
}
