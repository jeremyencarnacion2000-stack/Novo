/**
 * Intent Classification System
 * 
 * This module classifies user messages into intent categories
 * to determine the appropriate response pathway (conversation vs action).
 * 
 * This is a FAST, deterministic classifier - no AI calls needed.
 */


export type IntentType =
    | 'SYSTEM_ACTION'      // Create, modify, delete system entities
    | 'SYSTEM_QUERY'       // Query system state (show my tasks, etc.)
    | 'GENERAL_KNOWLEDGE'  // Pure informational/educational
    | 'MIXED';             // Combination of knowledge + implicit action

export type SystemEntity =
    | 'task'
    | 'routine'
    | 'workout'
    | 'habit'
    | 'project'
    | 'note'
    | 'event'
    | 'reminder'
    | 'goal';

export interface IntentClassification {
    type: IntentType;
    entities: SystemEntity[];
    confidence: number; // 0-1
    suggestedAction?: string; // e.g., 'CREATE_TASK'
    keywords: string[]; // Matched keywords for debugging
}

// Action-indicating keywords (Spanish + English)
const ACTION_KEYWORDS: Record<string, { action: string; entities: SystemEntity[] }> = {
    // Create actions
    'crea': { action: 'CREATE', entities: [] },
    'crear': { action: 'CREATE', entities: [] },
    'create': { action: 'CREATE', entities: [] },
    'hazme': { action: 'CREATE', entities: [] },
    'haz': { action: 'CREATE', entities: [] },
    'genera': { action: 'CREATE', entities: [] },
    'generar': { action: 'CREATE', entities: [] },
    'agrega': { action: 'CREATE', entities: [] },
    'agregar': { action: 'CREATE', entities: [] },
    'añade': { action: 'CREATE', entities: [] },
    'añadir': { action: 'CREATE', entities: [] },
    'nuevo': { action: 'CREATE', entities: [] },
    'nueva': { action: 'CREATE', entities: [] },

    // Modify actions
    'modifica': { action: 'UPDATE', entities: [] },
    'modificar': { action: 'UPDATE', entities: [] },
    'cambia': { action: 'UPDATE', entities: [] },
    'cambiar': { action: 'UPDATE', entities: [] },
    'actualiza': { action: 'UPDATE', entities: [] },
    'actualizar': { action: 'UPDATE', entities: [] },
    'edita': { action: 'UPDATE', entities: [] },
    'editar': { action: 'UPDATE', entities: [] },
    'update': { action: 'UPDATE', entities: [] },
    'edit': { action: 'UPDATE', entities: [] },

    // Delete actions
    'elimina': { action: 'DELETE', entities: [] },
    'eliminar': { action: 'DELETE', entities: [] },
    'borra': { action: 'DELETE', entities: [] },
    'borrar': { action: 'DELETE', entities: [] },
    'delete': { action: 'DELETE', entities: [] },
    'remove': { action: 'DELETE', entities: [] },
    'quita': { action: 'DELETE', entities: [] },
    'quitar': { action: 'DELETE', entities: [] },

    // Start actions
    'inicia': { action: 'START', entities: [] },
    'iniciar': { action: 'START', entities: [] },
    'empieza': { action: 'START', entities: [] },
    'empezar': { action: 'START', entities: [] },
    'start': { action: 'START', entities: [] },
    'begin': { action: 'START', entities: [] },
    'comienza': { action: 'START', entities: [] },
    'comenzar': { action: 'START', entities: [] },

    // Complete actions
    'completa': { action: 'COMPLETE', entities: [] },
    'completar': { action: 'COMPLETE', entities: [] },
    'termina': { action: 'COMPLETE', entities: [] },
    'terminar': { action: 'COMPLETE', entities: [] },
    'finish': { action: 'COMPLETE', entities: [] },
    'complete': { action: 'COMPLETE', entities: [] },

    // Reminder/Schedule actions
    'recuérdame': { action: 'CREATE', entities: ['reminder'] },
    'recuerdame': { action: 'CREATE', entities: ['reminder'] },
    'remind': { action: 'CREATE', entities: ['reminder'] },
    'programa': { action: 'CREATE', entities: ['event'] },
    'programar': { action: 'CREATE', entities: ['event'] },
    'schedule': { action: 'CREATE', entities: ['event'] },
};

