'use client'

/**
 * VoiceCommandHub.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The primary voice-first UI for Novo's AI Operating System.
 *
 * Features:
 *  • Hold-to-record button with real-time waveform animation
 *  • Whisper transcription → VoiceExecutor pipeline
 *  • Cognitive phase badge (phase-aware feedback)
 *  • Result message with action confirmation / deferral notice
 *  • Transcript history (last 5 commands)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Brain,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import { whisperAPI } from '@/lib/whisper'
import { executeVoiceCommand, type VoiceExecutionResult } from '@/lib/voice-executor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  id: string
  text: string
  result: VoiceExecutionResult
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
          className="w-[3px] bg-white/80 rounded-full"
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

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ result, text }: { result: VoiceExecutionResult; text: string }) {
  const isDeferred = result.deferred
  const isSuccess = result.success && !isDeferred
  const isError = !result.success

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`
        relative rounded-2xl border p-4 backdrop-blur-xl overflow-hidden
        ${isDeferred
          ? 'bg-amber-950/40 border-amber-500/30'
          : isError
          ? 'bg-red-950/40 border-red-500/30'
          : 'bg-emerald-950/40 border-emerald-500/30'}
      `}
    >
      {/* Transcript */}
      <p className="text-xs text-white/40 mb-2 font-mono tracking-wide">
        "{text}"
      </p>

      {/* Status row */}
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          {isDeferred ? (
            <Clock className="h-4 w-4 text-amber-400" />
          ) : isError ? (
            <AlertCircle className="h-4 w-4 text-red-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
        </div>
        <p className="text-sm text-white/85 leading-relaxed">{result.message}</p>
      </div>

      {/* Deferral notice */}
      {isDeferred && result.deferredReason && (
        <p className="mt-2 text-xs text-amber-400/70 pl-6.5 leading-relaxed">
          {result.deferredReason}
        </p>
      )}
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface VoiceCommandHubProps {
  /** When true, renders as a compact floating pill */
  compact?: boolean
  className?: string
}

export function VoiceCommandHub({ compact = false, className = '' }: VoiceCommandHubProps) {
  const { bioState } = useCognitiveEngine()

  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<VoiceExecutionResult | null>(null)
  const [lastTranscript, setLastTranscript] = useState('')
  const [history, setHistory] = useState<TranscriptEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const phase = bioState?.phase ?? 'LINEAR_EXECUTION'
  const phaseConfig = PHASE_CONFIG[phase]
  const PhaseIcon = phaseConfig.icon

  // ── Recording logic ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setLastResult(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        if (blob.size < 1000) {
          setError('No audio detected. Hold the button while speaking.')
          setProcessing(false)
          return
        }

        setProcessing(true)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('voice-command-hub-state-change', { detail: { state: 'thinking' } }))
        }
        try {
          const text = await whisperAPI.transcribeAudio(blob)
          setLastTranscript(text)

          if (!text.trim()) {
            setError('No speech detected. Try again.')
            setProcessing(false)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('voice-command-hub-state-change', { detail: { state: 'idle' } }))
            }
            return
          }

          const result = await executeVoiceCommand(text, bioState!)
          setLastResult(result)

          setHistory(prev => [
            { id: Date.now().toString(), text, result, timestamp: new Date() },
            ...prev.slice(0, 4),
          ])

          // Dispatch global event so other modules can react
          window.dispatchEvent(new CustomEvent('voice-command-executed', {
            detail: { text, result, phase: bioState?.phase }
          }))
        } catch (err: any) {
          setError(err?.message ?? 'Transcription failed. Check your microphone.')
        } finally {
          setProcessing(false)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('voice-command-hub-state-change', { detail: { state: 'idle' } }))
          }
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('voice-command-hub-state-change', { detail: { state: 'listening' } }))
      }
    } catch (err: any) {
      setError(err?.message ?? 'Microphone access denied.')
    }
  }, [bioState])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }, [])

  // Keyboard shortcut: hold Space
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body && !recording && !processing) {
        e.preventDefault()
        startRecording()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && recording) {
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

  if (!bioState) return null

  if (compact) {
    return (
      <motion.button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
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
          <span className="opacity-60">·</span>
          <span className="tabular-nums">{bioState.attentionScore}% attn</span>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
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
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          animate={
            recording
              ? { scale: [1, 1.04, 1], transition: { repeat: Infinity, duration: 1.2 } }
              : processing
              ? { scale: [1, 1.02, 1], transition: { repeat: Infinity, duration: 0.8 } }
              : {}
          }
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          disabled={processing}
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
                className="absolute inset-0 rounded-full bg-white/10"
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

        {/* Status text */}
        <p className="text-xs text-white/50 tracking-wide">
          {processing
            ? 'Thinking...'
            : recording
            ? 'Listening — release to process'
            : 'Hold to speak  ·  or press Space'}
        </p>
      </div>

      {/* Cognitive hint for fatigue */}
      {(phase === 'SYNAPTIC_FATIGUE' || phase === 'REDUCED_CAPACITY_MODE') && (
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

        {lastResult && !error && (
          <ResultCard key={lastResult.action + lastTranscript} result={lastResult} text={lastTranscript} />
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
            <p className="text-xs text-white/30 uppercase tracking-widest">Recent commands</p>
            {history.map(entry => (
              <div
                key={entry.id}
                className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5"
              >
                <p className="text-xs text-white/50 font-mono mb-1">"{entry.text}"</p>
                <p className="text-xs text-white/65">{entry.result.message}</p>
                <p className="text-[10px] text-white/25 mt-1">
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
