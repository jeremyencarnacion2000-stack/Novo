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

// The engine used to always write in Spanish regardless of the user's own
// language setting — found via /qa: a user with language:"en" still got
// Spanish-only Day 1 plans. Only 'es'/'en' are modeled (the two languages
// with real content coverage elsewhere in the app); any other stored
// language value falls back to Spanish, matching the app's existing default.
type Lang = 'es' | 'en'

function resolveLang(language: string | null | undefined): Lang {
  return language === 'en' ? 'en' : 'es'
}

const ROLE_LABELS: Record<Lang, Record<string, string>> = {
  es: {
    student: 'estudiante',
    founder: 'fundador de startup',
    developer: 'desarrollador',
    creator: 'creador de contenido',
    professional: 'profesional',
  },
  en: {
    student: 'student',
    founder: 'startup founder',
    developer: 'developer',
    creator: 'content creator',
    professional: 'professional',
  },
}

function roleLabel(role: string | undefined, lang: Lang): string {
  return ROLE_LABELS[lang][role || ''] || ROLE_LABELS[lang].professional
}

const SYSTEM_PROMPTS: Record<Lang, string> = {
  es: `Eres el motor de planificación de Novo, un Sistema Operativo Cognitivo. Dado el perfil de un usuario (su meta a 12 meses, su ventana de foco pico, y su principal fricción) y, si existe, su proyecto activo con fecha límite real, genera un plan de "Día 1": 2-3 tareas concretas y accionables que lo acerquen a su meta HOY, más un bloque de calendario para trabajo profundo en su ventana de foco pico.

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
- Todo en español.`,
  en: `You are Novo's planning engine, a Cognitive Operating System. Given a user's profile (their 12-month goal, peak focus window, and main friction point) and, if it exists, their active project with a real deadline, generate a "Day 1" plan: 2-3 concrete, actionable tasks that move them toward their goal TODAY, plus a calendar block for deep work in their peak focus window.

Return ONLY valid JSON (no markdown) in exactly this shape:
{
  "tasks": [
    { "title": string, "category": "Training"|"Study"|"Personal"|"Work", "priority": number (1-3), "reasoning": "one sentence explaining why this task, explicitly tied to their goal/energy/friction" }
  ],
  "event": { "title": string, "description": string }
}

Rules:
- 2 or 3 tasks, never fewer or more.
- Each task must be specific and actionable today, not vague.
- If given an "Active project" with a deadline, tasks MUST reference that specific project and its real date — never invent generic "startup" milestones (pitch deck, quarterly roadmap, etc.) that don't come from the given data.
- If NO active project is given, base tasks only on the 12-month goal and role — don't invent a project or date you weren't given.
- Each task's "reasoning" must explicitly mention the user's goal, friction, or energy.
- The event is a deep-work block toward the goal, scheduled in their peak focus window.
- Everything in English.`,
}

