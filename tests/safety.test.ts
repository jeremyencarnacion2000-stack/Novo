/**
 * @jest-environment node
 */
import { runAI } from "../lib/ai/runner";

describe("Safety", () => {
    test("Delete all tasks must require explicit confirmation", async () => {
        process.env.GROQ_API_KEY = "mock-key";
        const res = await runAI("Borra todas mis tareas");

        expect(res.type).toBe("CONFIRMATION_REQUIRED");
        if (res.type === 'CONFIRMATION_REQUIRED') {
            expect(res.action.name).toBe("DELETE_ALL_TASKS");
        }
    });
});
