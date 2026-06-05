import { groqAPI } from '@/lib/groq';

export type IntentType = 'UI_COMMAND' | 'KNOWLEDGE_RAG' | 'SIMPLE_TASK' | 'COMPLEX_PLANNING' | 'CONVERSATION' | 'DOCUMENT_CREATION' | 'SCHEDULE_ACTION' | 'GENERATE_FILE' | 'COGNITIVE_AUTOMATION';

export interface IntentClassification {
    type: IntentType;
    confidence: number;
    reasoning: string;
}

// =============================================================================
// REGEX PRE-CLASSIFICATION (fast, deterministic, no LLM needed)
// =============================================================================

interface RegexRule {
    patterns: RegExp[];
    intent: IntentType;
    confidence: number;
}

const REGEX_RULES: RegexRule[] = [
    // COGNITIVE AUTOMATION (highest precedence after file generation, captures fatigue/sleep/cognitive updates)
    {
        patterns: [
            /\b(dormí|dormi|siento|sentirme|fatiga|cansado|cansada|abrumado|abrumada|agobiado|agobiada|estresado|estresada|agotado|agotada|exhausto|exhausta|sueño|sueño|desvelado|insomnio)\b/i,
            /\b(recuperación|recuperacion|calibrar|calibra|estrés|estres|ánimo|animo|humor|psicología|psicologia|estado cognitivo|productividad)\b/i,
            /\b(hoy dormi|hoy dormí|me siento mal|me siento fatal|no dormi|no dormí)\b/i
        ],
        intent: 'COGNITIVE_AUTOMATION',
        confidence: 0.95,
    },
    // FILE GENERATION
    {
        patterns: [
            /\b(haz|crea|genera|hazme|créame|dame|hacer|crear|generar)\b.{0,60}(pdf|web|html|archivo|documento|página|pagina|reporte|csv|fichero)/i,
            /\b(pdf|web|html|archivo|documento|reporte|csv)\b.{0,60}(haz|crea|genera|hazme)/i,
            /\b(descarga|descargar|exporta|exportar)\b.{0,60}(pdf|csv|archivo|documento|reporte)/i,
            /\bhaz(me)?\s+(un|una|el|la)\s+(pdf|web|html|archivo|documento|reporte|csv|página)/i,
            /\b(genera|dame)\s+(el|un|una|la)\s+(pdf|archivo|documento)/i,
        ],
        intent: 'GENERATE_FILE',
        confidence: 0.95,
    },
    // TASK CREATION
    {
        patterns: [
            /\b(crea|añade|agrega|agrégame|créame|hazme)\b.{0,15}(tarea|task|tareas|tasks)/i,
            /\b(tarea|task)\b.{0,10}(nueva|new|crear|crea)/i,
            /\b(recordar|recuérdame)\b.{0,30}(mañana|hoy|lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i,
        ],
        intent: 'SIMPLE_TASK',
        confidence: 0.90,
    },
    // COMPLEX PLANNING
    {
        patterns: [
            /\b(crea|diseña|planifica|hazme|organiza)\b.{0,15}(proyecto|project|plan|rutina|routine)/i,
            /\b(organiza|planifica)\b.{0,15}(semana|mes|week|month)/i,
        ],
        intent: 'COMPLEX_PLANNING',
        confidence: 0.85,
    },
    // SCHEDULING
    {
        patterns: [
            /\b(programa|agéndame|agenda|agendar|programar)\b.{0,20}(evento|reunión|cita|sesión)/i,
            /\b(evento|reunión|cita)\b.{0,15}(mañana|hoy|lunes|martes|miércoles|jueves|viernes)/i,
        ],
        intent: 'SCHEDULE_ACTION',
        confidence: 0.85,
    },
    // NOTE CREATION
    {
        patterns: [
            /\b(anota|apunta|guarda|nota|guardar)\b.{0,15}(nota|idea|recordatorio|pensamiento)/i,
            /\b(crea|créame)\b.{0,10}(nota|apunte)/i,
        ],
        intent: 'DOCUMENT_CREATION',
        confidence: 0.85,
    },
];

function tryRegexClassification(message: string): IntentClassification | null {
    for (const rule of REGEX_RULES) {
        for (const pattern of rule.patterns) {
            if (pattern.test(message)) {
                return {
                    type: rule.intent,
                    confidence: rule.confidence,
                    reasoning: `Regex match: ${pattern.source.slice(0, 40)}...`,
                };
            }
        }
    }
    return null;
}

// =============================================================================
// LLM ROUTER (fallback when regex doesn't match)
// =============================================================================

const ROUTER_SYSTEM_PROMPT = `
You are the Intent Router for Novo, a productivity AI.
Classify the user's message into exactly ONE category. Return strict JSON, no markdown.

CATEGORIES:
- "COGNITIVE_AUTOMATION": The user describes their physical/mental state, fatigue, sleep quality, workload feelings (e.g. "dormí fatal", "abrumado", "cansado", "explotado de tareas") or triggers a recovery block, music recommendation based on mood, or style update based on context.
- "UI_COMMAND": Actions in the app UI (change theme, navigate, toggle settings).
- "KNOWLEDGE_RAG": Questions about personal data (past tasks, notes, saved content).
- "SIMPLE_TASK": Create a single task or reminder.
- "COMPLEX_PLANNING": Create a project, multi-step plan, or routine.
- "DOCUMENT_CREATION": Write a note or save a thought.
- "SCHEDULE_ACTION": Schedule an event or calendar entry.
- "GENERATE_FILE": Create any downloadable file: PDF, document, web page, HTML, CSV, report, export. ANY request to "make a file" or "create a document" or "make a web page" is GENERATE_FILE.
- "CONVERSATION": General chat, questions, explanations, motivation.

IMPORTANT: "haz un PDF", "crea un documento", "haz una web", "genera un archivo" → ALWAYS "GENERATE_FILE", never "CONVERSATION".
IMPORTANT: If they report fatigue, exhaustion, poor sleep, or ask for outfit suggestions linked to stress, ALWAYS select "COGNITIVE_AUTOMATION".

OUTPUT: { "type": "<CATEGORY>", "confidence": <0-1>, "reasoning": "<1 sentence>" }
`;

export async function routeIntent(message: string): Promise<IntentClassification> {
    // STEP 1: Try fast regex classification first
    const regexResult = tryRegexClassification(message);
    if (regexResult) {
        console.log(`[Intent Router] Regex match: ${regexResult.type} (${regexResult.confidence})`);
        return regexResult;
    }

    // STEP 2: Fall back to LLM classification
    try {
        const modelId = 'llama3-8b-8192';
        const response = await groqAPI.generateResponse(
            message, '', [], ROUTER_SYSTEM_PROMPT, modelId, 0.0
        );

        let content = response.content.trim();

        // Clean markdown blocks
        if (content.startsWith('```json')) {
            content = content.substring(7);
            if (content.endsWith('```')) content = content.substring(0, content.length - 3);
        } else if (content.startsWith('```')) {
            content = content.substring(3);
            if (content.endsWith('```')) content = content.substring(0, content.length - 3);
        }

        const parsed = JSON.parse(content);

        const validTypes: IntentType[] = ['UI_COMMAND', 'KNOWLEDGE_RAG', 'SIMPLE_TASK', 'COMPLEX_PLANNING', 'CONVERSATION', 'DOCUMENT_CREATION', 'SCHEDULE_ACTION', 'GENERATE_FILE', 'COGNITIVE_AUTOMATION'];
        if (validTypes.includes(parsed.type)) {
            return parsed as IntentClassification;
        }

        throw new Error(`Invalid intent type: ${parsed.type}`);
    } catch (error) {
        console.error('[Intent Router] Error:', error);
        return {
            type: 'CONVERSATION',
            confidence: 0.1,
            reasoning: 'Fallback due to routing error.',
        };
    }
}

