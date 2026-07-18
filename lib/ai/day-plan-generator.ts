import { groqAPI } from '@/lib/groq'
import { openRouterAPI } from '@/lib/openrouter'
import { executeAIAction } from '@/lib/ai/executor'
import { prisma } from '@/lib/prisma'
import type { CreateTasksAction, CreateEventAction } from '@/lib/ai/actions'

// Twin fields this generator actually reads — a subset of the full
// CognitiveTwin so callers can pass a plain object without importing the
// client-only context module.
export interface DayPlanTwinInput {
  longTermGoal?: string
  identity?: { role?: string }
  energyCurve?: { chronotype?: string; peakFocusStart?: string; peakFocusEnd?: string }
  bottlenecks?: { mainFrictionPoint?: string }
}

export type DayPlanTrigger = 'onboarding' | 'peak_focus' | 'manual'

// Real, per-user grounding: whatever concrete project the user is actually
// working on, with a real deadline — pulled from their own data, never
// hardcoded. Without this the LLM only sees role + a vague 12-month goal
// and fills the gap with generic "startup founder" tropes (pitch deck, Q3
// roadmap) that have nothing to do with what the user is actually doing.
interface ActiveProjectContext {
  title: string
  description: string
  dueDate: string | null
}

async function findActiveProject(userId: string): Promise<ActiveProjectContext | null> {
  const projects = await prisma.project.findMany({
    where: { userId, status: { not: 'completed' } },
    select: { title: true, description: true, dueDate: true },
  })
  if (projects.length === 0) return null
  // Prefer the one with the nearest real deadline; dueDate is a free-text
  // ISO string field, so sort in JS rather than lean on Prisma's null
  // ordering on a nullable String column.
  const withDeadline = projects.filter((p) => p.dueDate).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
  return withDeadline[0] || projects[0]
}

interface PlanTask {
  title: string
  category: 'Training' | 'Study' | 'Personal' | 'Work'
  priority: number
  reasoning: string
}

interface PlanEvent {
  title: string
  description?: string
}

interface RawPlan {
  tasks: PlanTask[]
  event?: PlanEvent | null
}

export interface DayPlanResult {
  tasks: any[]
  event: any | null
  reasoning: string[]
}

const ROLE_LABELS: Record<string, string> = {
  student: 'estudiante',
  founder: 'fundador de startup',
  developer: 'desarrollador',
  creator: 'creador de contenido',
  professional: 'profesional',
}

function roleLabel(role?: string): string {
  return ROLE_LABELS[role || ''] || 'profesional'
}

const SYSTEM_PROMPT = `Eres el motor de planificación de Novo, un Sistema Operativo Cognitivo. Dado el perfil de un usuario (su meta a 12 meses, su ventana de foco pico, y su principal fricción) y, si existe, su proyecto activo con fecha límite real, genera un plan de "Día 1": 2-3 tareas concretas y accionables que lo acerquen a su meta HOY, más un bloque de calendario para trabajo profundo en su ventana de foco pico.

Devuelve SOLO JSON válido (sin markdown) con exactamente esta forma:
{
  "tasks": [
    { "title": string, "category": "Training"|"Study"|"Personal"|"Work", "priority": number (1-3), "reasoning": "una oración explicando por qué esta tarea, atada explícitamente a su meta/energía/fricción" }
  ],
  "event": { "title": string, "description": string }
}

Reglas:
- 2 o 3 tareas, nunca menos ni más.
- Cada tarea debe ser específica y accionable hoy, no vaga.
- Si se te da un "Proyecto activo" con fecha límite, las tareas DEBEN referirse a ese proyecto específico y su fecha real — nunca inventes hitos genéricos de "startup" (pitch deck, roadmap trimestral, etc.) que no vengan de los datos dados.
- Si NO se te da un proyecto activo, basa las tareas solo en la meta a 12 meses y el rol — no inventes un proyecto ni una fecha que no te dieron.
- El "reasoning" de cada tarea debe mencionar explícitamente la meta, la fricción, o la energía del usuario.
- El evento es un bloque de trabajo profundo hacia la meta, para agendarse en su ventana de foco pico.
- Todo en español.`

async function generatePlanWithLLM(twin: DayPlanTwinInput, activeProject: ActiveProjectContext | null): Promise<RawPlan> {
  const goal = twin.longTermGoal?.trim() || `avanzar en su rol de ${roleLabel(twin.identity?.role)}`
  const projectLine = activeProject
    ? `Proyecto activo: "${activeProject.title}"${activeProject.dueDate ? ` — vence ${activeProject.dueDate}` : ''}${activeProject.description ? `\nDescripción del proyecto: ${activeProject.description}` : ''}`
    : 'Proyecto activo: ninguno registrado'
  const userMessage = `Meta a 12 meses: ${goal}
Rol: ${roleLabel(twin.identity?.role)}
Cronotipo: ${twin.energyCurve?.chronotype || 'desconocido'}
Ventana de foco pico: ${twin.energyCurve?.peakFocusStart || '?'} - ${twin.energyCurve?.peakFocusEnd || '?'}
Principal fricción: ${twin.bottlenecks?.mainFrictionPoint || 'desconocida'}
${projectLine}`

  let raw: string
  try {
    raw = (await groqAPI.generateResponse(userMessage, '', [], SYSTEM_PROMPT, 'qwen/qwen3-32b')).content
  } catch (groqError) {
    console.error('[DayPlanGenerator] Groq failed, trying OpenRouter:', groqError)
    raw = (await openRouterAPI.generateResponse(userMessage, '', [], SYSTEM_PROMPT, 'openai/gpt-oss-20b:free')).content
  }
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed?.tasks) || parsed.tasks.length === 0) {
    throw new Error('LLM returned no tasks')
  }
  return parsed
}

