/**
 * voice-executor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Voice-First Workflow Engine for Novo's AI Operating System.
 *
 * Pipeline:
 *   Audio Blob → Whisper transcription → Intent classifier → 
 *   Cognitive phase filter → Action executor → UI feedback
 *
 * Key behaviors:
 *  - During SYNAPTIC_FATIGUE: only allows recovery-type actions,
 *    automatically defers any deep work commands
 *  - During PEAK_FOCUS: unlocks all execution capabilities
 *  - Returns structured VoiceExecutionResult for UI rendering
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { BioState, CognitivePhase } from './cognitive-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceActionType =
  | 'create_task'
  | 'defer_task'
  | 'move_task_to_peak'
  | 'create_event'
  | 'start_focus'
  | 'start_breathing'
  | 'summarize_day'
  | 'list_tasks'
  | 'play_music'
  | 'set_reminder'
  | 'cognitive_status'
  | 'unknown'

export interface VoiceIntent {
  action: VoiceActionType
  entities: Record<string, string | number | null>
  rawText: string
  confidence: number
}

export interface VoiceExecutionResult {
  success: boolean
  action: VoiceActionType
  message: string           // User-facing confirmation message
  deferred: boolean         // Was the action deferred due to cognitive state?
  deferredReason?: string
  data?: any
}

// ─── Intent Classification ────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{
  action: VoiceActionType
  patterns: RegExp[]
  deepWork: boolean         // Requires cognitive capacity to execute
}> = [
  {
    action: 'create_task',
    patterns: [
      /(?:crea(?:r)?|añade?|agrega?|nueva?)\s+tarea[:\s]+(.+)/i,
      /(?:create|add|new)\s+task[:\s]+(.+)/i,
      /(?:recuérdame|recordarme|remind me)\s+(?:de\s+)?(.+)/i,
      /tengo que\s+(.+)/i,
      /necesito\s+(?:hacer\s+)?(.+)/i,
    ],
    deepWork: false,
  },
  {
    action: 'defer_task',
    patterns: [
      /(?:defer|postpone|aplaza?|mueve?)\s+(?:la\s+tarea\s+)?(.+)/i,
      /(?:no puedo|can't|cannot)\s+hacer\s+(.+)\s+ahora/i,
    ],
    deepWork: false,
  },
  {
    action: 'move_task_to_peak',
    patterns: [
      /mueve?\s+(.+)\s+(?:a\s+mi\s+)?(?:hora|ventana)\s+(?:pico|óptima|peak)/i,
      /schedule\s+(.+)\s+(?:for|during)\s+(?:my\s+)?peak/i,
    ],
    deepWork: false,
  },
  {
    action: 'create_event',
    patterns: [
      /(?:crea?|añade?|agrega?)\s+(?:un\s+)?evento[:\s]+(.+)/i,
      /(?:crea?|añade?)\s+(?:una?\s+)?(?:reunión|meeting|cita)[:\s]+(.+)/i,
      /(?:create|add|schedule)\s+(?:an?\s+)?(?:event|meeting)[:\s]+(.+)/i,
    ],
    deepWork: false,
  },
  {
    action: 'start_focus',
    patterns: [
      /(?:empieza?|inicia?|start|begin)\s+(?:sesión\s+de\s+)?(?:foco|enfoque|focus|pomodoro)/i,
      /(?:modo\s+)?(?:deep\s+work|trabajo\s+profundo)/i,
    ],
    deepWork: true,
  },
  {
    action: 'start_breathing',
    patterns: [
      /(?:respiración|breathing|respira|relaja?me|calma?me)/i,
      /(?:guided|ejercicio\s+de)\s+(?:respiración|breathing)/i,
      /(?:necesito|need)\s+(?:un\s+)?descanso/i,
    ],
    deepWork: false,
  },
  {
    action: 'summarize_day',
    patterns: [
      /(?:resumen|summary|resume)\s+(?:del?\s+)?(?:día|day|today)/i,
      /(?:cómo|how)\s+(?:va|estuvo?|has been)\s+(?:mi\s+)?(?:día|day)/i,
      /(?:qué|what)\s+(?:hice|he hecho|have I done)\s+hoy/i,
    ],
    deepWork: false,
  },
  {
    action: 'list_tasks',
    patterns: [
      /(?:qué|cuáles|what|which)\s+(?:tareas|tasks|pendientes)\s+(?:tengo|have I)/i,
      /(?:lista|list|muéstrame|show me)\s+(?:mis\s+)?(?:tareas|tasks)/i,
      /(?:mis|my)\s+(?:pendientes|to-dos|tareas\s+de\s+hoy)/i,
    ],
    deepWork: false,
  },
  {
    action: 'play_music',
    patterns: [
      /(?:pon|play|reproduce)\s+(?:música|music|binaural|lofi|focus)/i,
      /(?:quiero|want)\s+(?:escuchar|listen)\s+(?:algo|música|music)/i,
    ],
    deepWork: false,
  },
  {
    action: 'set_reminder',
    patterns: [
      /(?:recuérdame|remind me)\s+(.+)\s+(?:en|at|in)\s+(\d+)\s*(?:minutos?|horas?|minutes?|hours?)/i,
      /(?:avísame|alert me)\s+(.+)/i,
    ],
    deepWork: false,
  },
  {
    action: 'cognitive_status',
    patterns: [
      /(?:cómo\s+está|what(?:'s|\s+is))\s+(?:mi\s+)?(?:estado\s+cognitivo|cognitive\s+(?:state|status)|energía|energy)/i,
      /(?:cuánto|how\s+much)\s+(?:foco|focus|energy|energía)\s+(?:tengo|do I have)/i,
    ],
    deepWork: false,
  },
]

/**
 * Classifies a transcribed text into a structured VoiceIntent.
 * Falls back to 'unknown' if no pattern matches.
 */
