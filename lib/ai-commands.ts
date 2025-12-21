// lib/ai-commands.ts
// Sistema de análisis de intención para el chatbot

export interface IntentData {
  intent: string;
  data: Record<string, any>;
}

/**
 * Detecta la intención del mensaje del usuario y extrae datos relevantes.
 * @param message El mensaje del usuario.
 * @returns Un objeto con la intención detectada y los datos extraídos.
 */
export function detectIntent(message: string): IntentData {
  const lowerMessage = message.toLowerCase().trim();

  // Detectar intención de crear tarea
  if (lowerMessage.includes('crear tarea') || lowerMessage.includes('nueva tarea') ||
    lowerMessage.includes('agregar tarea') || lowerMessage.includes('añadir tarea') ||
    lowerMessage.includes('agrega una tarea') || lowerMessage.includes('añade una tarea') ||
    lowerMessage.includes('agrega esto a mis tareas') || lowerMessage.includes('añade esto a mis tareas') ||
    lowerMessage.includes('tarea:') || lowerMessage.includes('task:') ||
    lowerMessage.includes('recuérdame') || lowerMessage.includes('recordarme') ||
    lowerMessage.includes('tengo que') || lowerMessage.includes('necesito hacer') ||
    lowerMessage.includes('debo hacer') || lowerMessage.includes('hay que hacer') ||
    lowerMessage.includes('agregar a tareas') || lowerMessage.includes('añadir a tareas') ||
    lowerMessage.includes('poner en mi lista') || lowerMessage.includes('agregar a mi lista')) {
    const taskData = extractTaskData(message);
    return {
      intent: 'create_task',
      data: taskData
    };
  }

  // Detectar intención de agregar proyecto
  if (lowerMessage.includes('agregar proyecto') || lowerMessage.includes('nuevo proyecto')) {
    const projectName = extractProjectName(message);
    return {
      intent: 'add_project',
      data: { projectName }
    };
  }

  // Detectar intención de listar tareas
  if (lowerMessage.includes('listar tareas') || lowerMessage.includes('ver tareas')) {
    return {
      intent: 'list_tasks',
      data: {}
    };
  }

  // Detectar intención de listar proyectos
  if (lowerMessage.includes('listar proyectos') || lowerMessage.includes('ver proyectos')) {
    return {
      intent: 'list_projects',
      data: {}
    };
  }

  // Detectar intención de crear checklist
  if (lowerMessage.includes('crear checklist') || lowerMessage.includes('nueva checklist')) {
    const items = extractChecklistItems(message);
    return {
      intent: 'create_checklist',
      data: { items }
    };
  }

  // Detectar intención de crear hábito
  if (lowerMessage.includes('crear hábito') || lowerMessage.includes('nuevo hábito')) {
    const habitName = extractHabitName(message);
    return {
      intent: 'create_habit',
      data: { habitName }
    };
  }

  // Intención por defecto: conversación general
  return {
    intent: 'general_chat',
    data: { message }
  };
}

/**
 * Extrae el nombre de la tarea del mensaje.
 * @param message El mensaje del usuario.
 * @returns El nombre de la tarea o un valor por defecto.
 */
