/**
 * @jest-environment node
 */
import { runAI } from "../lib/ai/runner";
import { executeAIAction, pickResultMessage } from "../lib/ai/executor";

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

    test("pickResultMessage prefers the post-execution result over the model's pre-execution guess", () => {
        // Reproduces the production bug: the model writes a "message" before
        // GENERATE_FILE's real filename-resolution runs, so it can reference
        // a filename it doesn't actually know yet.
        const modelMessage = 'El archivo "undefined" se ha generado correctamente.';
        const execResult = { message: 'Se ha generado el archivo "documento.txt".' };

        expect(pickResultMessage(execResult, modelMessage)).toBe(execResult.message);
    });

    test("pickResultMessage falls back to the model's message when there is no execution result message", () => {
        expect(pickResultMessage({}, "modelo dice hola")).toBe("modelo dice hola");
    });

    test("pickResultMessage falls back to the provided default when neither message exists", () => {
        expect(pickResultMessage({}, undefined, "valor por defecto")).toBe("valor por defecto");
    });
});