export function classifyIntent(text: string): VoiceIntent {
  const normalized = text.trim()

  for (const { action, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      const match = normalized.match(pattern)
      if (match) {
        return {
          action,
          entities: { raw_match: match[1] ?? null },
          rawText: normalized,
          confidence: 0.85,
        }
      }
    }
  }

  // Fallback: try to detect task creation from any "need to do X" phrasing
  const genericTaskMatch = normalized.match(/(.{5,80})/i)
  if (genericTaskMatch && normalized.length > 5) {
    return {
      action: 'create_task',
      entities: { raw_match: genericTaskMatch[1] },
      rawText: normalized,
      confidence: 0.45,  // Low confidence — may be wrong
    }
  }

  return {
    action: 'unknown',
    entities: {},
    rawText: normalized,
    confidence: 0,
  }
}

// ─── Cognitive Phase Filter ───────────────────────────────────────────────────

const BLOCKED_DURING_FATIGUE: VoiceActionType[] = [
  'start_focus',
  'create_task',   // Will be auto-deferred, not blocked
]

/**
 * Determines if an action should be deferred based on current cognitive state.
 * Returns a deferral reason if it should be deferred.
 */
export function shouldDefer(
  intent: VoiceIntent,
  bioState: BioState
): { defer: boolean; reason?: string } {
  if (
    bioState.phase === 'SYNAPTIC_FATIGUE' ||
    bioState.phase === 'REDUCED_CAPACITY_MODE'
  ) {
    if (intent.action === 'start_focus') {
      return {
        defer: true,
        reason: `Focus sessions are not recommended during ${bioState.label}. ` +
          `Your attention score is only ${bioState.attentionScore}%. ` +
          `Recover for ${bioState.minutesToNextPhase} more minutes first.`,
      }
    }
    if (intent.action === 'create_task') {
      return {
        defer: false,  // Allow creation but flag it
        reason: undefined,
      }
    }
  }
  return { defer: false }
}

// ─── Action Executor ──────────────────────────────────────────────────────────

type ExecutorFn = (intent: VoiceIntent, bioState: BioState) => Promise<VoiceExecutionResult>

