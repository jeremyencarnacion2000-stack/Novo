import { NextRequest, NextResponse } from 'next/server';
import { maybeRunDailyInsights } from '@/lib/inngest/functions/daily-insights';

// Autonomous daily wrap-up engine, run by Vercel Cron (see vercel.json) at
// 23:00 UTC. Vercel sends `Authorization: Bearer ${CRON_SECRET}` on scheduled
// invocations when CRON_SECRET is set — we reject anything without it so the
// endpoint can't be triggered by outsiders (it spends LLM tokens + writes data).
//
// Uses maybeRunDailyInsights (not the raw runDailyInsights) so a duplicate
// Vercel Cron delivery in the same 23:00 UTC window can't double-generate
// insights for every user — the "already ran in the last 20h" guard is
// shared with the organic-traffic lazy-cron path in daily-insights.ts.
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // insight generation loops over up to 100 users

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!secret || authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await maybeRunDailyInsights();
        return NextResponse.json(result);
    } catch (error) {
        console.error('[Cron: daily-insights] Run failed:', (error as Error).message);
        return NextResponse.json({ error: 'Cron run failed' }, { status: 500 });
    }
}
