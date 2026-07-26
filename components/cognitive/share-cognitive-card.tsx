'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, Copy, Check, Sparkles, Brain, X } from 'lucide-react'
import { ConfidenceGauge, TrustBadge } from '@/components/cognitive/primitives'

interface ShareCognitiveCardProps {
  isOpen: boolean
  onClose: () => void
  twinScore?: number
  trustLevel?: string
  chronotype?: string
  peakWindow?: string
  focusStyle?: string
  cognitiveLoad?: number
  burnoutRisk?: number
}

export function ShareCognitiveCard({
  isOpen,
  onClose,
  twinScore = 88,
  trustLevel = 'high',
  chronotype = 'Búho Nocturno',
  peakWindow = '20:00 - 23:00',
  focusStyle = 'Constructor Profundo',
  cognitiveLoad = 35,
  burnoutRisk = 12,
}: ShareCognitiveCardProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const shareText = `Mi Cognitive Twin en Novo OS:
- Precisión Cognitiva: ${twinScore}%
- Ventana de Foco Pico: ${peakWindow}
- Estilo de Foco: ${focusStyle}
- Carga Cognitiva: ${cognitiveLoad}% | Riesgo de Fatiga: ${burnoutRisk}%

Optimiza tu rendimiento cognitivo sin burnout con Novo -> https://productivitynovo.vercel.app`

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (e) {
      console.error('Failed to copy share text:', e)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md rounded-3xl bg-[#09090e] border border-indigo-500/30 p-6 md:p-8 shadow-[0_0_50px_rgba(99,102,241,0.2)] text-white overflow-hidden"
        >
          {/* Background Glow Accents */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <Brain className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xs font-black tracking-[0.2em] uppercase text-white/90">Novo Cognitive System</h3>
              <p className="text-[10px] text-white/40">Tarjeta de Resumen Cognitivo</p>
            </div>
          </div>

          {/* Shareable Glass Card Surface */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl mb-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-4">
                <ConfidenceGauge score={twinScore} size="sm" />
                <div>
                  <p className="text-[9px] font-black tracking-widest text-white/40 uppercase">ACCURACY</p>
                  <TrustBadge level={trustLevel as any} />
                </div>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                OPTIMAL
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <span className="text-[9px] font-black tracking-wider uppercase text-white/40 block mb-1">Ventana Pico</span>
                <span className="text-xs font-bold text-indigo-400">{peakWindow}</span>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <span className="text-[9px] font-black tracking-wider uppercase text-white/40 block mb-1">Estilo de Foco</span>
                <span className="text-xs font-bold text-white capitalize">{focusStyle}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-white/60 pt-2 border-t border-white/5">
              <span>Carga Cognitiva: <strong className="text-white">{cognitiveLoad}%</strong></span>
              <span>Riesgo Fatiga: <strong className="text-emerald-400">{burnoutRisk}%</strong></span>
            </div>
          </div>

          {/* Share Actions */}
          <div className="space-y-3">
            <button
              onClick={handleCopyText}
              className="w-full h-12 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-98 text-white font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  ¡Copiado al portapapeles!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Tarjeta para Redes / Slack
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-white/40">
              Comparte tus métricas de foco con tu equipo o red profesional.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
