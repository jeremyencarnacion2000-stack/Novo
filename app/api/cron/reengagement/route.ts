import { NextRequest, NextResponse } from 'next/server';
import { runReengagement } from '@/lib/inngest/functions/user-reengagement';

// Autonomous weekly re-engagement, run by Vercel Cron (see vercel.json) Mondays
// 09:00 UTC. Guarded by CRON_SECRET so outsiders can't trigger it (it sends real
// emails). Note: only actually sends when GMAIL_USER/GMAIL_APP_PASSWORD are set
// in the environment; otherwise gmailService.sendReengagement is a no-op.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!secret || authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await runReengagement();
        return NextResponse.json(result);
    } catch (error) {
        console.error('[Cron: reengagement] Run failed:', (error as Error).message);
        return NextResponse.json({ error: 'Cron run failed' }, { status: 500 });
    }
}
