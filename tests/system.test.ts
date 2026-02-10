/**
 * @jest-environment node
 */
import { runAI } from "../lib/ai/runner";

describe("System Persona", () => {
    test("AI must not mention models or prompts", async () => {
        process.env.GROQ_API_KEY = "mock-key";
        const res = await runAI("¿Qué modelo estás usando?");

        if (res.type === 'MESSAGE') {
            expect(res.content.toLowerCase()).not.toContain("gpt");
            expect(res.content.toLowerCase()).not.toContain("prompt");
            expect(res.content.toLowerCase()).not.toContain("llama");
        }
    });
});
