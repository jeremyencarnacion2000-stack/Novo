'use client'

/**
 * GeminiLiveOrb.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Futuristic Glassmorphic Voice Assistant Orb for Novo Heritage.
 *
 * Interfaces with the `useGeminiLiveAgent` hook to process voice in real-time.
 * Displays breathing micro-animations, neon energy fields, and dynamic
 * subtitles based on the current agent state.
 *
 * New in v2:
 *  - 'thinking' state with energetic amber/orange theme
 *  - thinkingMessage subtitle rendered under the orb panel
 *  - Audio-reactive background aura via CSS var --mic-volume (GPU-composited)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Settings, Volume2, Sparkles, X, AlertCircle, RefreshCw, Brain } from 'lucide-react'
import { useGeminiLiveAgent, AgentState } from '@/hooks/useGeminiLiveAgent'
import { useCognitiveEngine } from '@/lib/cognitive-context'

export function GeminiLiveOrb() {
  const { phaseOverride, setPhaseOverride } = useCognitiveEngine()
  const [showConfig, setShowConfig] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [whisperKeyInput, setWhisperKeyInput] = useState('')
  const [savedWhisperKey, setSavedWhisperKey] = useState('')

  // Audio-reactive aura scale — reads --mic-volume CSS var via rAF, never touches React state
  const auraRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let rafId: number
    const tick = () => {
      const vol = parseFloat(getComputedStyle(document.body).getPropertyValue('--mic-volume') || '0')
      if (auraRef.current) {
        // Scale from 1.35 (silent) to 2.2 (loud), using GPU-composited transform only
        const scale = 1.35 + vol * 0.85
        auraRef.current.style.transform = `scale(${scale.toFixed(3)})`
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Load saved API keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('novo_gemini_api_key') || ''
      setSavedKey(key)
      setApiKeyInput(key)

      const whisperKey = localStorage.getItem('novo_whisper_api_key') || localStorage.getItem('novo_openai_api_key') || ''
      setSavedWhisperKey(whisperKey)
      setWhisperKeyInput(whisperKey)
    }
  }, [])

  // Fade the orb out while the page is actively scrolling, so it stops
  // visually crossing paths with whatever content passes underneath it (it's
  // `position: fixed`, so it otherwise always overlaps whatever scrolls by
  // at that screen position). Listens on `window` with `capture: true` since
  // native scroll events don't bubble but DO capture-phase propagate from any
  // nested `overflow: auto` container to window, so this catches scrolling
  // inside any of the app's per-page scroll containers without each page
  // needing to wire anything up itself.
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

  const agent = useGeminiLiveAgent({
    apiKey: savedKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  })

  const {
    isConnected,
    agentState,
    thinkingMessage,
    error,
    userTranscript,
    agentTranscript,
    startSession,
    stopSession,
  } = agent

  const handleSaveKey = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('novo_gemini_api_key', apiKeyInput)
      setSavedKey(apiKeyInput)

      localStorage.setItem('novo_whisper_api_key', whisperKeyInput)
      setSavedWhisperKey(whisperKeyInput)
      setShowConfig(false)
    }
  }

  const handleToggleSession = React.useCallback(async () => {
    if (isConnected) {
      stopSession()
    } else {
      const hasKey = savedKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY
      if (!hasKey) {
        setShowConfig(true)
      } else {
        await startSession()
      }
    }
  }, [isConnected, savedKey, startSession, stopSession])

  // Listen to toggle event from other voice buttons
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleToggle = () => {
        handleToggleSession()
      }
      window.addEventListener('toggle-gemini-live', handleToggle)
      return () => {
        window.removeEventListener('toggle-gemini-live', handleToggle)
      }
    }
  }, [handleToggleSession])

  // Dispatch live state change events globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gemini-live-state-change', {
        detail: { state: agentState }
      }))
    }
  }, [agentState])

  // ── Color palette per agent state ──
  const getStateColors = (state: AgentState) => {
    switch (state) {
      case 'connecting':
        return {
          glow: 'rgba(234, 179, 8, 0.4)',
          border: 'border-yellow-500/30',
          bg: 'bg-yellow-500/10',
          text: 'text-yellow-400',
          dot: 'bg-yellow-500',
        }
      case 'listening':
        return {
          glow: 'rgba(168, 85, 247, 0.45)',
          border: 'border-purple-500/30',
          bg: 'bg-purple-500/10',
          text: 'text-purple-400',
          dot: 'bg-purple-500 animate-pulse',
        }
      case 'speaking':
        return {
          glow: 'rgba(6, 182, 212, 0.5)',
          border: 'border-cyan-500/35',
          bg: 'bg-cyan-500/10',
          text: 'text-cyan-400',
          dot: 'bg-cyan-400 animate-[ping_1.5s_infinite]',
        }
      case 'thinking':
        return {
          glow: 'rgba(249, 115, 22, 0.5)',
          border: 'border-orange-500/35',
          bg: 'bg-orange-500/10',
          text: 'text-orange-400',
          dot: 'bg-orange-400 animate-pulse',
        }
      case 'error':
        return {
          glow: 'rgba(239, 68, 68, 0.4)',
          border: 'border-red-500/30',
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          dot: 'bg-red-500',
        }
      case 'idle':
      default:
        return {
          glow: 'rgba(99, 102, 241, 0.25)',
          border: 'border-indigo-500/20',
          bg: 'bg-indigo-500/5',
          text: 'text-indigo-400',
          dot: 'bg-indigo-400',
        }
    }
  }

  const tc = getStateColors(agentState)

  // ── Status label per state ──
  const getStatusLabel = () => {
    if (agentState === 'thinking' && thinkingMessage) return thinkingMessage
    switch (agentState) {
      case 'connecting':  return 'Iniciando conexión...'
      case 'listening':   return 'Escuchando...'
      case 'speaking':    return 'Antigravity Voz'
      case 'thinking':    return 'Procesando...'
      case 'error':       return 'Error de conexión'
      default:            return 'Inactivo'
    }
  }

  // Show subtitle panel when connected and there's something to display
  const showPanel = isConnected && (
    agentTranscript || userTranscript || agentState === 'listening' ||
    agentState === 'speaking' || agentState === 'thinking'
  )

  return (
    <>
      {/* ─── Main Floating Interface ─────────────────────────────────────────── */}
      {/*
       * IMPORTANT: This wrapper uses `position: fixed` + `contain: layout style`
       * to ensure it is fully removed from the document scroll flow.
       * Do NOT add any transform-based scroll listeners here — the aura uses rAF
       * on its own ref and only mutates its own transform, never the parent.
       */}
      <div
        className="flex flex-col items-end gap-3 pointer-events-none"
        style={{
          position: 'fixed',
          bottom: '5rem',
          right: '1rem',
          zIndex: 150,
          contain: 'layout style',
          willChange: 'auto',
          // Fade (opacity only — never transform, see the note above about the
          // aura's own rAF-driven transform) while scrolling AND idle, so the
          // orb stops visually fighting with whatever page content passes
          // underneath it. Never fades mid-interaction (connected/panel open),
          // so it can't disappear while the user is actually talking to it.
          opacity: isScrolling && !isConnected && !showConfig ? 0.25 : 1,
          transition: 'opacity 200ms ease',
        }}
      >

        {/* Dynamic Interactive Subtitle Panel */}
        <AnimatePresence>
          {showPanel && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="max-w-[280px] md:max-w-[340px] rounded-2xl border border-white/10 p-4 backdrop-blur-2xl shadow-2xl pointer-events-auto"
              style={{
                background: 'rgba(13, 13, 18, 0.9)',
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${tc.glow}`,
              }}
            >
              {/* Agent Status Badge */}
              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${tc.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${tc.text}`}>
                    {getStatusLabel()}
                  </span>
                </div>
                <button
                  onClick={stopSession}
                  className="p-1 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Thinking state: show animated spinner + message */}
              <AnimatePresence mode="wait">
                {agentState === 'thinking' ? (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 py-1"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                    >
                      <Brain className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    </motion.div>
                    <p className="text-[11px] text-orange-300/90 font-medium leading-relaxed">
                      {thinkingMessage || 'Procesando...'}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="transcripts"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin"
                  >
                    {userTranscript && (
                      <p className="text-[11px] text-white/40 italic font-medium">
                        Tú: &ldquo;{userTranscript}&rdquo;
                      </p>
                    )}
                    <p className="text-xs font-semibold text-white/90 leading-relaxed">
                      {agentTranscript ? agentTranscript : (
                        agentState === 'listening' ? (
                          <span className="text-white/35 italic">Háblame, te escucho en tiempo real...</span>
                        ) : (
                          <span className="text-yellow-400/80 animate-pulse">Iniciando síntesis neural...</span>
                        )
                      )}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Voice Orb Button ── */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Settings Button (only when disconnected) */}
          {!isConnected && (
            <motion.button
              whileHover={{ scale: 1.1, rotate: 30 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowConfig(true)}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all shadow-lg"
              title="Configurar Gemini API"
            >
              <Settings size={16} />
            </motion.button>
          )}

          {/* Glowing Voice Orb */}
          <div className="relative group">

            {/* Audio-reactive background aura — driven by --mic-volume CSS var via rAF */}
            <div
              ref={auraRef}
              className="absolute inset-0 rounded-full blur-xl opacity-50 transition-opacity duration-500 will-change-transform"
              style={{
                background: `radial-gradient(circle, ${tc.glow} 0%, transparent 70%)`,
                transform: 'scale(1.35)',
              }}
            />

            {/* Static hover aura */}
            <div
              className="absolute inset-0 rounded-full blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500"
              style={{
                background: `radial-gradient(circle, ${tc.glow} 0%, transparent 70%)`,
                transform: 'scale(1.6)',
              }}
            />

            {/* Neon pulse ring (only connected) */}
            {isConnected && (
              <span
                className="absolute inset-[-4px] rounded-full border opacity-50 pointer-events-none"
                style={{
                  borderColor: tc.glow,
                  animation:
                    agentState === 'listening'
                      ? 'pulse 1.8s infinite ease-in-out'
                      : agentState === 'speaking'
                        ? 'spin 3s linear infinite'
                        : agentState === 'thinking'
                          ? 'pulse 0.9s infinite ease-in-out'
                          : 'none',
                }}
              />
            )}

            <motion.button
              onClick={handleToggleSession}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={isConnected ? 'Detener asistente de voz' : 'Hablar con Gemini AI'}
              className={`relative w-14 h-14 rounded-full flex items-center justify-center border backdrop-blur-2xl shadow-xl transition-all duration-300 ${tc.border}`}
              style={{
                background: isConnected
                  ? 'rgba(15, 15, 22, 0.9)'
                  : 'rgba(25, 25, 35, 0.7)',
              }}
            >
              <AnimatePresence mode="wait">
                {agentState === 'connecting' ? (
                  <motion.div
                    key="connecting"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  >
                    <RefreshCw className="w-5 h-5 text-yellow-400" />
                  </motion.div>
                ) : agentState === 'thinking' ? (
                  <motion.div
                    key="thinking"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.15, 1], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 1.0 }}
                  >
                    <Brain className="w-5 h-5 text-orange-400" />
                  </motion.div>
                ) : isConnected ? (
                  <motion.div
                    key="connected"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center justify-center"
                  >
                    {agentState === 'speaking' ? (
                      <Volume2 className="w-5 h-5 text-cyan-400 animate-bounce" />
                    ) : (
                      <div className="relative">
                        <span className="absolute inset-0 rounded-full w-4 h-4 bg-purple-500/30 animate-ping" />
                        <Sparkles className="w-5 h-5 text-purple-400" />
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="disconnected"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Mic className="w-5 h-5 text-indigo-400" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Listening frequency bars */}
              {agentState === 'listening' && (
                <div className="absolute bottom-2 flex items-end gap-0.5 h-1.5">
                  <span className="w-0.5 bg-purple-400 rounded-full h-1 animate-[bounce_0.6s_infinite]" />
                  <span className="w-0.5 bg-purple-400 rounded-full h-1.5 animate-[bounce_0.6s_infinite]" style={{ animationDelay: '0.1s' }} />
                  <span className="w-0.5 bg-purple-400 rounded-full h-1 animate-[bounce_0.6s_infinite]" style={{ animationDelay: '0.2s' }} />
                </div>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── API Key Configuration Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showConfig && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfig(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative max-w-md w-full rounded-3xl border border-white/10 p-6 shadow-2xl backdrop-blur-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.98) 0%, rgba(10, 10, 15, 0.98) 100%)',
              }}
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Configuración de Voz y Copiloto
                  </h3>
                </div>
                <button
                  onClick={() => setShowConfig(false)}
                  className="p-1.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-white/50 leading-relaxed">
                  Para utilizar el copiloto conversacional y el hub de comandos en tiempo real, ingresa tus claves API. Se guardarán de forma segura en tu navegador.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/45 flex items-center justify-between">
                    <span>Gemini API Key</span>
                    <span className="text-[9px] text-white/20 normal-case font-normal">(para voz en tiempo real)</span>
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full h-11 px-4 rounded-xl bg-white/5 hover:bg-white/[0.08] focus:bg-white/10 border border-white/10 focus:border-indigo-500/50 text-white placeholder-white/20 text-xs tracking-wide focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/45 flex items-center justify-between">
                    <span>OpenAI / Whisper API Key</span>
                    <span className="text-[9px] text-white/20 normal-case font-normal">(para comandos de voz)</span>
                  </label>
                  <input
                    type="password"
                    value={whisperKeyInput}
                    onChange={(e) => setWhisperKeyInput(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full h-11 px-4 rounded-xl bg-white/5 hover:bg-white/[0.08] focus:bg-white/10 border border-white/10 focus:border-indigo-500/50 text-white placeholder-white/20 text-xs tracking-wide focus:outline-none transition-all"
                  />
                </div>

                {/* ── Simulador de Fase Cognitiva ── */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/45 flex items-center justify-between">
                    <span>Simulador de Fase Cognitiva</span>
                    <span className="text-[9px] text-indigo-400 font-normal">Modo Demo</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['PEAK_FOCUS', 'LINEAR_EXECUTION', 'SYNAPTIC_FATIGUE', 'REDUCED_CAPACITY_MODE'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPhaseOverride(phaseOverride === p ? null : p)}
                        className={`h-9 rounded-xl border text-[9px] font-bold tracking-wide uppercase transition-all ${
                          phaseOverride === p
                            ? 'bg-indigo-500 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {p.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  {phaseOverride && (
                    <button
                      type="button"
                      onClick={() => setPhaseOverride(null)}
                      className="w-full h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      Restablecer Ritmo Real
                    </button>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-3 flex gap-2.5 items-start">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-[11px] text-red-300 leading-relaxed">{error}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setShowConfig(false)}
                    className="h-10 px-4 rounded-xl hover:bg-white/5 text-xs text-white/60 hover:text-white transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveKey}
                    className="h-10 px-5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-xs text-white font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.35)]"
                  >
                    Guardar Configuración
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
