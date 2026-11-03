'use client'

/**
 * VoiceCommandHub.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The primary voice-first UI for Novo's AI Operating System.
 *
 * Features:
 *  • Hold-to-record button with real-time waveform animation
 *  • Whisper transcription → reviewed chat draft
 *  • Cognitive phase badge (phase-aware feedback)
 *  • No transcript is sent or executed automatically
 *  • Transcript history (last 5 commands)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Brain,
  AlertCircle,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import { whisperAPI } from '@/lib/whisper'
import { sileo } from '@/lib/sileo-bell'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  id: string
  text: string
  timestamp: Date
}

// ─── Phase Color Map ──────────────────────────────────────────────────────────

const PHASE_CONFIG = {
  PEAK_FOCUS: {
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    glow: 'shadow-[0_0_40px_rgba(20,184,166,0.45)]',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    ring: 'ring-emerald-500/60',
    label: 'Peak Focus',
    icon: Zap,
  },
  LINEAR_EXECUTION: {
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'shadow-[0_0_40px_rgba(99,102,241,0.35)]',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    ring: 'ring-blue-500/60',
    label: 'Execution Mode',
    icon: Activity,
  },
  SYNAPTIC_FATIGUE: {
    gradient: 'from-amber-600 via-orange-500 to-red-500',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.35)]',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    ring: 'ring-amber-500/60',
    label: 'Recovery Mode',
    icon: Brain,
  },
  REDUCED_CAPACITY_MODE: {
    gradient: 'from-slate-600 via-slate-500 to-slate-400',
    glow: 'shadow-[0_0_30px_rgba(148,163,184,0.25)]',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    ring: 'ring-slate-500/60',
    label: 'Low Capacity',
    icon: AlertCircle,
  },
}

// ─── Waveform Bars ────────────────────────────────────────────────────────────

function WaveformBars({ isActive }: { isActive: boolean }) {
  const BARS = 12
  return (
    <div className="flex items-center gap-[3px] h-8">
      {Array.from({ length: BARS }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] bg-foreground/80 rounded-full"
          animate={
            isActive
              ? {
                  height: [6, 18 + Math.random() * 14, 6],
                  opacity: [0.5, 1, 0.5],
                }
              : { height: 4, opacity: 0.3 }
          }
          transition={
            isActive
              ? {
                  duration: 0.5 + Math.random() * 0.4,
                  repeat: Infinity,
                  delay: i * 0.05,
                  ease: 'easeInOut',
                }
              : { duration: 0.3 }
          }
          style={{ height: isActive ? undefined : 4 }}
        />
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface VoiceCommandHubProps {
  /** When true, renders as a compact floating pill */
  compact?: boolean
  className?: string
  /** Mounts the recorder/event bridge without adding a second visible control. */
  headless?: boolean
}

function emitVoiceState(state: 'listening' | 'thinking' | 'idle') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('voice-command-hub-state-change', { detail: { state } }))
  // Keep the existing chat composer/hero in sync while both surfaces migrate
  // to the same recorder. This alias is intentionally temporary-compatible:
  // it avoids reviving the retired GeminiLiveOrb just to service /ai.
  window.dispatchEvent(new CustomEvent('gemini-live-state-change', { detail: { state } }))
}

function emitVoiceStream(stream: MediaStream | null) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('novo:voice-stream-change', { detail: { stream } }))
}

function cloudVoiceConsentKey(accountId: string) { return `novo:cloud-voice-consent:${accountId}` }
function readCloudVoiceConsent(accountId: string | undefined) {
  if (!accountId || typeof window === 'undefined') return false
  try { return window.localStorage.getItem(cloudVoiceConsentKey(accountId)) === 'yes' } catch { return false }
}

