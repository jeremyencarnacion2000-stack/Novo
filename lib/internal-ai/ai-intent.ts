/**
 * AI Intent Classification System
 * 
 * Provides semantic classification of user input to determine
 * appropriate AI behavior and response type.
 */

export type Intent =
    | "TASK"
    | "ROUTINE"
    | "PROJECT"
    | "LOG"
    | "QUESTION"
    | "FREE_CHAT";

export interface IntentBehavior {
    action: "STRUCTURE" | "ANSWER" | "REFLECT";
    confirm?: boolean;
    saveable?: boolean;
    depth?: "adaptive" | "brief" | "detailed";
    memory?: boolean;
    tone?: "human" | "professional" | "casual";
}

/**
 * Detection patterns for each intent type
 */
const INTENT_PATTERNS: Record<Intent, RegExp[]> = {
    ROUTINE: [
        /entrenar|workout|ejercicio|rutina|calistenia|gym|correr|cardio|espalda|piernas|brazos|pecho/i,
        /crear rutina|mi rutina|rutina de|empezar a entrenar/i,
        /morning routine|night routine|daily routine/i,
        /meditar|meditación|yoga|stretching/i,
    ],
    TASK: [
        /tengo que|debo|necesito (hacer|entregar|completar)/i,
        /entregar|deadline|fecha límite|vence|para (mañana|hoy|el)/i,
        /tarea|pendiente|to-?do|hacer|completar/i,
        /recordar(me)?|no olvidar|importante/i,
        /submit|due|assignment|homework/i,
    ],
    PROJECT: [
        /proyecto|project|crear (app|aplicación|web|sitio)/i,
        /startup|negocio|business|emprendimiento/i,
        /desarrollar|construir|build|hacer una/i,
        /plan de|roadmap|milestone|objetivo largo/i,
    ],
    LOG: [
        /registrar|anotar|log|track/i,
        /hoy (hice|comí|dormí|entrené)/i,
        /acabé de|terminé|logré/i,
        /registro de|nota de|diario/i,
    ],
    QUESTION: [
        /^(qué|cómo|por qué|cuál|cuándo|dónde|quién|what|how|why|which|when|where|who)\s/i,
        /\?$/,
        /explica(me)?|define|significa|diferencia entre/i,
        /es (un|una|el|la)\s\w+\??$/i,
        /tell me about|explain|what is|how does/i,
    ],
    FREE_CHAT: [
        /estoy (cansado|triste|feliz|motivado|aburrido)/i,
        /me siento|siento que/i,
        /hola|hey|hi|buenos días|buenas/i,
        /gracias|thanks|ok|okay|vale|perfecto/i,
        /jaja|lol|xd|😂|🤣/i,
    ],
};

/**
 * Classifies user input into an intent category
 */
export function classifyIntent(input: string): Intent {
    const normalizedInput = input.trim().toLowerCase();

    // Check each intent type in priority order
    const priorityOrder: Intent[] = [
        "ROUTINE",
        "TASK",
        "PROJECT",
        "LOG",
        "QUESTION",
        "FREE_CHAT",
    ];

    for (const intent of priorityOrder) {
        const patterns = INTENT_PATTERNS[intent];
        for (const pattern of patterns) {
            if (pattern.test(normalizedInput)) {
                return intent;
            }
        }
    }

    // Default to FREE_CHAT if no pattern matches
    return "FREE_CHAT";
}

/**
 * Returns the appropriate behavior rules for a given intent
 */
export function getIntentBehavior(intent: Intent): IntentBehavior {
    switch (intent) {
        case "TASK":
        case "ROUTINE":
        case "PROJECT":
            // Actionable intents: structure, confirm, and make saveable
            return {
                action: "STRUCTURE",
                confirm: true,
                saveable: true,
            };

        case "LOG":
            // Logging: structure but auto-save
            return {
                action: "STRUCTURE",
                confirm: false,
                saveable: true,
            };

        case "QUESTION":
            // Questions: answer adaptively, no memory
            return {
                action: "ANSWER",
                depth: "adaptive",
                memory: false,
            };

        case "FREE_CHAT":
        default:
            // Free chat: reflect with human tone
            return {
                action: "REFLECT",
                tone: "human",
            };
    }
}

/**
 * Example usage:
 * 
 * const userInput = "Entrenar espalda hoy";
 * const intent = classifyIntent(userInput); // "ROUTINE"
 * const behavior = getIntentBehavior(intent);
 * // { action: "STRUCTURE", confirm: true, saveable: true }
 * 
 * if (behavior.action === "STRUCTURE") {
 *   // AI structures the input, suggests saving
 * } else if (behavior.action === "ANSWER") {
 *   // AI explains/answers the question
 * } else {
 *   // AI reflects, accompanies, doesn't manage
 * }
 */

/**
 * Determines if the intent requires user confirmation before saving
 */
export function requiresConfirmation(intent: Intent): boolean {
    const behavior = getIntentBehavior(intent);
    return behavior.confirm === true;
}

/**
 * Determines if the intent should result in a saveable entity
 */
export function isSaveable(intent: Intent): boolean {
    const behavior = getIntentBehavior(intent);
    return behavior.saveable === true;
}

/**
 * Gets the entity type that should be created for actionable intents
 */
export function getEntityType(intent: Intent): string | null {
    switch (intent) {
        case "TASK":
            return "task";
        case "ROUTINE":
            return "routine";
        case "PROJECT":
            return "project";
        case "LOG":
            return "activity_log";
        default:
            return null;
    }
}
