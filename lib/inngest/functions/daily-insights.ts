import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { groqAPI } from "@/lib/groq";
import { logAICall } from "@/lib/ai-call-log";

const DAILY_INSIGHT_MODEL = "llama3-8b-8192";

const DAILY_PROMPT = `
You are the Novo Day Wrap-up Engine.
You receive a user's daily stats and must output exactly ONE motivational but highly actionable sentence of advice.
Focus strictly on the provided data. Give practical advice to improve tomorrow.
Under 150 characters.
`;

export const processDailyInsights = inngest.createFunction(
    { id: "process-daily-insights" },
    { cron: "0 23 * * *" }, // Runs every day at 23:00 (11:00 PM) UTC as a default
    async ({ step }: { step: any }) => {

        // 1. Get all users who had activity today
        const usersWithActivity = await step.run("fetch-active-users", async () => {
            // Find users with a snapshot updated recently
            return await prisma.userCognitiveSnapshot.findMany({
                where: {
                    updatedAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                },
                take: 100 // Batching it for MVP
            });
        });

        // 2. Process each user
        const results = await step.run("generate-and-reset", async () => {
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

            return { processed: usersWithActivity.length, insightsGenerated: generated };
        });

        return { success: true, ...results };
    }
);
