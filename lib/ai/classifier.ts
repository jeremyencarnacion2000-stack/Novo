/**
 * Intent Classification System
 * 
 * This module classifies user messages into intent categories
 * to determine the appropriate response pathway (conversation vs action).
 * 
 * This is a FAST, deterministic classifier - no AI calls needed.
 */


export type IntentType =
    | 'GENERAL'             // General knowledge or conversation
    | 'STUDY'               // Study, explanation, or learning
    | 'TASK'                // Task-related action or instruction
    | 'ROUTINE'             // Routine-related action or instruction
    | 'ROUTINE_EXPLORATION' // Wanting to start training/routine
    | 'PROJECT'             // Project-related action or instruction
    | 'SYSTEM_META'          // System-related meta interaction
    | 'CRITICAL_ACTION'     // Dangerous actions like deletion
    | 'MIXED';              // Combination (legacy/mixed)

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
const ACTION_VERBS = [
    'crear', 'agregar', 'añadir', 'empezar', 'registrar', 'organizar', 'haz', 'hazme', 'genera', 'nuevo', 'nueva',
    'create', 'add', 'start', 'register', 'organize', 'make', 'generate', 'new'
];

// Entity keywords
const ENTITY_MAP: Record<string, SystemEntity> = {
    'tarea': 'task', 'tareas': 'task', 'task': 'task', 'tasks': 'task',
    'rutina': 'routine', 'rutinas': 'routine', 'routine': 'routine', 'routines': 'routine',
    'proyecto': 'project', 'proyectos': 'project', 'project': 'project', 'projects': 'project',
    'habito': 'habit', 'habitos': 'habit', 'habit': 'habit', 'habits': 'habit',
    'nota': 'note', 'notas': 'note', 'note': 'note', 'notes': 'note'
};

// Study/Knowledge keywords
const STUDY_KEYWORDS = [
    'que es', 'explicame', 'como funciona', 'por que', 'define', 'significa',
    'what is', 'explain', 'how does', 'why', 'define', 'meaning'
];

/**
 * Classifies user intent based on message content
 * Follows the definitive "Novo Brain" specification.
 */
export function classifyIntent(message: string): IntentClassification {
    const lowerMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Detect Critical Actions
    const criticalKeywords = ['borra', 'elimina', 'delete', 'remove', 'clear'];
    const isCritical = criticalKeywords.some(kw => lowerMessage.includes(kw));

    // 2. Detect Action Verbs
    const actionVerbs = ['crear', 'agregar', 'registrar', 'hacer', 'organizar', 'empieza', 'añade', 'create', 'add', 'start', 'register', 'organize', 'make', 'generate'];
    const hasActionVerb = actionVerbs.some(verb => lowerMessage.includes(verb));

    // 3. Detect System Entities
    const entities: SystemEntity[] = [];
    if (lowerMessage.includes('tarea') || lowerMessage.includes('task')) entities.push('task');
    if (lowerMessage.includes('rutina') || lowerMessage.includes('routine') || lowerMessage.includes('entrenamiento') || lowerMessage.includes('workout')) entities.push('routine');
    if (lowerMessage.includes('proyecto') || lowerMessage.includes('project')) entities.push('project');
    if (lowerMessage.includes('habito') || lowerMessage.includes('habit')) entities.push('habit');
    if (lowerMessage.includes('nota') || lowerMessage.includes('note')) entities.push('note');

    // 4. Detect Exploration
    const explorationKeywords = ['quiero empezar', 'quiero entrenar', 'want to start', 'want to train'];
    const isExploration = explorationKeywords.some(kw => lowerMessage.includes(kw));

    // 5. Detect Study Keywords
    const studyKeywords = ['que es', 'explicame', 'como', 'por que', 'define', 'what is', 'explain', 'how', 'why'];
    const isStudy = studyKeywords.some(kw => lowerMessage.startsWith(kw) || lowerMessage.includes(' ' + kw));

    // 6. Classification Logic
    let intentType: IntentType = 'GENERAL';
    let confidence = 0.5;

    if (isCritical && entities.length > 0) {
        intentType = 'CRITICAL_ACTION';
        confidence = 0.95;
    } else if (isExploration) {
        intentType = 'ROUTINE_EXPLORATION';
        confidence = 0.9;
    } else if (hasActionVerb || entities.length > 0) {
        if (entities.includes('routine')) intentType = 'ROUTINE';
        else if (entities.includes('project')) intentType = 'PROJECT';
        else if (entities.includes('task')) intentType = 'TASK';
        else if (hasActionVerb) intentType = 'TASK'; // Default action
        else intentType = 'SYSTEM_META';
        confidence = 0.9;
    } else if (isStudy) {
        intentType = 'STUDY';
        confidence = 0.85;
    }

    return {
        type: intentType,
        entities,
        confidence,
        keywords: [], // Simplified
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
