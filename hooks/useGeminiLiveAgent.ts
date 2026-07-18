'use client'

/**
 * useGeminiLiveAgent.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React Hook for the Novo Heritage Real-Time Cognitive Voice Agent.
 *
 * Establishes a low-latency, bidirectional WebSocket connection with the
 * Gemini Multimodal Live API (models/gemini-2.0-flash-exp).
 *
 * Implements:
 *  1. Mic Stream Capture & Downsampling (Client to Gemini: 16kHz 16-bit Mono PCM).
 *  2. High-Fidelity Audio Queue Scheduling (Gemini to Client: 24kHz 16-bit Mono PCM).
 *  3. Dynamic Interruption (purges queue on barge-in / speaker start).
 *  4. Gemini Function Calling / Tools Router:
 *     - MapsToSection(sectionName)
 *     - playCircadianMusic(moodPreference)
 *     - scheduleCognitiveEvent(title, durationMinutes)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayerStore } from '@/lib/player-store'
import { useCognitiveEngine } from '@/lib/cognitive-context'

// ─── Constants ───────────────────────────────────────────────────────────────
const GEMINI_LIVE_MODEL = 'models/gemini-2.0-flash-exp'
const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

export type AgentState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'error'

export interface UseGeminiLiveAgentOptions {
  apiKey?: string
  systemInstruction?: string
}

export function useGeminiLiveAgent(options: UseGeminiLiveAgentOptions = {}) {
  const router = useRouter()
  const playerStore = usePlayerStore()
  const cognitiveEngine = useCognitiveEngine()

  // ─── State ─────────────────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [agentState, setAgentState] = useState<AgentState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null)
  
  // Real-time transcript tracking
  const [userTranscript, setUserTranscript] = useState('')
  const [agentTranscript, setAgentTranscript] = useState('')

  // ─── Audio Nodes & Streams Refs ────────────────────────────────────────────
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  
  // WebSockets Ref
  const wsRef = useRef<WebSocket | null>(null)
  
  // Playback queue tracking variables
  const nextPlayTimeRef = useRef<number>(0)
  const isAgentGeneratingRef = useRef<boolean>(false)

  // ─── Downsampling Helper ────────────────────────────────────────────────────
  /**
   * Resamples floating-point audio buffer to 16kHz Int16 PCM array.
   */
  const downsampleBuffer = (
    buffer: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number = 16000
  ): Int16Array => {
    if (inputSampleRate === outputSampleRate) {
      const output = new Int16Array(buffer.length)
      for (let i = 0; i < buffer.length; i++) {
        output[i] = Math.min(1, Math.max(-1, buffer[i])) * 0x7fff
      }
      return output
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate
    const newLength = Math.round(buffer.length / sampleRateRatio)
    const result = new Int16Array(newLength)
    let offsetResult = 0
    let offsetBuffer = 0

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
      let accum = 0
      let count = 0
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i]
        count++
      }
      if (count > 0) {
        result[offsetResult] = Math.min(1, Math.max(-1, accum / count)) * 0x7fff
      }
      offsetResult++
      offsetBuffer = nextOffsetBuffer
    }
    return result
  }

  // ─── Base64 & Buffer Conversion Helpers ─────────────────────────────────────
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = window.atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  // ─── Purge Audio Playback Queue (Interruption) ──────────────────────────────
  const purgeAudioQueue = useCallback(() => {
    console.log('[GeminiLiveAgent] User barged in: Interrupting active playback queue')
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop()
      } catch (e) {
        // Source might have finished playing already
      }
    })
    activeSourcesRef.current = []
    nextPlayTimeRef.current = 0
    setAgentState('listening')
  }, [])

  // ─── Speaker Playback Queue Scheduler ───────────────────────────────────────
  const scheduleAudioChunk = useCallback((base64Data: string) => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current

    // Gemini returns 24kHz raw mono 16-bit PCM
    const arrayBuffer = base64ToArrayBuffer(base64Data)
    const int16Data = new Int16Array(arrayBuffer)
    const float32Data = new Float32Array(int16Data.length)
    
    // Normalize into floating points (-1.0 to 1.0)
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0
    }

    // Create browser Audio Buffer at 24kHz
    const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000)
    audioBuffer.getChannelData(0).set(float32Data)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    // Push source to active list for interruption handling
    activeSourcesRef.current.push(source)
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source)
      if (activeSourcesRef.current.length === 0 && !isAgentGeneratingRef.current) {
        setAgentState('listening')
      }
    }

    // Schedule playbacks back-to-back dynamically
    const currentTime = ctx.currentTime
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime + 0.03 // slight safety padding
    }

    source.start(nextPlayTimeRef.current)
    nextPlayTimeRef.current += audioBuffer.duration
    setAgentState('speaking')
  }, [])

  // ─── Local Function Execution (Function Calling) ──────────────────────────
  const executeLocalTool = useCallback(async (name: string, args: any) => {
    console.log(`[GeminiLiveAgent] Executing tool: ${name}`, args)

    // ── Signal THINKING state to the UI ──
    const thinkingLabels: Record<string, string> = {
      MapsToSection: `Navegando a ${args.sectionName || '...'}`,
      playCircadianMusic: `Activando música ${args.moodPreference || 'focus'}...`,
      scheduleCognitiveEvent: `Agendando "${args.title || 'Bloque cognitivo'}"...`,
      manageTask: `${args.action === 'create' ? 'Creando tarea...' : args.action === 'update' ? 'Actualizando tarea...' : args.action === 'delete' ? 'Eliminando tarea...' : 'Consultando tareas...'}`,
      manageProject: `${args.action === 'create' ? 'Creando proyecto...' : args.action === 'update' ? 'Actualizando proyecto...' : args.action === 'delete' ? 'Eliminando proyecto...' : 'Consultando proyectos...'}`,
      manageMusic: `${args.action === 'play' ? (args.trackName ? `Buscando "${args.trackName}"...` : 'Reproduciendo...') : args.action === 'pause' ? 'Pausando...' : args.action === 'next' ? 'Siguiente canción...' : args.action === 'previous' ? 'Canción anterior...' : 'Ajustando volumen...'}`,
    }
    setAgentState('thinking')
    setThinkingMessage(thinkingLabels[name] || 'Procesando...')

    try {
      if (name === 'MapsToSection') {
        const section = args.sectionName?.toLowerCase() || 'dashboard'
        
        // Custom route path mapping
        let targetPath = '/'
        if (section === 'style') targetPath = '/style'
        else if (section === 'calendar') targetPath = '/calendar'
        else if (section === 'habits') targetPath = '/habits'
        else if (section === 'music') targetPath = '/music'
        else if (section === 'settings') targetPath = '/settings'
        
        console.log(`[GeminiLiveAgent] Navigation trigger: routing to ${targetPath}`)
        
        // Use View Transitions API if supported for fluid premium morphing
        if ((document as any).startViewTransition) {
          (document as any).startViewTransition(() => {
            router.push(targetPath)
          })
        } else {
          router.push(targetPath)
        }

        setThinkingMessage(null)
        return { status: 'success', navigatedTo: section, path: targetPath }
      }
      
      if (name === 'playCircadianMusic') {
        const mood = args.moodPreference || 'focus'
        console.log(`[GeminiLiveAgent] Play circadian music triggered: Mood = ${mood}`)
        
        // Dispatch Custom Event to wake the ContextHub and switch tabs
        window.dispatchEvent(new CustomEvent('cognitive:play-music', {
          detail: { mood }
        }))
        
        setThinkingMessage(null)
        return { status: 'success', moodActivated: mood }
      }
      
      if (name === 'scheduleCognitiveEvent') {
        const title = args.title || 'Focus block'
        const duration = args.durationMinutes || 25
        
        console.log(`[GeminiLiveAgent] Schedule cognitive event: "${title}" for ${duration} min`)
        
        // ── Semantic CRUD: Persist to DB via /api/checklist ──
        try {
          const dueDate = new Date()
          dueDate.setMinutes(dueDate.getMinutes() + duration)
          await fetch('/api/checklist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `${title} (${duration} min)`,
              priority: 'high',
              source: 'cognitive-agent',
              dueDate: dueDate.toISOString(),
            }),
          })
          console.log(`[GeminiLiveAgent] Event persisted to DB: "${title}"`)
        } catch (dbErr) {
          console.warn('[GeminiLiveAgent] Failed to persist event to DB:', dbErr)
        }

        // Log cognitive fatigue cost
        cognitiveEngine.logHabit(0.15)
        
        // Dispatch global event to refresh calendar UI instantly
        window.dispatchEvent(new CustomEvent('cognitive:schedule-event', {
          detail: { title, durationMinutes: duration }
        }))

        setThinkingMessage(null)
        return { status: 'success', scheduledEvent: title, durationMinutes: duration }
      }

      if (name === 'manageTask') {
        const { action, taskId, title, status, priority, projectId } = args
        console.log(`[GeminiLiveAgent] manageTask: ${action}`, args)
        
        if (action === 'create') {
          if (!title) return { status: 'error', message: 'Title is required to create a task.' }
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, status: status || 'todo', priority: priority || 'medium', projectId }),
          })
          if (!res.ok) {
            const errData = await res.json()
            return { status: 'error', message: 'Failed to create task.', details: errData }
          }
          const task = await res.json()
          
          window.dispatchEvent(new CustomEvent('voice-command-executed', {
            detail: { action: 'create_task', data: task }
          }))
          
          setThinkingMessage(null)
          return { status: 'success', message: `Task "${title}" created successfully.`, task }
        }
        
        if (action === 'update') {
          if (!taskId) return { status: 'error', message: 'TaskId is required to update a task.' }
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, status, priority, projectId }),
          })
          if (!res.ok) {
            const errData = await res.json()
            return { status: 'error', message: 'Failed to update task.', details: errData }
          }
          const task = await res.json()
          
          window.dispatchEvent(new CustomEvent('voice-command-executed', {
            detail: { action: 'update_task', data: task }
          }))
          
          setThinkingMessage(null)
          return { status: 'success', message: `Task was updated successfully.`, task }
        }
        
        if (action === 'delete') {
          if (!taskId) return { status: 'error', message: 'TaskId is required to delete a task.' }
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
          })
          if (!res.ok) {
            const errData = await res.json()
            return { status: 'error', message: 'Failed to delete task.', details: errData }
          }
          
          window.dispatchEvent(new CustomEvent('voice-command-executed', {
            detail: { action: 'delete_task', taskId }
          }))
          
          setThinkingMessage(null)
          return { status: 'success', message: 'Task deleted successfully.' }
        }
        
        if (action === 'list') {
          let url = '/api/tasks'
          const params = new URLSearchParams()
          if (projectId) params.append('projectId', projectId)
          if (status) params.append('status', status)
          if (params.toString()) url += `?${params.toString()}`
          
          const res = await fetch(url)
          if (!res.ok) return { status: 'error', message: 'Failed to fetch tasks.' }
          const tasks = await res.json()
          
          setThinkingMessage(null)
          return { status: 'success', tasks: tasks.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })) }
        }
        
        return { status: 'error', message: `Action "${action}" not recognized.` }
      }
      
      if (name === 'manageProject') {
        const { action, projectId, title, description, status, priority } = args
        console.log(`[GeminiLiveAgent] manageProject: ${action}`, args)
        
        if (action === 'create') {
          if (!title) return { status: 'error', message: 'Title is required to create a project.' }
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              description: description || '',
              status: status || 'planning',
              priority: priority || 'medium',
              subtasks: [],
            }),
          })
          if (!res.ok) {
            const errData = await res.json()
            return { status: 'error', message: 'Failed to create project.', details: errData }
          }
          const project = await res.json()
          
          window.dispatchEvent(new CustomEvent('voice-command-executed', {
            detail: { action: 'create_project', data: project }
          }))
          
          setThinkingMessage(null)
          return { status: 'success', message: `Project "${title}" created successfully.`, project }
        }
        
        if (action === 'update') {
          if (!projectId) return { status: 'error', message: 'ProjectId is required to update a project.' }
          const res = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, status, priority }),
          })
          if (!res.ok) {
            const errData = await res.json()
            return { status: 'error', message: 'Failed to update project.', details: errData }
          }
          const project = await res.json()
          
          window.dispatchEvent(new CustomEvent('voice-command-executed', {
            detail: { action: 'update_project', data: project }
          }))
          
          setThinkingMessage(null)
          return { status: 'success', message: `Project was updated successfully.`, project }
        }
        
        if (action === 'delete') {
          if (!projectId) return { status: 'error', message: 'ProjectId is required to delete a project.' }
          const res = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE',
          })
          if (!res.ok) {
            const errData = await res.json()
            return { status: 'error', message: 'Failed to delete project.', details: errData }
          }
          
          window.dispatchEvent(new CustomEvent('voice-command-executed', {
            detail: { action: 'delete_project', projectId }
          }))
          
          setThinkingMessage(null)
          return { status: 'success', message: 'Project deleted successfully.' }
        }
        
        if (action === 'list') {
          const res = await fetch('/api/projects')
          if (!res.ok) return { status: 'error', message: 'Failed to fetch projects.' }
          const projects = await res.json()
          
          setThinkingMessage(null)
          return { status: 'success', projects: projects.map((p: any) => ({ id: p.id, title: p.title, description: p.description, status: p.status, progress: p.progress })) }
        }
        
        return { status: 'error', message: `Action "${action}" not recognized.` }
      }
      
      if (name === 'manageMusic') {
        const { action, volumeLevel, trackName } = args
        console.log(`[GeminiLiveAgent] manageMusic: ${action}`, args)
        
        if (action === 'play') {
          if (trackName) {
            const searchRes = await fetch(`/api/ytmusic/search?q=${encodeURIComponent(trackName)}&limit=1`)
            if (!searchRes.ok) {
              return { status: 'error', message: `Failed to search for song: ${trackName}` }
            }
            const { tracks } = await searchRes.json()
            if (!tracks || tracks.length === 0) {
              return { status: 'error', message: `No tracks found for: ${trackName}` }
            }
            
            const targetTrack = tracks[0]
            await playerStore.playTrack(targetTrack)
            setThinkingMessage(null)
            return { status: 'success', message: `Playing "${targetTrack.name}" by ${targetTrack.artist}`, track: targetTrack }
          } else {
            await playerStore.togglePlayPause()
            setThinkingMessage(null)
            return { status: 'success', message: 'Toggled playback.' }
          }
        }
        
        if (action === 'pause') {
          if (playerStore.isPlaying) {
            await playerStore.togglePlayPause()
          }
          setThinkingMessage(null)
          return { status: 'success', message: 'Playback paused.' }
        }
        
        if (action === 'next') {
          await playerStore.nextTrack()
          setThinkingMessage(null)
          return { status: 'success', message: 'Skipped to next track.' }
        }
        
        if (action === 'previous') {
          await playerStore.previousTrack()
          setThinkingMessage(null)
          return { status: 'success', message: 'Rewound to previous track.' }
        }
        
        if (action === 'volume') {
          if (typeof volumeLevel === 'number') {
            playerStore.setVolume(Math.max(0, Math.min(1, volumeLevel)))
            setThinkingMessage(null)
            return { status: 'success', message: `Volume set to ${Math.round(volumeLevel * 100)}%.` }
          }
          return { status: 'error', message: 'VolumeLevel is required and must be a number.' }
        }
        
        return { status: 'error', message: `Action "${action}" not recognized.` }
      }
      
      setThinkingMessage(null)
      return { status: 'error', message: 'Function not recognized' }
    } catch (e: any) {
      console.error(`[GeminiLiveAgent] Failed executing tool: ${name}`, e)
      setThinkingMessage(null)
      return { status: 'error', error: e.message }
    }
  }, [router, cognitiveEngine, playerStore])

  // ─── WebSocket Event Handling ───────────────────────────────────────────────
  const startSession = useCallback(async (customApiKey?: string) => {
    const finalApiKey = customApiKey || options.apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!finalApiKey) {
      const errMsg = 'Missing Gemini API Key. Please provide an API key in options or NEXT_PUBLIC_GEMINI_API_KEY env var.'
      setError(errMsg)
      setAgentState('error')
      return
    }

    setAgentState('connecting')
    setError(null)
    
    try {
      // 1. Initialize AudioContext & Stream
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AudioCtx()
      
      // Request mic input
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setIsRecording(true)

      // Establish WebSocket connection
      const socketUrl = `${GEMINI_WS_URL}?key=${finalApiKey}`
      console.log('[GeminiLiveAgent] Establishing bidirectional connection to Gemini Live API...')
      
      const ws = new WebSocket(socketUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[GeminiLiveAgent] Bidirectional connection established!')
        setIsConnected(true)
        setAgentState('listening')

        // 2. Send Setup Message to configure tools & audio output modality
        const setupMessage = {
          setup: {
            model: GEMINI_LIVE_MODEL,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck' // Premium, warm voice model
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{
                text: options.systemInstruction || 
                  'Eres "antigravity", el copiloto cognitivo inteligente de la suite Novo Heritage. Tu misión es asistir al usuario mediante voz en tiempo real. Responde de forma concisa y premium. Tienes acceso a herramientas avanzadas para controlar la interfaz física del usuario: navegar por las secciones, activar la música circadiana, agendar bloques de descanso y realizar operaciones completas de creación, lectura, actualización y eliminación (CRUD) de tareas (tasks), proyectos (projects) y música.'
              }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: 'MapsToSection',
                    description: 'Redirige dinámicamente al usuario a una sección específica del panel principal de la aplicación.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        sectionName: {
                          type: 'STRING',
                          description: "La sección objetivo del panel. Secciones válidas: 'style' (Ropa/Estilo), 'calendar' (Agenda/Calendario), 'habits' (Hábitos), 'music' (Música), 'settings' (Configuración)."
                        }
                      },
                      required: ['sectionName']
                    }
                  },
                  {
                    name: 'playCircadianMusic',
                    description: 'Despliega la música recomendada del ContextHub en la interfaz de usuario e inicia la reproducción.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        moodPreference: {
                          type: 'STRING',
                          description: 'Preferencia emocional del usuario: focus, relax, energy, ambient.'
                        }
                      },
                      required: ['moodPreference']
                    }
                  },
                  {
                    name: 'scheduleCognitiveEvent',
                    description: 'Agenda un bloque de descanso o período de enfoque cognitivo en la agenda del usuario.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        title: {
                          type: 'STRING',
                          description: 'Nombre descriptivo de la actividad.'
                        },
                        durationMinutes: {
                          type: 'NUMBER',
                          description: 'Duración en minutos (ej: 25 para Pomodoro, 10 para descanso sináptico).'
                        }
                      },
                      required: ['title', 'durationMinutes']
                    }
                  },
                  {
                    name: 'manageTask',
                    description: 'Crea, actualiza, elimina o lista tareas (tasks) del usuario.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        action: {
                          type: 'STRING',
                          description: "Acción a realizar: 'create', 'update', 'delete', 'list'."
                        },
                        taskId: {
                          type: 'STRING',
                          description: 'ID de la tarea a actualizar o eliminar (opcional).'
                        },
                        title: {
                          type: 'STRING',
                          description: 'Título o nombre de la tarea (opcional).'
                        },
                        status: {
                          type: 'STRING',
                          description: "Estado de la tarea: 'todo', 'in-progress', 'done' (opcional)."
                        },
                        priority: {
                          type: 'STRING',
                          description: "Prioridad: 'low', 'medium', 'high' (opcional)."
                        },
                        projectId: {
                          type: 'STRING',
                          description: 'ID del proyecto asociado (opcional).'
                        }
                      },
                      required: ['action']
                    }
                  },
                  {
                    name: 'manageProject',
                    description: 'Crea, actualiza, elimina o lista proyectos (projects) del usuario.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        action: {
                          type: 'STRING',
                          description: "Acción a realizar: 'create', 'update', 'delete', 'list'."
                        },
                        projectId: {
                          type: 'STRING',
                          description: 'ID del proyecto a actualizar o eliminar (opcional).'
                        },
                        title: {
                          type: 'STRING',
                          description: 'Título del proyecto (opcional).'
                        },
                        description: {
                          type: 'STRING',
                          description: 'Descripción detallada del proyecto (opcional).'
                        },
                        status: {
                          type: 'STRING',
                          description: "Estado: 'planning', 'active', 'completed' (opcional)."
                        },
                        priority: {
                          type: 'STRING',
                          description: "Prioridad: 'low', 'medium', 'high' (opcional)."
                        }
                      },
                      required: ['action']
                    }
                  },
                  {
                    name: 'manageMusic',
                    description: 'Controla la reproducción de música: reproducir, pausar, siguiente, anterior, o ajustar el volumen.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        action: {
                          type: 'STRING',
                          description: "Acción de control: 'play', 'pause', 'next', 'previous', 'volume'."
                        },
                        volumeLevel: {
                          type: 'NUMBER',
                          description: 'Nivel del volumen de 0.0 a 1.0 (opcional).'
                        },
                        trackName: {
                          type: 'STRING',
                          description: 'Nombre de la canción o tema a buscar y reproducir (opcional).'
                        }
                      },
                      required: ['action']
                    }
                  }
                ]
              }
            ]
          }
        }
        
        ws.send(JSON.stringify(setupMessage))

        // 3. Connect Microphone stream using a script processor
        const source = audioContextRef.current!.createMediaStreamSource(stream)
        micSourceRef.current = source

        // Resample output size block = 4096
        const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1)
        scriptProcessorRef.current = processor

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0)
          const resampled = downsampleBuffer(inputData, audioContextRef.current!.sampleRate, 16000)
          const base64Audio = arrayBufferToBase64(resampled.buffer as ArrayBuffer)

          // ── Inject RMS mic volume as CSS variable for orb animation ──
          // Uses squared mean to compute RMS (Root Mean Square), avoids React re-renders
          let sumOfSquares = 0
          for (let i = 0; i < inputData.length; i++) {
            sumOfSquares += inputData[i] * inputData[i]
          }
          const rms = Math.sqrt(sumOfSquares / inputData.length)
          // Normalize 0–1, clamp, and set on body for GPU-composited CSS animations
          const normalizedVolume = Math.min(1, rms * 8)
          document.body.style.setProperty('--mic-volume', normalizedVolume.toFixed(3))

          // Stream real-time microphone chunks over WebSocket
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Audio
                }]
              }
            }))
          }
        }

        // Silent Gain Trick to fire events continuously without microphone echo feedback
        const silentGain = audioContextRef.current!.createGain()
        silentGain.gain.value = 0
        
        source.connect(processor)
        processor.connect(silentGain)
        silentGain.connect(audioContextRef.current!.destination)
      }

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data)

          // ── Handle Server Audio Content & Text Transcript ──
          if (message.serverContent) {
            const content = message.serverContent
            
            // Check for barge-in interruption signals
            if (content.interrupted) {
              purgeAudioQueue()
              return
            }

            if (content.modelTurn) {
              isAgentGeneratingRef.current = true
              
              content.modelTurn.parts.forEach((part: any) => {
                // If model generates vocal audio stream
                if (part.inlineData && part.inlineData.data) {
                  scheduleAudioChunk(part.inlineData.data)
                }
                
                // Keep live track of text transcription of agent's voice response
                if (part.text) {
                  setAgentTranscript(prev => prev + part.text)
                }
              })
            }

            if (content.turnComplete) {
              isAgentGeneratingRef.current = false
            }
          }

          // ── Handle Gemini Tool Calls (Function Calling) ──
          if (message.toolCall) {
            const toolCall = message.toolCall
            const functionResponses: any[] = []

            for (const call of toolCall.functionCalls || []) {
              const { name, args, id } = call
              const executionResult = await executeLocalTool(name, args)
              
              functionResponses.push({
                name,
                id,
                response: executionResult
              })
            }

            // Report the Tool Call execution result back to Gemini Live
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                toolResponse: {
                  functionResponses
                }
              }))
            }
          }
        } catch (err) {
          console.error('[GeminiLiveAgent] Error parsing server message', err)
        }
      }

      ws.onerror = (e) => {
        console.error('[GeminiLiveAgent] WebSocket error:', e)
        setError('Error connecting to Gemini Multimodal Live Server.')
        setAgentState('error')
      }

      ws.onclose = () => {
        console.log('[GeminiLiveAgent] WebSocket connection closed.')
        setIsConnected(false)
        setIsRecording(false)
        setAgentState('idle')
      }

    } catch (e: any) {
      console.error('[GeminiLiveAgent] Session initialization failed:', e)
      setError(e.message || 'Microphone access or WebSocket connection failed.')
      setAgentState('error')
    }
  }, [options.apiKey, options.systemInstruction, scheduleAudioChunk, executeLocalTool, downsampleBuffer, purgeAudioQueue])

  const stopSession = useCallback(() => {
    console.log('[GeminiLiveAgent] Terminating session...')
    
    // 1. Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // 2. Stop Microphone streams
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    // 3. Disconnect Audio Nodes
    if (micSourceRef.current) {
      micSourceRef.current.disconnect()
      micSourceRef.current = null
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }

    // 4. Purge Speaker buffers
    purgeAudioQueue()

    // 5. Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(err => {})
      audioContextRef.current = null
    }

    setIsConnected(false)
    setIsRecording(false)
    setAgentState('idle')
    setThinkingMessage(null)
    setUserTranscript('')
    setAgentTranscript('')
    // Reset CSS mic volume variable
    document.body.style.setProperty('--mic-volume', '0')
  }, [purgeAudioQueue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession()
    }
  }, [stopSession])

  return {
    isConnected,
    isRecording,
    agentState,
    thinkingMessage,
    error,
    userTranscript,
    agentTranscript,
    startSession,
    stopSession,
    purgeAudioQueue,
  }
}
