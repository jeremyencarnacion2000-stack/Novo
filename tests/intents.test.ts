/**
 * @jest-environment node
 */
import { classifyIntent } from "../lib/ai/classifier";

const cases = [
    { input: "¿Qué es la fotosíntesis?", intent: "GENERAL" },
    { input: "Crea una tarea para estudiar mañana", intent: "TASK" },
    { input: "Quiero empezar a entrenar", intent: "ROUTINE_EXPLORATION" },
    { input: "Explícame derivadas", intent: "STUDY" },
    { input: "Borra todas mis tareas", intent: "CRITICAL_ACTION" }
];

describe("Intent classification", () => {
    cases.forEach(({ input, intent }) => {
        test(input, () => {
            const result = classifyIntent(input);
            expect(result.type).toBe(intent);
        });
    });
});
