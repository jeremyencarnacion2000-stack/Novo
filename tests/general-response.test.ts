/**
 * @jest-environment node
 */
import { runAI } from "../lib/ai/runner";

describe("General Response", () => {
    test("General question should not produce actions", async () => {
        // Set mock env var
        process.env.GROQ_API_KEY = "mock-key";

        const res = await runAI("¿Por qué el cielo es azul?");

        expect(res.type).toBe("MESSAGE");
        if (res.type === 'MESSAGE') {
            expect(res.content).toBeDefined();
        }
        // @ts-ignore
        expect(res.action).toBeUndefined();
    });
});
