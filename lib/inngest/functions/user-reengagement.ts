import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { gmailService } from "@/lib/gmail";

/**
 * Inngest function to identify and notify inactive users
 * Runs weekly on Monday morning
 */
export const reengageInactiveUsers = inngest.createFunction(
    { id: "reengage-inactive-users" },
    { cron: "0 9 * * 1" }, // Every Monday at 9 AM
    async ({ step }: { step: any }) => {
        // 1. Identify users inactive for > 7 days
        const inactiveUsers = await step.run("fetch-inactive-users", async () => {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // Fetch users whose last session was more than 7 days ago
            // or who have never had a session but were created more than 7 days ago
            return await prisma.user.findMany({
                where: {
                    OR: [
                        {
                            userSessions: {
                                none: {
                                    startTime: {
                                        gte: sevenDaysAgo
                                    }
                                }
                            },
                        },
                        {
                            userSessions: {
                                some: {} // Has sessions
                            },
                            NOT: {
                                userSessions: {
                                    some: {
                                        startTime: {
                                            gte: sevenDaysAgo
                                        }
                                    }
                                }
                            }
                        }
                    ]
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                },
                take: 50 // Limit per batch for safety
            });
        });

        // 2. Send emails
        const results = await step.run("send-reengagement-emails", async () => {
            let sentCount = 0;
            let errorCount = 0;

            for (const user of inactiveUsers) {
                try {
                    await gmailService.sendReengagement(user.email, user.name || '');
                    sentCount++;
                } catch (error) {
                    console.error(`Failed to send email to ${user.email}:`, error);
                    errorCount++;
                }
            }

            return { total: inactiveUsers.length, sent: sentCount, errors: errorCount };
        });

        return { success: true, ...results };
    }
);
