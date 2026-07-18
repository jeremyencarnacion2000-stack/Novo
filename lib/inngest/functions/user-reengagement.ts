import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { gmailService } from "@/lib/gmail";

// Core autonomous re-engagement logic, extracted so it can run from the Inngest
// scheduler (if configured) OR the request-triggered path (maybeRunReengagement
// + /api/cron/reengagement), since Inngest isn't wired up in production.
//
// Targeting is deliberately conservative to avoid emailing the wrong people:
// only users who (a) registered more than 7 days ago, (b) have had at least one
// focus session ever, and (c) have had NO session in the last 7 days. This
// excludes brand-new signups who simply haven't started yet — they are not
// "lapsed" and must not get a "we miss you" email.
export async function runReengagement() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const inactiveUsers = await prisma.user.findMany({
        where: {
            createdAt: { lt: sevenDaysAgo },
            userSessions: {
                some: {}, // has been active at least once
                none: { startTime: { gte: sevenDaysAgo } }, // but not in the last 7 days
            },
        },
        select: { id: true, email: true, name: true },
        take: 50, // batch cap for safety
    });

    let sent = 0;
    let errors = 0;

    for (const user of inactiveUsers) {
        if (!user.email) continue;
        try {
            const result = await gmailService.sendReengagement(user.email, user.name || '');
            // sendEmail returns null when GMAIL creds are missing — don't count/log that as sent.
            if (!result) { errors++; continue; }
            sent++;
            await prisma.aiActionLog.create({
                data: {
                    userId: user.id,
                    actionType: 'REENGAGEMENT_EMAIL',
                    payload: JSON.stringify({ to: user.email }),
                    success: true,
                    triggeredBy: 'cron',
                },
            }).catch((e) => console.warn('[Reengagement] AiActionLog write failed:', e));
        } catch (error) {
            console.error(`[Reengagement] Failed to email a lapsed user:`, (error as Error).message);
            errors++;
        }
    }

    return { success: true, total: inactiveUsers.length, sent, errors };
}

// Request-triggered "lazy cron": Inngest/Vercel-cron aren't reliable here (see
// [[project-autonomous-ops-cron]]). Fires off organic traffic, only in the
// Monday 09:00 UTC hour and at most once per ~week (guarded by whether a
// REENGAGEMENT_EMAIL was already logged in the last 6 days). The narrow window
// bounds the cost of the inactive-user query. Call from `after()`.
export async function maybeRunReengagement() {
    const now = new Date();
    if (now.getUTCDay() !== 1 || now.getUTCHours() !== 9) return { skipped: 'not-scheduled-window' as const };

    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const alreadyRan = await prisma.aiActionLog.findFirst({
        where: { actionType: 'REENGAGEMENT_EMAIL', createdAt: { gte: sixDaysAgo } },
        select: { id: true },
    });
    if (alreadyRan) return { skipped: 'already-ran-this-week' as const };

    return await runReengagement();
}

// Kept for if INNGEST_* keys ever get configured — same logic, durable retries.
export const reengageInactiveUsers = inngest.createFunction(
    { id: "reengage-inactive-users" },
    { cron: "0 9 * * 1" }, // Every Monday at 9 AM UTC
    async ({ step }: { step: any }) => {
        return await step.run("run-reengagement", runReengagement);
    }
);