// Entity keywords
const ENTITY_KEYWORDS: Record<string, SystemEntity> = {
    // Task
    'tarea': 'task',
    'tareas': 'task',
    'task': 'task',
    'tasks': 'task',
    'pendiente': 'task',
    'pendientes': 'task',
    'todo': 'task',
    'todos': 'task',

    // Routine
    'rutina': 'routine',
    'rutinas': 'routine',
    'routine': 'routine',
    'routines': 'routine',

    // Workout
    'entrenamiento': 'workout',
    'entrenamientos': 'workout',
    'workout': 'workout',
    'workouts': 'workout',
    'ejercicio': 'workout',
    'ejercicios': 'workout',
    'gym': 'workout',
    'gimnasio': 'workout',

    // Habit
    'hábito': 'habit',
    'habito': 'habit',
    'hábitos': 'habit',
    'habitos': 'habit',
    'habit': 'habit',
    'habits': 'habit',

    // Project
    'proyecto': 'project',
    'proyectos': 'project',
    'project': 'project',
    'projects': 'project',

    // Note
    'nota': 'note',
    'notas': 'note',
    'note': 'note',
    'notes': 'note',
    'apunte': 'note',
    'apuntes': 'note',
    'idea': 'note',
    'ideas': 'note',

    // Event
    'evento': 'event',
    'eventos': 'event',
    'event': 'event',
    'events': 'event',
    'cita': 'event',
    'citas': 'event',
    'reunión': 'event',
    'reunion': 'event',
    'meeting': 'event',

    // Reminder
    'recordatorio': 'reminder',
    'recordatorios': 'reminder',
    'reminder': 'reminder',
    'reminders': 'reminder',

    // Goal
    'meta': 'goal',
    'metas': 'goal',
    'objetivo': 'goal',
    'objetivos': 'goal',
    'goal': 'goal',
    'goals': 'goal',
};

// Query keywords (asking about SYSTEM state specifically)
// Note: "dame" is NOT here because "dame una estrategia" is knowledge, not a system query
const QUERY_KEYWORDS = [
    'muestra', 'muéstrame', 'mostrar', 'show me',
    'cuáles son mis', 'cuales son mis', 'what are my',
    'cuántas tareas', 'cuantas tareas', 'cuántos', 'cuantos',
    'tengo tareas', 'tengo pendientes', 'tengo rutinas', 'tengo hábitos',
    'mis tareas', 'mis rutinas', 'mis proyectos', 'mis notas', 'mis eventos',
    'my tasks', 'my routines', 'my projects', 'my notes', 'my events',
    'listar tareas', 'listar rutinas', 'list my', 'lista de mis',
    'ver mis', 'quiero ver mis', 'déjame ver mis',
];


// Knowledge/Question keywords - Expanded for advice and strategy requests
const KNOWLEDGE_KEYWORDS = [
    // Definitions and explanations
    'qué es', 'que es', 'what is', 'what are', 'cómo funciona', 'como funciona',
    'explica', 'explicar', 'explain', 'por qué', 'porque', 'why',
    'define', 'definir', 'definition', 'definición', 'significa',
    'help me understand', 'ayúdame a entender', 'háblame de', 'hablame de',
    'cuéntame', 'cuentame', 'tell me about', 'diferencia entre',
    'difference between', 'historia de', 'history of', 'teach me', 'enséñame sobre',

    // Advice, strategies, and recommendations
    'dame una estrategia', 'dame estrategia', 'estrategia de', 'estrategia para',
    'dame un consejo', 'dame consejos', 'dame sugerencias', 'dame recomendaciones',
    'dame un plan', 'dame ideas', 'dame tips', 'necesito ayuda con',
    'cómo puedo', 'como puedo', 'how can i', 'how do i', 'how should i',
    'qué me recomiendas', 'que me recomiendas', 'what do you recommend',
    'ayúdame con', 'ayudame con', 'help me with', 'give me advice',
    'sugiéreme', 'sugiereme', 'recomiéndame', 'recomiendame',
    'qué opinas', 'que opinas', 'what do you think',
    'best way to', 'mejor manera de', 'mejores prácticas', 'best practices',

    // Business and professional
    'estrategia de negocio', 'estrategia de negocios', 'business strategy',
    'plan de negocio', 'plan de negocios', 'business plan',
    'cómo vender', 'como vender', 'cómo mejorar', 'como mejorar',
    'cómo aumentar', 'como aumentar', 'cómo reducir', 'como reducir',

    // Learning and information
    'quiero saber', 'quiero aprender', 'necesito información', 'información sobre',
    'cuál es la mejor', 'cual es la mejor', 'which is the best',
    'pros y contras', 'ventajas y desventajas', 'pros and cons',
];