export function VoiceCommandHub({ compact = false, className = '', headless = false }: VoiceCommandHubProps) {
  const { bioState } = useCognitiveEngine()
  const { data: session } = useSession()
  const accountId = session?.user?.id
  const [cloudVoiceConsent, setCloudVoiceConsent] = useState(() => readCloudVoiceConsent(accountId))
  const accountRef = useRef(accountId)
  accountRef.current = accountId

  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastTranscript, setLastTranscript] = useState('')
  const [history, setHistory] = useState<TranscriptEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (headless && error) sileo.error({ title: 'No se pudo dictar', description: error, duration: 5000 })
  }, [headless, error])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const generationRef = useRef(0)
  const requestingRef = useRef(false)
  const mountedRef = useRef(true)

  const cancelRecording = useCallback((updateUI = true) => {
    generationRef.current += 1
    requestingRef.current = false
    const recorder = mediaRecorderRef.current
    mediaRecorderRef.current = null
    if (recorder) {
      recorder.onstop = null
      recorder.ondataavailable = null
      if (recorder.state !== 'inactive') { try { recorder.stop() } catch { /* Already stopping. */ } }
    }
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    chunksRef.current = []
    emitVoiceStream(null)
    emitVoiceState('idle')
    if (updateUI && mountedRef.current) { setRecording(false); setProcessing(false) }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const cancel = () => cancelRecording()
    window.addEventListener('novo:voice-cancel', cancel)
    return () => {
      mountedRef.current = false
      window.removeEventListener('novo:voice-cancel', cancel)
      cancelRecording(false)
    }
  }, [cancelRecording])

  useEffect(() => {
    setCloudVoiceConsent(readCloudVoiceConsent(accountId))
    cancelRecording()
    setLastTranscript('')
    setHistory([])
    setError(null)
  }, [accountId, cancelRecording])

  const phase = bioState?.phase ?? 'LINEAR_EXECUTION'
  const phaseConfig = PHASE_CONFIG[phase]
  const PhaseIcon = phaseConfig.icon

  // ── Recording logic ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (!accountRef.current || requestingRef.current || mediaRecorderRef.current || processing) return
    if (!cloudVoiceConsent) {
      sileo.warning({title:'Autoriza el dictado',description:'El audio se enviará a OpenAI para transcribirlo. Activa esa opción en el panel de voz antes de grabar.',duration:6000})
      window.dispatchEvent(new Event('open-voice-command-hub'))
      return
    }
    const account = accountRef.current
    requestingRef.current = true
    const generation = ++generationRef.current
    const current = () => mountedRef.current && generationRef.current === generation && accountRef.current === account
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return }
      requestingRef.current = false
      streamRef.current = stream
      emitVoiceStream(stream)

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (current() && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (!current()) return
        mediaRecorderRef.current = null
        streamRef.current = null
        emitVoiceStream(null)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        if (blob.size < 1000) {
          setError('No audio detected. Hold the button while speaking.')
          setProcessing(false)
          emitVoiceState('idle')
          return
        }

        setProcessing(true)
        emitVoiceState('thinking')
        try {
          const text = await whisperAPI.transcribeAudio(blob)
          if (!current()) return
          if (!text.trim()) {
            setError('No speech detected. Try again.')
            setProcessing(false)
            emitVoiceState('idle')
            return
          }

          setLastTranscript(text)
          // The chat owns the draft; dictation never sends or executes it.
          window.dispatchEvent(new CustomEvent('novo:voice-transcript', { detail: { text } }))
          setHistory(prev => [{ id: Date.now().toString(), text, timestamp: new Date() }, ...prev.slice(0, 4)])
        } catch (err: any) {
          if (current()) setError('No pudimos procesar el audio. Revisa el micrófono e inténtalo de nuevo.')
        } finally {
          if (current()) { setProcessing(false); emitVoiceState('idle') }
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      emitVoiceState('listening')
    } catch (err: any) {
      if (!current()) return
      requestingRef.current = false
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
      emitVoiceStream(null)
      setError('No se pudo abrir el micrófono. Revisa el permiso e inténtalo de nuevo.')
      emitVoiceState('idle')
    }
  }, [cloudVoiceConsent, processing])

  const stopRecording = useCallback(() => {
    // Releasing before a permission prompt resolves must never start a
    // recording afterward with no visible gesture holding it open.
    if (requestingRef.current) { cancelRecording(); return }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }, [cancelRecording])

  const holdControls = {
    'aria-label': 'Mantén pulsado para hablar',
    style: { touchAction: 'none' } as React.CSSProperties,
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture?.(event.pointerId)
      void startRecording()
    },
    onPointerUp: stopRecording,
    onPointerCancel: () => cancelRecording(),
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); void startRecording() }
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stopRecording() }
    },
  }

  // The fullscreen /ai composer predates this hub and emits the legacy event
  // name. Keep one recorder implementation by routing that event here rather
  // than mounting the retired GeminiLiveOrb as a second floating control.
  useEffect(() => {
    if (!headless) return
    const toggle = () => {
      if (recording || requestingRef.current) stopRecording()
      else if (!processing) void startRecording()
    }
    window.addEventListener('toggle-gemini-live', toggle)
    return () => window.removeEventListener('toggle-gemini-live', toggle)
  }, [headless, processing, recording, startRecording, stopRecording])

  // Keyboard shortcut: hold Space
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body && !recording && !processing) {
        e.preventDefault()
        startRecording()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (recording || requestingRef.current)) {
        e.preventDefault()
        stopRecording()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [recording, processing, startRecording, stopRecording])

  // ── Render ───────────────────────────────────────────────────────────────

  if (headless) return null

  if (compact) {
    return (
      <motion.button
        {...holdControls}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        disabled={processing || !cloudVoiceConsent}
        className={`
          relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white
          bg-gradient-to-r ${phaseConfig.gradient} ${phaseConfig.glow}
          cursor-pointer select-none ${className}
        `}
      >
        {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {processing ? 'Processing...' : recording ? 'Listening...' : 'Hold to speak'}
      </motion.button>
    )
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>

      {/* Phase badge */}
      <div className="flex items-center justify-between">
        <div className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
          border ${phaseConfig.badge}
        `}>
          <PhaseIcon className="h-3 w-3" />
          {phaseConfig.label}
          {bioState && <><span className="opacity-60">·</span><span className="tabular-nums">{bioState.attentionScore}% attn</span></>}
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1 text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            History
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Main orb */}
      <div className="flex flex-col items-center gap-5">
        {/* Record button */}
        <motion.button
          {...holdControls}
          animate={
            recording
              ? { scale: [1, 1.04, 1], transition: { repeat: Infinity, duration: 1.2 } }
              : processing
              ? { scale: [1, 1.02, 1], transition: { repeat: Infinity, duration: 0.8 } }
              : {}
          }
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          disabled={processing || !cloudVoiceConsent}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center
            bg-gradient-to-br ${phaseConfig.gradient}
            ${phaseConfig.glow} ${recording ? 'ring-2 ' + phaseConfig.ring : ''}
            cursor-pointer select-none disabled:opacity-70 transition-shadow
          `}
        >
          {/* Breathing ring */}
          <AnimatePresence>
            {(recording || processing) && (
              <motion.span
                className="absolute inset-0 rounded-full bg-foreground/10"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>

          {processing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            >
              <Brain className="h-7 w-7 text-white" />
            </motion.div>
          ) : recording ? (
            <MicOff className="h-7 w-7 text-white" />
          ) : (
            <Mic className="h-7 w-7 text-white" />
          )}
        </motion.button>

        {/* Waveform */}
        <WaveformBars isActive={recording} />

        <label className="flex max-w-sm items-start gap-2 text-xs text-foreground/55">
          <input type="checkbox" checked={cloudVoiceConsent} disabled={recording || processing} onChange={(event) => {
            const enabled=event.currentTarget.checked
            try {
              if(!accountId)throw new Error('account_required')
              if(enabled)window.localStorage.setItem(cloudVoiceConsentKey(accountId), 'yes')
              else window.localStorage.removeItem(cloudVoiceConsentKey(accountId))
              setCloudVoiceConsent(enabled)
              if(!enabled)cancelRecording()
            } catch { setError('No se pudo guardar la opción de privacidad en este dispositivo.') }
          }} />
          <span>Entiendo y autorizo enviar el audio a OpenAI para transcribirlo. Novo recibe el texto; el audio no se guarda aquí.</span>
        </label>

        {/* Status text */}
        <p className="text-xs text-foreground/50 tracking-wide">
          {processing
            ? 'Thinking...'
            : recording
            ? 'Listening — release to process'
            : cloudVoiceConsent ? 'Hold to dictate  ·  or press Space' : 'Autoriza la transcripción para usar el micrófono'}
        </p>
      </div>

      {/* Cognitive hint for fatigue */}
      {bioState && (phase === 'SYNAPTIC_FATIGUE' || phase === 'REDUCED_CAPACITY_MODE') && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3">
          <p className="text-xs text-amber-300/80 leading-relaxed">
            <span className="font-semibold">Recovery Mode</span> — Deep work tasks will be
            auto-deferred to your next peak window in ~{bioState.minutesToNextPhase} min.
            Try: <span className="italic">"Start breathing"</span> or <span className="italic">"What's my energy?"</span>
          </p>
        </div>
      )}

      {/* Latest result */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3"
          >
            <p className="text-xs text-red-400">{error}</p>
          </motion.div>
        )}

        {lastTranscript && !error && (
          <motion.div key={lastTranscript} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
            <p className="text-xs text-foreground/50 mb-1">Transcripción añadida al chat</p>
            <p className="text-sm text-foreground/80">{lastTranscript}</p>
            <p className="text-xs text-foreground/45 mt-2">Revísala y pulsa enviar cuando esté lista.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            <p className="text-xs text-foreground/30 uppercase tracking-widest">Dictado reciente</p>
            {history.map(entry => (
              <div
                key={entry.id}
                className="rounded-xl border border-foreground/8 bg-foreground/4 px-3 py-2.5"
              >
                <p className="text-xs text-foreground/50 font-mono mb-1">"{entry.text}"</p>
                <p className="text-xs text-foreground/65">Añadido al chat para revisar antes de enviarlo.</p>
                <p className="text-[10px] text-foreground/25 mt-1">
                  {entry.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