function extractTaskName(message: string): string {
  // Buscar patrones como "crear tarea [nombre]" o "nueva tarea [nombre]"
  const patterns = [
    /crear tarea (.+)/i,
    /nueva tarea (.+)/i,
    /tarea (.+)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return 'Tarea sin nombre';
}

/**
 * Extrae el nombre del proyecto del mensaje.
 * @param message El mensaje del usuario.
 * @returns El nombre del proyecto o un valor por defecto.
 */
function extractProjectName(message: string): string {
  // Buscar patrones como "agregar proyecto [nombre]" o "nuevo proyecto [nombre]"
  const patterns = [
    /agregar proyecto (.+)/i,
    /nuevo proyecto (.+)/i,
    /proyecto (.+)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return 'Proyecto sin nombre';
}

/**
 * Extrae los items de la checklist del mensaje.
 * @param message El mensaje del usuario.
 * @returns Un array de items de la checklist.
 */
function extractChecklistItems(message: string): string[] {
  // Buscar patrones como "crear checklist [items separados por comas]"
  const patterns = [
    /crear checklist (.+)/i,
    /nueva checklist (.+)/i,
    /checklist (.+)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
  }

  return [];
}

/**
 * Extrae el nombre del hábito del mensaje.
 * @param message El mensaje del usuario.
 * @returns El nombre del hábito o un valor por defecto.
 */
function extractHabitName(message: string): string {
  // Buscar patrones como "crear hábito [nombre]" o "nuevo hábito [nombre]"
  const patterns = [
    /crear hábito (.+)/i,
    /nuevo hábito (.+)/i,
    /hábito (.+)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return 'Hábito sin nombre';
}
/**
 * Convierte fechas relativas a formato ISO string.
 * @param relativeDate Fecha relativa como "mañana", "hoy", "pasado mañana", etc.
 * @returns Fecha en formato ISO string o null si no se reconoce.
 */
function parseRelativeDate(relativeDate: string): string | null {
  const lowerDate = relativeDate.toLowerCase().trim();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (lowerDate.includes('hoy') || lowerDate.includes('today')) {
    return today.toISOString().split('T')[0];
  }

  if (lowerDate.includes('mañana') || lowerDate.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  if (lowerDate.includes('pasado mañana') || lowerDate.includes('day after tomorrow')) {
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);
    return dayAfterTomorrow.toISOString().split('T')[0];
  }

  if (lowerDate.includes('esta semana') || lowerDate.includes('this week')) {
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
    return endOfWeek.toISOString().split('T')[0];
  }

  if (lowerDate.includes('próxima semana') || lowerDate.includes('next week')) {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + (7 - today.getDay()) + 1);
    return nextWeek.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Extrae datos completos de la tarea del mensaje (título, proyecto, fecha límite, prioridad).
 * @param message El mensaje del usuario.
 * @returns Un objeto con los datos extraídos de la tarea.
 */

/**
 * Extrae datos completos de la tarea del mensaje (título, proyecto, fecha límite, prioridad).
 * @param message El mensaje del usuario.
 * @returns Un objeto con los datos extraídos de la tarea.
 */
function extractTaskData(message: string): {
  title: string;
  projectName?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
} {
  let title = '';
  let projectName: string | undefined;
  let dueDate: string | undefined;
  let priority: 'low' | 'medium' | 'high' | undefined;

  // Limpiar el mensaje removiendo comandos iniciales
  let cleanMessage = message
    .replace(/^(crear|nueva|agregar|añadir|agrega|añade)\s+tarea\s*/i, '')
    .replace(/^tarea:\s*/i, '')
    .replace(/^task:\s*/i, '')
    .trim();

  // Extraer proyecto si está mencionado
  const projectMatch = cleanMessage.match(/(?:en\s+el\s+proyecto|para\s+el\s+proyecto|proyecto)\s+["']?([^"']+)["']?/i);
  if (projectMatch) {
    projectName = projectMatch[1].trim();
    cleanMessage = cleanMessage.replace(projectMatch[0], '').trim();
  }

  // Extraer prioridad
  const priorityPatterns = [
    /\b(alta|high)\b/i,
    /\b(media|medium|normal)\b/i,
    /\b(baja|low)\b/i
  ];

  for (let i = 0; i < priorityPatterns.length; i++) {
    const match = cleanMessage.match(priorityPatterns[i]);
    if (match) {
      if (i === 0) priority = 'high';
      else if (i === 1) priority = 'medium';
      else if (i === 2) priority = 'low';
      cleanMessage = cleanMessage.replace(match[0], '').trim();
      break;
    }
  }

  // Extraer fecha límite
  const datePatterns = [
    /(?:para\s+el|fecha\s+límite|due\s+date|deadline)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
    /(?:hasta\s+el|hasta)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
    /(?:el\s+)?(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i
  ];

  for (const pattern of datePatterns) {
    const match = cleanMessage.match(pattern);
    if (match && match[1]) {
      dueDate = match[1];
      cleanMessage = cleanMessage.replace(match[0], '').trim();
      break;
    }
    // Extraer fechas relativas si no se encontró fecha específica
    if (!dueDate) {
      const relativeDateWords = ['mañana', 'hoy', 'pasado mañana', 'esta semana', 'próxima semana', 'tomorrow', 'today', 'day after tomorrow', 'this week', 'next week'];
      for (const word of relativeDateWords) {
        if (cleanMessage.toLowerCase().includes(word)) {
          const parsedDate = parseRelativeDate(word);
          if (parsedDate) {
            dueDate = parsedDate;
            cleanMessage = cleanMessage.replace(new RegExp(`\\b${word}\\b`, 'i'), '').trim();
            break;
          }
        }
      }
    }

    // El resto es el título
    title = cleanMessage || 'Tarea sin título';

    // Si no hay proyecto especificado (tarea personal), asignar prioridad alta por defecto
    if (!projectName && !priority) {
      priority = 'high';
    }
  }

  // El resto es el título
  title = cleanMessage || 'Tarea sin título';

  return {
    title,
    projectName,
    dueDate,
    priority
  };
}

import { internalAI } from './internal-ai/service';

// ... (keep detectIntent and helper functions as is) ...

/**
 * Crea una nueva tarea mediante una llamada a la API.
 * @param taskData Los datos de la tarea a crear.
 * @returns Un objeto con el resultado de la operación.
 */
export async function createTask(taskData: {
  title: string;
  projectName?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
}): Promise<{ success: boolean; data?: any; error?: string }> {
  return await internalAI.execute('create_task', taskData);
}

/**
 * Crea un nuevo proyecto mediante una llamada a la API.
 * @param projectName El nombre del proyecto a crear.
 * @returns Un objeto con el resultado de la operación.
 */
export async function createProject(projectName: string): Promise<{ success: boolean; data?: any; error?: string }> {
  return await internalAI.execute('create_project', { title: projectName });
}

/**
 * Crea una nueva checklist mediante llamadas a la API.
 * @param items Los items de la checklist a crear.
 * @returns Un objeto con el resultado de la operación.
 */
export async function createChecklist(items: string[]): Promise<{ success: boolean; data?: any[]; error?: string }> {
  // Checklist action not yet fully implemented in internalAI, keeping legacy for now or mapping
  // For now, let's map it to a potential future action or keep legacy if complex
  // But to be consistent, we should register it.
  // Let's assume we will register 'create_checklist' soon.
  return await internalAI.execute('create_checklist', { items });
}

/**
 * Crea un nuevo tracker de hábitos mediante una llamada a la API.
 * @param habitName El nombre del hábito a crear.
 * @returns Un objeto con el resultado de la operación.
 */
export async function createHabit(habitName: string): Promise<{ success: boolean; data?: any; error?: string }> {
  return await internalAI.execute('create_habit', { name: habitName });
}