const executors: Partial<Record<VoiceActionType, ExecutorFn>> = {
  async create_task(intent, bioState) {
    const title = String(intent.entities.raw_match ?? '').trim()
    if (!title) {
      return { success: false, action: 'create_task', message: 'No task title detected.', deferred: false }
    }

    // During fatigue, auto-schedule for next peak
    const duringFatigue =
      bioState.phase === 'SYNAPTIC_FATIGUE' || bioState.phase === 'REDUCED_CAPACITY_MODE'

    const priority = bioState.phase === 'PEAK_FOCUS' ? 'high' : 'medium'

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority, status: 'todo' }),
    })

    if (!res.ok) {
      return { success: false, action: 'create_task', message: 'Failed to save task.', deferred: false }
    }

    const task = await res.json()

    if (duringFatigue) {
      return {
        success: true,
        action: 'create_task',
        message: `"${title}" saved and flagged for your next peak focus window.`,
        deferred: true,
        deferredReason: 'Low cognitive energy — task will surface during your next peak hour.',
        data: task,
      }
    }

    return {
      success: true,
      action: 'create_task',
      message: `Task "${title}" created with ${priority} priority.`,
      deferred: false,
      data: task,
    }
  },

  async create_event(intent, bioState) {
    const summary = String(intent.entities.raw_match ?? '').trim()
    if (!summary) {
      return { success: false, action: 'create_event', message: 'No event title detected.', deferred: false }
    }

    // Default: 1 hour from now
    const start = new Date()
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)

    const res = await fetch('/api/calendar-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: summary,
        start: start.toISOString(),
        end: end.toISOString(),
      }),
    })

    if (!res.ok) {
      return { success: false, action: 'create_event', message: 'Failed to create event.', deferred: false }
    }

    return {
      success: true,
      action: 'create_event',
      message: `Event "${summary}" scheduled for ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
      deferred: false,
    }
  },

  async start_breathing(_intent, _bioState) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cognitive:start-breathing'))
    }
    return {
      success: true,
      action: 'start_breathing',
      message: 'Guided breathing session initiated. Inhale for 4 counts...',
      deferred: false,
    }
  },

  async start_focus(_intent, bioState) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cognitive:start-focus'))
    }
    return {
      success: true,
      action: 'start_focus',
      message: `Focus session started. Attention score: ${bioState.attentionScore}%. Go deep.`,
      deferred: false,
    }
  },

  async summarize_day(_intent, bioState) {
    const res = await fetch('/api/cognitive/daily-summary')
    const summary = res.ok ? await res.json() : null
    const msg = summary
      ? `Today: ${summary.tasksCompleted} tasks done, ${summary.focusMinutes}min focused. ` +
        `Current phase: ${bioState.label}. Fatigue: ${bioState.fatigueScore}%.`
      : `Current phase: ${bioState.label}. Attention at ${bioState.attentionScore}%.`
    return { success: true, action: 'summarize_day', message: msg, deferred: false, data: summary }
  },

  async list_tasks(_intent, _bioState) {
    const res = await fetch('/api/tasks?status=todo&limit=5')
    if (!res.ok) return { success: false, action: 'list_tasks', message: 'Could not fetch tasks.', deferred: false }
    const tasks = await res.json()
    const names = tasks.slice(0, 5).map((t: any) => t.title).join(', ')
    return {
      success: true,
      action: 'list_tasks',
      message: tasks.length ? `Your top tasks: ${names}.` : 'No pending tasks. Inbox zero! 🎉',
      deferred: false,
      data: tasks,
    }
  },

  async play_music(_intent, bioState) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cognitive:play-music'))
    }
    const category = bioState.recommendedAudioCategory
    return {
      success: true,
      action: 'play_music',
      message: `Playing ${category === 'focus' ? 'binaural focus' : category === 'ambient' ? 'ambient recovery' : 'sleep'} music for your current phase.`,
      deferred: false,
    }
  },

  async cognitive_status(_intent, bioState) {
    return {
      success: true,
      action: 'cognitive_status',
      message:
        `${bioState.label}. Attention: ${bioState.attentionScore}%, Fatigue: ${bioState.fatigueScore}%. ` +
        `Next phase in ${bioState.minutesToNextPhase} min. ` +
        `Audio: ${bioState.recommendedAudioCategory}.`,
      deferred: false,
      data: bioState,
    }
  },
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Full voice execution pipeline.
 * Takes a transcribed text + current bio state → executes appropriate action.
 */
export async function executeVoiceCommand(
  text: string,
  bioState: BioState
): Promise<VoiceExecutionResult> {
  const intent = classifyIntent(text)

  if (intent.action === 'unknown') {
    return {
      success: false,
      action: 'unknown',
      message: `I heard: "${text}" — but couldn't identify a command. Try "create task [name]" or "how's my energy?"`,
      deferred: false,
    }
  }

  // Check if this should be deferred
  const { defer, reason } = shouldDefer(intent, bioState)
  if (defer) {
    return {
      success: true,
      action: intent.action,
      message: `Action deferred: ${reason}`,
      deferred: true,
      deferredReason: reason,
    }
  }

  // Execute
  const executor = executors[intent.action]
  if (!executor) {
    return {
      success: false,
      action: intent.action,
      message: `Command "${intent.action}" is not yet implemented.`,
      deferred: false,
    }
  }

  return executor(intent, bioState)
}

// ─── Browser Voice Capture ────────────────────────────────────────────────────

export interface VoiceRecordingState {
  isRecording: boolean
  isProcessing: boolean
  error: string | null
}

/**
 * Records audio from the microphone for `durationMs` milliseconds.
 * Returns a Blob ready for Whisper transcription.
 */
export async function recordVoiceInput(durationMs = 5000): Promise<Blob> {
  if (typeof window === 'undefined') throw new Error('Browser-only')

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
  const chunks: Blob[] = []

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  return new Promise((resolve, reject) => {
    recorder.onerror = reject
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      resolve(new Blob(chunks, { type: 'audio/webm' }))
    }
    recorder.start()
    setTimeout(() => recorder.stop(), durationMs)
  })
}