/**
 * Classifies user intent based on message content
 */
export function classifyIntent(message: string): IntentClassification {
    const lowerMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const words = lowerMessage.split(/\s+/);

    const matchedKeywords: string[] = [];
    let detectedAction: string | undefined;
    const detectedEntities: Set<SystemEntity> = new Set();

    // Check for action keywords
    let hasActionKeyword = false;
    for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:]/g, '');
        if (ACTION_KEYWORDS[cleanWord]) {
            hasActionKeyword = true;
            matchedKeywords.push(cleanWord);
            detectedAction = ACTION_KEYWORDS[cleanWord].action;
            ACTION_KEYWORDS[cleanWord].entities.forEach(e => detectedEntities.add(e));
        }
    }

    // Check for entity keywords
    for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:]/g, '');
        if (ENTITY_KEYWORDS[cleanWord]) {
            detectedEntities.add(ENTITY_KEYWORDS[cleanWord]);
            matchedKeywords.push(cleanWord);
        }
    }

    // Check for query patterns
    const hasQueryKeyword = QUERY_KEYWORDS.some(kw => lowerMessage.includes(kw));

    // Check for knowledge patterns
    const hasKnowledgeKeyword = KNOWLEDGE_KEYWORDS.some(kw => lowerMessage.includes(kw));

    // Determine intent type
    let intentType: IntentType;
    let confidence: number;

    if (hasActionKeyword && detectedEntities.size > 0) {
        // Clear action on a system entity
        intentType = 'SYSTEM_ACTION';
        confidence = 0.9;
    } else if (hasActionKeyword && !hasKnowledgeKeyword) {
        // Action keyword but no clear entity - might be implicit
        intentType = 'SYSTEM_ACTION';
        confidence = 0.7;
    } else if (hasQueryKeyword && detectedEntities.size > 0) {
        // Query about system state
        intentType = 'SYSTEM_QUERY';
        confidence = 0.85;
    } else if (hasKnowledgeKeyword && !hasActionKeyword) {
        // Pure knowledge question
        intentType = 'GENERAL_KNOWLEDGE';
        confidence = 0.85;
    } else if (hasKnowledgeKeyword && hasActionKeyword) {
        // Mixed: knowledge + action (e.g., "explain hypertrophy and create a routine")
        intentType = 'MIXED';
        confidence = 0.8;
    } else if (detectedEntities.size > 0 && !hasKnowledgeKeyword) {
        // Entity mentioned without clear action - could be implicit action
        intentType = 'MIXED';
        confidence = 0.6;
    } else {
        // Default to general knowledge (conversational)
        intentType = 'GENERAL_KNOWLEDGE';
        confidence = 0.5;
    }

    // Build suggested action
    let suggestedAction: string | undefined;
    if (detectedAction && detectedEntities.size > 0) {
        const entity = Array.from(detectedEntities)[0].toUpperCase();
        suggestedAction = `${detectedAction}_${entity}`;
    }

    return {
        type: intentType,
        entities: Array.from(detectedEntities),
        confidence,
        suggestedAction,
        keywords: matchedKeywords,
    };
}

/**
 * Determines if a message requires system context injection
 */
export function requiresSystemContext(classification: IntentClassification): boolean {
    return classification.type !== 'GENERAL_KNOWLEDGE' ||
        classification.entities.length > 0;
}

/**
 * Determines if the response should use structured JSON format
 */
export function requiresStructuredResponse(classification: IntentClassification): boolean {
    return classification.type === 'SYSTEM_ACTION' ||
        (classification.type === 'MIXED' && classification.confidence >= 0.7);
}
