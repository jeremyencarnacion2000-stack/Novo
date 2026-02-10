/**
 * @jest-environment node
 */
import { runAI } from "../lib/ai/runner";
import { executeAIAction } from "../lib/ai/executor";

describe("Actions", () => {
    test("Task creation requires confirmation", async () => {
        process.env.GROQ_API_KEY = "mock-key";
        const res = await runAI("Crea una tarea para estudiar matemáticas mañana");

        expect(res.type).toBe("PROPOSAL");
        if (res.type === 'PROPOSAL') {
            expect(res.action.name).toBe("CREATE_TASK");
            expect(res.requiresConfirmation).toBe(true);
        }
    });

    test("Confirmed action executes", async () => {
        const confirmed = await executeAIAction({
            type: "CREATE_TASK",
            payload: {
                title: "Estudiar matemáticas",
                dueDate: "2025-12-19"
            }
        }, "demo-user-id");

        expect(confirmed.success).toBe(true);
    });
});
