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
    | 'CODE'                // Programming / coding request
    | 'QUIZ'                // Quiz / exam / test generation
    | 'DESIGN'              // UI design / web page / creative design
    | 'CREATIVE'            // Creative writing, brainstorming
    | 'TASK'                // Task-related action or instruction
    | 'ROUTINE'             // Routine-related action or instruction
    | 'ROUTINE_EXPLORATION' // Wanting to start training/routine
    | 'PROJECT'             // Project-related action or instruction
    | 'SYSTEM_META'          // System-related meta interaction
    | 'CRITICAL_ACTION'     // Dangerous actions like deletion
    | 'COGNITIVE'           // Cognitive, fatigue, productivity, or styling context
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

// Code / Programming keywords
const CODE_KEYWORDS = [
    'programa', 'codigo', 'code', 'function', 'funcion', 'clase', 'class',
    'api', 'endpoint', 'script', 'html', 'css', 'javascript', 'typescript',
    'python', 'react', 'next', 'component', 'componente', 'variable',
    'loop', 'array', 'object', 'database', 'sql', 'json', 'fetch',
    'programar', 'programame', 'codear', 'codeame', 'codificar',
    'desarrollar', 'desarrolla', 'debuggear', 'debug', 'compilar',
    'algoritmo', 'algorithm', 'deploy', 'servidor', 'server',
    'backend', 'frontend', 'fullstack', 'web app', 'webapp',
    'calculadora', 'calculator', 'landing', 'todo list', 'todolist',
    'login', 'signup', 'crud', 'dashboard', 'app',
    'pagina web', 'pagina', 'sitio web', 'website'
];

// Quiz / Educational keywords
const QUIZ_KEYWORDS = [
    'quiz', 'examen', 'test', 'trivia', 'pregunta', 'preguntas',
    'cuestionario', 'evaluacion', 'prueba', 'respuestas',
    'opcion multiple', 'multiple choice', 'flashcard', 'flashcards',
    'exam', 'questionnaire', 'assessment'
];

// Design keywords
const DESIGN_KEYWORDS = [
    'diseña', 'diseno', 'design', 'ui', 'ux', 'interfaz', 'interface',
    'maqueta', 'mockup', 'prototipo', 'prototype', 'wireframe',
    'layout', 'estilo', 'style', 'animacion', 'animation',
    'responsivo', 'responsive', 'tema', 'theme', 'paleta', 'palette',
    'tipografia', 'typography', 'iconos', 'icons'
];

// Cognitive, fatigue, sleep, and styling keywords
const COGNITIVE_KEYWORDS = [
    'fatiga', 'cansado', 'cansada', 'cansancio', 'agotado', 'agotada', 'abrumado', 'abrumada', 'estres', 'estresado',
    'estresada', 'stress', 'sueño', 'dormir', 'durmiendo', 'dormi', 'insomnio', 'fatigue', 'tired', 'exhausted',
    'sleepy', 'focus', 'concentrado', 'concentracion', 'productivo', 'productividad', 'productivity',
    'outfit', 'vestimenta', 'ropa', 'recomienda ropa', 'que me pongo', 'vestir', 'style', 'estilo', 'look',
    'musica', 'cancion', 'canciones', 'recomienda musica', 'ambient', 'binaural', 'focus music', 'relaxing',
    'calma', 'calmar', 'relajar', 'recuperar', 'recuperacion', 'recovery', 'descanso', 'descansar'
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

    // 4. Detect Code intent
    const isCode = CODE_KEYWORDS.some(kw => lowerMessage.includes(kw));

    // 5. Detect Quiz intent
    const isQuiz = QUIZ_KEYWORDS.some(kw => lowerMessage.includes(kw));

    // 6. Detect Design intent
    const isDesign = DESIGN_KEYWORDS.some(kw => lowerMessage.includes(kw));

    // 6b. Detect Cognitive intent
    const isCognitive = COGNITIVE_KEYWORDS.some(kw => lowerMessage.includes(kw));

    // 7. Detect Exploration
    const explorationKeywords = ['quiero empezar', 'quiero entrenar', 'want to start', 'want to train'];
    const isExploration = explorationKeywords.some(kw => lowerMessage.includes(kw));

    // 8. Detect Study Keywords
    const studyKeywords = ['que es', 'explicame', 'como', 'por que', 'define', 'what is', 'explain', 'how', 'why'];
    const isStudy = studyKeywords.some(kw => lowerMessage.startsWith(kw) || lowerMessage.includes(' ' + kw));

    // 9. Classification Logic — specialized intents take priority
    let intentType: IntentType = 'GENERAL';
    let confidence = 0.5;

    if (isCritical && entities.length > 0) {
        intentType = 'CRITICAL_ACTION';
        confidence = 0.95;
    } else if (isCognitive) {
        intentType = 'COGNITIVE';
        confidence = 0.95;
    } else if (isQuiz) {
        intentType = 'QUIZ';
        confidence = 0.92;
    } else if (isCode) {
        intentType = 'CODE';
        confidence = 0.92;
    } else if (isDesign) {
        intentType = 'DESIGN';
        confidence = 0.90;
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
    return classification.type !== 'GENERAL' ||
        classification.entities.length > 0;
}

/**
 * Determines if the response should use structured JSON format
 */
export function requiresStructuredResponse(classification: IntentClassification): boolean {
    return classification.type === 'TASK' ||
        classification.type === 'COGNITIVE' ||
        (classification.type === 'MIXED' && classification.confidence >= 0.7);
}
