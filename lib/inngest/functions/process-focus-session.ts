import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { groqAPI } from "@/lib/groq";

// Using Llama3 for insights generation as per requirements for low cost & speed
const INSIGHT_MODEL = "llama3-8b-8192";

const INSIGHTS_SYSTEM_PROMPT = `
You are Novo's Cognitive Insight Engine.
Analyze the user's data mathematically and provide exactly ONE concise, actionable sentence as an insight.
Do not say "Based on the data" or "Here is an insight". Just state the insight.
Focus on habits, fatigue, or optimal times.
Keep it under 150 characters.
`;

export const processFocusSession = inngest.createFunction(
    { id: "process-focus-session" },
    { event: "focus.completed" },
    async ({ event, step }) => {

        // 1. DETERMINISTIC RULES ENGINE (The Gateway)
        // We only invoke the LLM if certain mathematical conditions are met.
        const shouldGenerateInsight = await step.run("evaluate-fatigue-rules", async () => {
            const { userId, duration, quality } = event.data;

            // Let's get today's cognitive snapshot
            let snapshot = await prisma.userCognitiveSnapshot.findUnique({
                where: { userId }
            });

            if (!snapshot) {
                snapshot = await prisma.userCognitiveSnapshot.create({
                    data: { userId }
                });
            }

            // Rule 1: Long session with low quality indicates fatigue
            if (duration > 45 && (quality && quality < 3)) {
                return { trigger: true, reason: 'fatigue' };
            }

            // Rule 2: High total focus time today indicates potential burnout
            const newTotalFocus = snapshot.focusTimeToday + duration;
            if (newTotalFocus > 240) { // 4 hours intense focus
                return { trigger: true, reason: 'overwork' };
            }

            // Rule 3: Great session! Reinforce positive habit
            if (duration >= 50 && (quality && quality >= 4)) {
                // Only trigger positive feedback rarely so it doesn't get annoying
                if (Math.random() > 0.7) {
                    return { trigger: true, reason: 'flow_state' };
                }
            }

            return { trigger: false, reason: 'normal' };
        });

        // 2. LLM CALL (Only if rules triggered)
        if (shouldGenerateInsight.trigger) {
            const insightResult = await step.run("generate-ai-insight", async () => {
                const context = `User just completed a ${event.data.duration}m focus session. Reason for trigger: ${shouldGenerateInsight.reason}. Generating insight...`;

                try {
                    const result = await groqAPI.generateResponse(
                        context,
                        '',
                        [],
                        INSIGHTS_SYSTEM_PROMPT,
                        INSIGHT_MODEL,
                        0.5 // Slight creativity allowed for wording
                    );
                    return result.content.trim();
                } catch (error) {
                    console.error("Failed to generate insight:", error);
                    // Fallback deterministic insights
                    if (shouldGenerateInsight.reason === 'fatigue') return "Tu calidad de enfoque bajó. Tómate un descanso de 15 minutos fuera de la pantalla.";
                    if (shouldGenerateInsight.reason === 'overwork') return "Llevas más de 4 horas de foco intenso hoy. Considera cerrar las tareas pendientes mañana.";
                    return "Excelente bloque de concentración. Mantén este ritmo.";
                }
            });

            // 3. PERSISTENCE
            await step.run("save-insight", async () => {
                // Save to Insights table
                await prisma.insight.create({
                    data: {
                        userId: event.data.userId,
                        content: insightResult,
                        type: shouldGenerateInsight.reason,
                        status: 'unread'
                    }
                });

                // Update Cognitive Snapshot
                await prisma.userCognitiveSnapshot.update({
                    where: { userId: event.data.userId },
                    data: {
                        fatigueEstimate: shouldGenerateInsight.reason === 'fatigue' ? 'high' : undefined,
                        lastInsightGeneratedAt: new Date()
                    }
                });
            });
        }

        return { success: true, triggeredInsight: shouldGenerateInsight.trigger };
    }
);
