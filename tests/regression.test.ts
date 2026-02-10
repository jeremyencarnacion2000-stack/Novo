/**
 * @jest-environment node
 */
import { runAI } from "../lib/ai/runner";

const historicalFailures = [
    "Tengo que estudiar mañana",
    "Estoy cansado y no sé por dónde empezar",
];

describe("Regression", () => {
    test.each(historicalFailures)(
        "Regression: %s",
        async (input) => {
            process.env.GROQ_API_KEY = "mock-key";
            const res = await runAI(input);
            expect(res).toBeDefined();
            // Snapshots are great for regression
            expect(res.type).toMatchSnapshot();
        }
    );
});