async function generatePlanWithLLM(twin: DayPlanTwinInput, activeProject: ActiveProjectContext | null, lang: Lang): Promise<RawPlan> {
  const goal = twin.longTermGoal?.trim() || (lang === 'en' ? `advancing in their role as ${roleLabel(twin.identity?.role, lang)}` : `avanzar en su rol de ${roleLabel(twin.identity?.role, lang)}`)
  const projectLine = lang === 'en'
    ? (activeProject
        ? `Active project: "${activeProject.title}"${activeProject.dueDate ? ` — due ${activeProject.dueDate}` : ''}${activeProject.description ? `\nProject description: ${activeProject.description}` : ''}`
        : 'Active project: none on record')
    : (activeProject
        ? `Proyecto activo: "${activeProject.title}"${activeProject.dueDate ? ` — vence ${activeProject.dueDate}` : ''}${activeProject.description ? `\nDescripción del proyecto: ${activeProject.description}` : ''}`
        : 'Proyecto activo: ninguno registrado')
  const userMessage = lang === 'en'
    ? `12-month goal: ${goal}
Role: ${roleLabel(twin.identity?.role, lang)}
Chronotype: ${twin.energyCurve?.chronotype || 'unknown'}
Peak focus window: ${twin.energyCurve?.peakFocusStart || '?'} - ${twin.energyCurve?.peakFocusEnd || '?'}
Main friction: ${twin.bottlenecks?.mainFrictionPoint || 'unknown'}
${projectLine}`
    : `Meta a 12 meses: ${goal}
Rol: ${roleLabel(twin.identity?.role, lang)}
Cronotipo: ${twin.energyCurve?.chronotype || 'desconocido'}
Ventana de foco pico: ${twin.energyCurve?.peakFocusStart || '?'} - ${twin.energyCurve?.peakFocusEnd || '?'}
Principal fricción: ${twin.bottlenecks?.mainFrictionPoint || 'desconocida'}
${projectLine}`

  const systemPrompt = SYSTEM_PROMPTS[lang]
  let raw: string
  try {
    raw = (await groqAPI.generateResponse(userMessage, '', [], systemPrompt, 'openai/gpt-oss-120b')).content
  } catch (groqError) {
    console.error('[DayPlanGenerator] Groq failed, trying OpenRouter:', groqError)
    raw = (await openRouterAPI.generateResponse(userMessage, '', [], systemPrompt, 'openai/gpt-oss-20b:free')).content
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
function heuristicPlan(twin: DayPlanTwinInput, activeProject: ActiveProjectContext | null, lang: Lang): RawPlan {
  const role = twin.identity?.role || 'professional'
  const friction = twin.bottlenecks?.mainFrictionPoint || 'lack_of_structure'
  const goal = activeProject?.title || twin.longTermGoal?.trim() || (lang === 'en' ? `advancing in their role as ${roleLabel(role, lang)}` : `avanzar en su rol de ${roleLabel(role, lang)}`)

  const frictionNotes: Record<Lang, Record<string, string>> = {
    es: {
      procrastination: 'Empezar con un paso pequeño y concreto rompe la parálisis inicial.',
      context_switching: 'Un bloque único, sin interrupciones, protege tu foco de la alternancia de tareas.',
      overcommitment: 'Priorizar una sola cosa hoy evita la sobrecarga.',
      lack_of_structure: 'Un plan explícito para hoy le da estructura a tu día.',
    },
    en: {
      procrastination: 'Starting with one small, concrete step breaks the initial paralysis.',
      context_switching: 'A single, uninterrupted block protects your focus from task-switching.',
      overcommitment: 'Prioritizing just one thing today avoids overload.',
      lack_of_structure: 'An explicit plan for today gives your day structure.',
    },
  }
  const note = frictionNotes[lang][friction] || frictionNotes[lang].lack_of_structure

  const roleTasks: Record<Lang, Record<string, PlanTask>> = {
    es: {
      student: { title: 'Dedicar 45 min a la materia más urgente relacionada con tu meta', category: 'Study', priority: 3, reasoning: `Acerca tu meta ("${goal}") con un bloque de estudio enfocado. ${note}` },
      founder: { title: 'Avanzar una tarea crítica del roadmap hacia tu meta', category: 'Work', priority: 3, reasoning: `Prioriza lo que mueve la aguja hacia "${goal}". ${note}` },
      developer: { title: 'Resolver el bloqueador técnico más importante del día', category: 'Work', priority: 3, reasoning: `Desbloquea el progreso hacia "${goal}". ${note}` },
      creator: { title: 'Producir una pieza de contenido hacia tu meta', category: 'Personal', priority: 3, reasoning: `Construye directamente hacia "${goal}". ${note}` },
      professional: { title: 'Completar la tarea más importante del día hacia tu meta', category: 'Work', priority: 3, reasoning: `Prioriza lo que más importa para "${goal}". ${note}` },
    },
    en: {
      student: { title: 'Spend 45 min on the most urgent subject related to your goal', category: 'Study', priority: 3, reasoning: `Moves you toward your goal ("${goal}") with a focused study block. ${note}` },
      founder: { title: 'Advance one critical roadmap task toward your goal', category: 'Work', priority: 3, reasoning: `Prioritizes what moves the needle toward "${goal}". ${note}` },
      developer: { title: "Resolve today's most important technical blocker", category: 'Work', priority: 3, reasoning: `Unblocks progress toward "${goal}". ${note}` },
      creator: { title: 'Produce one piece of content toward your goal', category: 'Personal', priority: 3, reasoning: `Builds directly toward "${goal}". ${note}` },
      professional: { title: "Complete today's single most important task toward your goal", category: 'Work', priority: 3, reasoning: `Prioritizes what matters most for "${goal}". ${note}` },
    },
  }

  const weeklyReviewTask: Record<Lang, PlanTask> = {
    es: { title: 'Revisar y organizar tu lista de pendientes de la semana', category: 'Personal', priority: 2, reasoning: `Reduce la fricción de "${friction}" dejando claro qué sigue.` },
    en: { title: "Review and organize this week's to-do list", category: 'Personal', priority: 2, reasoning: `Reduces the friction of "${friction}" by making the next step clear.` },
  }

  const tasks: PlanTask[] = [
    roleTasks[lang][role] || roleTasks[lang].professional,
    weeklyReviewTask[lang],
  ]

  return {
    tasks,
    event: lang === 'en'
      ? { title: `Deep focus block — ${goal}`, description: `Deep work reserved in your peak energy window toward: ${goal}` }
      : { title: `Bloque de foco profundo — ${goal}`, description: `Trabajo profundo reservado en tu ventana de energía pico hacia: ${goal}` },
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
  const [activeProject, userSettings] = await Promise.all([
    findActiveProject(userId).catch(() => null),
    prisma.userSettings.findUnique({ where: { userId }, select: { language: true } }).catch(() => null),
  ])
  const lang = resolveLang(userSettings?.language)

  let plan: RawPlan
  try {
    plan = await generatePlanWithLLM(twin, activeProject, lang)
  } catch (error) {
    console.error(`[DayPlanGenerator] LLM unavailable (trigger=${trigger}), using heuristic fallback:`, error)
    plan = heuristicPlan(twin, activeProject, lang)
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
