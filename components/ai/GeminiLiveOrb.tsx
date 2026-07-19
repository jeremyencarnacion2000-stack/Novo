'use client'

/**
 * GeminiLiveOrb.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Floating voice mic for Novo. Hold to record, release to run the command.
 *
 * Engine: press-and-hold captures mic audio → POSTs the blob to the
 * server-side /api/ai/transcribe (Whisper, server-held key) → the transcript
 * runs through executeVoiceCommand against the current cognitive bioState.
 *
 * Deliberately NO client API key: the previous version opened a WebSocket to
 * Gemini's Live API, which required the user to paste a Gemini key in a modal
 * (and Gemini's free tier is structurally capped at 0 in this project, so it
 * never worked). It also is idle by default — nothing connects, listens, or
 * requests the mic until the user actually presses the orb.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, X, Brain, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { whisperAPI } from '@/lib/whisper'
import { executeVoiceCommand, type VoiceExecutionResult } from '@/lib/voice-executor'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import { eventBus } from '@/lib/events/event-bus'

type MicState = 'idle' | 'recording' | 'processing' | 'result' | 'error'

export function GeminiLiveOrb() {
  const { bioState } = useCognitiveEngine()

  const [micState, setMicState] = useState<MicState>('idle')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<VoiceExecutionResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // ── Audio-reactive aura scale — reads --mic-volume via rAF, GPU transform only
  const auraRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let rafId: number
    const tick = () => {
      const vol = parseFloat(getComputedStyle(document.body).getPropertyValue('--mic-volume') || '0')
      if (auraRef.current) {
        const scale = 1.35 + vol * 0.85
        auraRef.current.style.transform = `scale(${scale.toFixed(3)})`
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // ── Fade the orb out while scrolling & idle, so it stops crossing content
  const [isScrolling, setIsScrolling] = useState(false)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const handleScroll = () => {
      setIsScrolling(true)
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => setIsScrolling(false), 400)
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    if (micState === 'recording' || micState === 'processing') return
    setErrorMsg('')
    setResult(null)
    setTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stopTracks()
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) {
          setMicState('idle')
          return
        }
        setMicState('processing')
        try {
          const text = await whisperAPI.transcribeAudio(blob)
          setTranscript(text)
          if (!text.trim()) {
            setErrorMsg('No se detectó voz. Intenta de nuevo.')
            setMicState('error')
            return
          }
          if (!bioState) {
            setErrorMsg('El motor cognitivo aún se está iniciando. Intenta en un momento.')
            setMicState('error')
            return
          }
          const res = await executeVoiceCommand(text, bioState)
          setResult(res)
          setMicState('result')
          eventBus.dispatch('VoiceCommandExecuted', {
            text, action: res.action, success: res.success,
            deferred: res.deferred ?? false, phase: bioState.phase,
          }, { path: typeof window !== 'undefined' ? window.location.pathname : undefined })
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('voice-command-executed', { detail: { text, result: res, phase: bioState.phase } }))
          }
        } catch (err: any) {
          setErrorMsg(err?.message ?? 'No se pudo transcribir. Revisa tu micrófono.')
          setMicState('error')
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setMicState('recording')
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Acceso al micrófono denegado.')
      setMicState('error')
    }
  }, [micState, bioState, stopTracks])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // Other voice triggers (mobile nav, etc.) dispatch toggle-gemini-live —
  // map it to a quick start/stop so those entry points still work.
  useEffect(() => {
    const handleToggle = () => {
      if (micState === 'recording') stopRecording()
      else startRecording()
    }
    window.addEventListener('toggle-gemini-live', handleToggle)
    return () => window.removeEventListener('toggle-gemini-live', handleToggle)
  }, [micState, startRecording, stopRecording])

  // Cleanup on unmount
  useEffect(() => () => stopTracks(), [stopTracks])

  // ── Per-state colors ──
  const stateColor =
    micState === 'recording' ? 'rgba(168, 85, 247, 0.5)'   // purple
    : micState === 'processing' ? 'rgba(249, 115, 22, 0.5)' // orange
    : micState === 'error' ? 'rgba(239, 68, 68, 0.45)'      // red
    : 'rgba(99, 102, 241, 0.28)'                             // idle indigo

  const dismiss = () => { setMicState('idle'); setResult(null); setErrorMsg(''); setTranscript('') }

  const showPanel = micState === 'recording' || micState === 'processing' || micState === 'result' || micState === 'error'

  return (
    <div
      className="flex flex-col items-end gap-3 pointer-events-none"
      style={{
        position: 'fixed',
        bottom: '5rem',
        right: '1rem',
        zIndex: 150,
        contain: 'layout style',
        willChange: 'auto',
        opacity: isScrolling && micState === 'idle' ? 0.25 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      {/* Status / result panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="max-w-[280px] md:max-w-[340px] rounded-2xl border border-white/10 p-4 backdrop-blur-2xl shadow-2xl pointer-events-auto"
            style={{
              background: 'rgba(13, 13, 18, 0.92)',
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${stateColor}`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: stateColor.replace('0.5', '1').replace('0.45', '1').replace('0.28', '1') }} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                  {micState === 'recording' ? 'Escuchando…'
                    : micState === 'processing' ? 'Procesando…'
                    : micState === 'error' ? 'Error'
                    : 'Comando'}
                </span>
              </div>
              <button onClick={dismiss} className="p-1 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                <X size={12} />
              </button>
            </div>

            {micState === 'processing' ? (
              <div className="flex items-center gap-2.5 py-1">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
                  <Brain className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                </motion.div>
                <p className="text-[11px] text-orange-300/90 font-medium">Transcribiendo tu comando…</p>
              </div>
            ) : micState === 'recording' ? (
              <p className="text-xs text-white/60 italic">Suelta el micrófono para ejecutar.</p>
            ) : micState === 'error' ? (
              <p className="text-[11px] text-red-300 leading-relaxed">{errorMsg}</p>
            ) : result ? (
              <div className="space-y-2">
                {transcript && <p className="text-[11px] text-white/40 italic">&ldquo;{transcript}&rdquo;</p>}
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {result.deferred ? <Clock className="h-3.5 w-3.5 text-amber-400" />
                      : result.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                  </div>
                  <p className="text-xs text-white/85 leading-relaxed">{result.message}</p>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb button — press and hold */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="relative group">
          {/* Audio-reactive aura */}
          <div
            ref={auraRef}
            className="absolute inset-0 rounded-full blur-xl opacity-50 transition-opacity duration-500 will-change-transform"
            style={{ background: `radial-gradient(circle, ${stateColor} 0%, transparent 70%)`, transform: 'scale(1.35)' }}
          />
          {/* Pulse ring while recording */}
          {micState === 'recording' && (
            <span className="absolute inset-[-4px] rounded-full border opacity-50 pointer-events-none"
              style={{ borderColor: stateColor, animation: 'pulse 1.8s infinite ease-in-out' }} />
          )}

          <motion.button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={() => { if (micState === 'recording') stopRecording() }}
            onTouchStart={(e) => { e.preventDefault(); startRecording() }}
            onTouchEnd={(e) => { e.preventDefault(); stopRecording() }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Mantén presionado para hablar"
            className="relative w-14 h-14 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-2xl shadow-xl transition-all duration-300 select-none"
            style={{ background: micState === 'recording' ? 'rgba(15, 15, 22, 0.9)' : 'rgba(25, 25, 35, 0.7)' }}
          >
            <AnimatePresence mode="wait">
              {micState === 'processing' ? (
                <motion.div key="proc" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [1, 1.15, 1], opacity: 1 }} transition={{ repeat: Infinity, duration: 1.0 }}>
                  <Brain className="w-5 h-5 text-orange-400" />
                </motion.div>
              ) : (
                <motion.div key="mic" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                  <Mic className={`w-5 h-5 ${micState === 'recording' ? 'text-purple-400' : 'text-indigo-400'}`} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