// Mirrors the heuristic fallback pattern in app/api/onboarding/analyze/route.ts
// — no LLM available, so build something reasonable from role + friction alone.
// When a real active project exists, its title replaces the generic goal
// text so even this no-LLM fallback stays grounded instead of generic.
function heuristicPlan(twin: DayPlanTwinInput, activeProject: ActiveProjectContext | null): RawPlan {
  const role = twin.identity?.role || 'professional'
  const friction = twin.bottlenecks?.mainFrictionPoint || 'lack_of_structure'
  const goal = activeProject?.title || twin.longTermGoal?.trim() || `avanzar en su rol de ${roleLabel(role)}`

  const frictionNote: Record<string, string> = {
    procrastination: 'Empezar con un paso pequeño y concreto rompe la parálisis inicial.',
    context_switching: 'Un bloque único, sin interrupciones, protege tu foco de la alternancia de tareas.',
    overcommitment: 'Priorizar una sola cosa hoy evita la sobrecarga.',
    lack_of_structure: 'Un plan explícito para hoy le da estructura a tu día.',
  }
  const note = frictionNote[friction] || frictionNote.lack_of_structure

  const roleTask: Record<string, PlanTask> = {
    student: { title: 'Dedicar 45 min a la materia más urgente relacionada con tu meta', category: 'Study', priority: 3, reasoning: `Acerca tu meta ("${goal}") con un bloque de estudio enfocado. ${note}` },
    founder: { title: 'Avanzar una tarea crítica del roadmap hacia tu meta', category: 'Work', priority: 3, reasoning: `Prioriza lo que mueve la aguja hacia "${goal}". ${note}` },
    developer: { title: 'Resolver el bloqueador técnico más importante del día', category: 'Work', priority: 3, reasoning: `Desbloquea el progreso hacia "${goal}". ${note}` },
    creator: { title: 'Producir una pieza de contenido hacia tu meta', category: 'Personal', priority: 3, reasoning: `Construye directamente hacia "${goal}". ${note}` },
    professional: { title: 'Completar la tarea más importante del día hacia tu meta', category: 'Work', priority: 3, reasoning: `Prioriza lo que más importa para "${goal}". ${note}` },
  }

  const tasks: PlanTask[] = [
    roleTask[role] || roleTask.professional,
    { title: 'Revisar y organizar tu lista de pendientes de la semana', category: 'Personal', priority: 2, reasoning: `Reduce la fricción de "${friction}" dejando claro qué sigue.` },
  ]

  return {
    tasks,
    event: { title: `Bloque de foco profundo — ${goal}`, description: `Trabajo profundo reservado en tu ventana de energía pico hacia: ${goal}` },
  }
}

// If the peak-focus window has already passed today, push it to tomorrow.
// Handles overnight windows (e.g. night owl 20:00-01:00) by rolling the end
// past midnight when it's earlier than the start.
function resolveEventWindow(peakFocusStart?: string, peakFocusEnd?: string): { start: Date; end: Date } | null {
  if (!peakFocusStart || !peakFocusEnd) return null
  const [sh, sm] = peakFocusStart.split(':').map(Number)
  const [eh, em] = peakFocusEnd.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em)
  if (end <= start) end.setDate(end.getDate() + 1)

  if (start <= now) {
    start.setDate(start.getDate() + 1)
    end.setDate(end.getDate() + 1)
  }
  return { start, end }
}

// Generates a calibrated "Day 1" plan (2-3 tasks + a deep-work calendar
// block) from the user's Twin, and actually creates it via the real
// execution pipeline — not just returned as suggestions.
export async function generateAndExecuteDayPlan(
  userId: string,
  twin: DayPlanTwinInput,
  trigger: DayPlanTrigger
): Promise<DayPlanResult> {
  const activeProject = await findActiveProject(userId).catch(() => null)

  let plan: RawPlan
  try {
    plan = await generatePlanWithLLM(twin, activeProject)
  } catch (error) {
    console.error(`[DayPlanGenerator] LLM unavailable (trigger=${trigger}), using heuristic fallback:`, error)
    plan = heuristicPlan(twin, activeProject)
  }

  const tasksAction: CreateTasksAction = {
    type: 'CREATE_TASKS',
    payload: {
      tasks: plan.tasks.map((t) => ({ title: t.title, category: t.category, priority: t.priority })),
    },
  }
  const tasksResult = await executeAIAction(tasksAction, userId)
  const createdTasks = tasksResult.success ? (tasksResult.data as any[]) ?? [] : []

  // Fire-and-forget-ish: a calendar failure must never block the tasks that
  // already got created above.
  let createdEvent: any | null = null
  const window = resolveEventWindow(twin.energyCurve?.peakFocusStart, twin.energyCurve?.peakFocusEnd)
  if (window && plan.event) {
    try {
      const eventAction: CreateEventAction = {
        type: 'CREATE_EVENT',
        payload: {
          title: plan.event.title,
          description: plan.event.description,
          start: window.start.toISOString(),
          end: window.end.toISOString(),
          allDay: false,
        },
      }
      const eventResult = await executeAIAction(eventAction, userId)
      if (eventResult.success) createdEvent = eventResult.data
    } catch (error) {
      console.error('[DayPlanGenerator] Calendar event creation failed (non-blocking):', error)
    }
  }

  return {
    tasks: createdTasks,
    event: createdEvent,
    reasoning: plan.tasks.map((t) => t.reasoning).filter(Boolean),
  }
}
