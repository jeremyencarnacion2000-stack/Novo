import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { groqAPI } from "@/lib/groq";
import { logAICall } from "@/lib/ai-call-log";
import { syncAllPlugins } from "@/lib/plugins/plugin-orchestrator";
import { runAmbientTwinForUser } from "@/lib/cognitive/ambient-twin-runtime";

// llama3-8b-8192 and its successor llama-3.1-8b-instant were both
// decommissioned from this Groq account (verified 2026-08-17 via GET
// /v1/models — only the gpt-oss family + qwen3.6 remain), so this
// autonomous daily-insight generation was silently failing. GPT-OSS 20B
// is the small, high-rate-limit survivor that fits this one-sentence job.
const DAILY_INSIGHT_MODEL = "openai/gpt-oss-20b";

const DAILY_PROMPT = `
You are the Novo Day Wrap-up Engine.
You receive a user's daily stats and must output exactly ONE motivational but highly actionable sentence of advice.
Focus strictly on the provided data. Give practical advice to improve tomorrow.
Under 150 characters.
`;

// Core autonomous daily-insight logic, extracted so it can run from either the
// Inngest scheduler (if configured) OR the Vercel Cron route
// (app/api/cron/daily-insights) — the latter is what actually runs in
// production, since Inngest was never wired up there. Each generated insight is
// also written to AiActionLog with triggeredBy: 'cron', so the autonomous run
// shows up in the Bitácora as provable AI-Native Ops evidence ("automático").
export async function runDailyInsights() {
    // 0. Sync all connected plugins first so Twin data is fresh
    const allUsers = await prisma.user.findMany({ select: { id: true }, take: 100 });
    await Promise.allSettled(allUsers.map(async (u) => {
        await syncAllPlugins(u.id);
        await runAmbientTwinForUser(u.id, { trigger: 'sync' });
    }));

    // 1. Get all users who had a cognitive snapshot updated in the last 24h
    const usersWithActivity = await prisma.userCognitiveSnapshot.findMany({
        where: {
            updatedAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        },
        take: 100 // Batching it for MVP
    });

    let generated = 0;

    for (const snapshot of usersWithActivity) {
        // Rule: Don't bother the user if they didn't do anything today
        if (snapshot.focusTimeToday === 0 && snapshot.productivityScore === 0) {
            continue;
        }

        // Generate Insight via LLM
        const context = `
    User Data Today:
    - Focus Time: ${snapshot.focusTimeToday} mins
    - Productivity Score: ${snapshot.productivityScore}/100
    - Overdue Tasks: ${snapshot.overdueTasks}
    - Current Fatigue: ${snapshot.fatigueEstimate}
    Provide an insight or encouraging wrap-up.
    `;

        try {
            const response = await logAICall(
                { userId: snapshot.userId, provider: 'groq', model: DAILY_INSIGHT_MODEL, purpose: 'daily_wrapup' },
                () => groqAPI.generateResponse(
                    context, '', [], DAILY_PROMPT, DAILY_INSIGHT_MODEL, 0.5
                )
            );

            await prisma.insight.create({
                data: {
                    userId: snapshot.userId,
                    content: response.content.trim(),
                    type: 'daily_wrapup',
                    status: 'unread'
                }
            });

            // Audit trail: record this as an autonomous action so it appears in
            // the Bitácora del Twin labeled "automático" — the AI-Native Ops proof.
            await prisma.aiActionLog.create({
                data: {
                    userId: snapshot.userId,
                    actionType: 'GENERATE_DAILY_INSIGHT',
                    payload: JSON.stringify({ type: 'daily_wrapup' }),
                    success: true,
                    triggeredBy: 'cron',
                }
            }).catch((e) => console.warn('[Daily Insights] AiActionLog write failed:', e));

            generated++;
        } catch (e) {
            console.error("Daily insight LLM error for user", snapshot.userId, e);
        }

        // Reset the user's daily metrics for tomorrow
        await prisma.userCognitiveSnapshot.update({
            where: { userId: snapshot.userId },
            data: {
                focusTimeToday: 0,
                productivityScore: 0,
                fatigueEstimate: 'low'
            }
        });
    }

    return { success: true, processed: usersWithActivity.length, insightsGenerated: generated };
}

// Request-triggered "lazy cron": since Vercel Cron isn't reliably registered
// for this CLI-deploy project (and Inngest was never configured), the daily run
// piggybacks on organic authenticated traffic. It only fires during the 23:00
// UTC hour (the scheduled end-of-day slot, so the per-user metric reset happens
// at day's end, not mid-day) and at most once per day (guarded by whether a
// GENERATE_DAILY_INSIGHT was already logged in the last 20h — the same marker
// the Vercel Cron/Inngest paths write, so all three coordinate and never
// double-run). Call it from `after()` so it never blocks the response.
// ponytail: on days with zero active users the guard never trips, so each
// request in the 23:00 hour re-runs a cheap 0-user query — negligible; a
// dedicated job-run marker table would remove even that, when it's worth a migration.
export async function maybeRunDailyInsights() {
    if (new Date().getUTCHours() !== 23) return { skipped: 'not-scheduled-hour' as const };

    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const alreadyRan = await prisma.aiActionLog.findFirst({
        where: { actionType: 'GENERATE_DAILY_INSIGHT', createdAt: { gte: twentyHoursAgo } },
        select: { id: true },
    });
    if (alreadyRan) return { skipped: 'already-ran-today' as const };

    return await runDailyInsights();
}

// Kept for if INNGEST_* keys ever get configured — same logic, durable retries.
export const processDailyInsights = inngest.createFunction(
    { id: "process-daily-insights" },
    { cron: "0 23 * * *" }, // Runs every day at 23:00 (11:00 PM) UTC as a default
    async ({ step }: { step: any }) => {
        // Step 1: sync all plugins so Twin data is up to date
        await step.run("sync-all-plugins", async () => {
            const allUsers = await prisma.user.findMany({ select: { id: true }, take: 100 });
            await Promise.allSettled(allUsers.map((u) => syncAllPlugins(u.id)));
        });
        // Step 2: generate daily insights
        return await step.run("run-daily-insights", runDailyInsights);
    }
);
