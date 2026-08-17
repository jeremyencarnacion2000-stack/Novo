'use client'

import React, { useState } from 'react'
import { Copy, Check, Brain, X } from 'lucide-react'
import { ConfidenceGauge, TrustBadge } from '@/components/cognitive/primitives'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useModalFlip } from '@/hooks/use-modal-flip'
import { useTranslation } from '@/lib/i18n'

const SHARE_COPY = {
  en: { title: 'Novo planning summary', subtitle: 'Shareable operational context', accuracy: 'Profile confidence', optimal: 'Planning context', peak: 'Preferred focus window', style: 'Work style', load: 'Estimated operational workload', fatigue: '', copied: 'Copied to clipboard', copy: 'Copy summary', helper: 'Share only the planning context you choose.', close: 'Close' },
  es: { title: 'Sistema cognitivo Novo', subtitle: 'Resumen cognitivo para compartir', accuracy: 'Precisión', optimal: 'Estable', peak: 'Ventana pico', style: 'Estilo de foco', load: 'Carga cognitiva', fatigue: 'Riesgo de fatiga', copied: 'Copiado al portapapeles', copy: 'Copiar resumen', helper: 'Comparte tus métricas de foco con tu equipo o red profesional.', close: 'Cerrar' },
  fr: { title: 'Système cognitif Novo', subtitle: 'Résumé cognitif à partager', accuracy: 'Précision', optimal: 'Stable', peak: 'Fenêtre optimale', style: 'Style de concentration', load: 'Charge cognitive', fatigue: 'Risque de fatigue', copied: 'Copié dans le presse-papiers', copy: 'Copier le résumé', helper: 'Partagez vos mesures de concentration avec votre équipe.', close: 'Fermer' },
  de: { title: 'Novo Kognitivsystem', subtitle: 'Teilbare kognitive Zusammenfassung', accuracy: 'Genauigkeit', optimal: 'Stabil', peak: 'Hochphase', style: 'Fokusstil', load: 'Kognitive Last', fatigue: 'Ermüdungsrisiko', copied: 'In die Zwischenablage kopiert', copy: 'Zusammenfassung kopieren', helper: 'Teile deine Fokuswerte mit deinem Team oder Netzwerk.', close: 'Schließen' },
} as const

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
  twinScore = 0,
  trustLevel = 'initial',
  chronotype = 'Búho Nocturno',
  peakWindow = 'Sin estimar',
  focusStyle = 'Sin calibrar',
  cognitiveLoad = 0,
  burnoutRisk: _burnoutRisk = 0,
}: ShareCognitiveCardProps) {
  const [copied, setCopied] = useState(false)
  const { language } = useTranslation()
  const copy = SHARE_COPY[language as keyof typeof SHARE_COPY] ?? SHARE_COPY.en
  const operationalLoadLabel = language === 'es'
    ? 'Carga operativa estimada'
    : language === 'fr'
      ? 'Charge opérationnelle estimée'
      : language === 'de'
        ? 'Geschätzte operative Auslastung'
        : copy.load
  const closeFlip = useModalFlip('cognitive-share', isOpen)
  const handleClose = () => closeFlip(onClose)

  const shareText = `Mi resumen de planificación en Novo:
- Precisión Cognitiva: ${twinScore}%
- Ventana de Foco Pico: ${peakWindow}
- Estilo de Foco: ${focusStyle}
- Carga operativa estimada: ${cognitiveLoad}%

Organiza tu siguiente paso con Novo -> https://productivitynovo.vercel.app`

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
    <Dialog open={isOpen} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent
        data-flip-to="cognitive-share"
        showCloseButton={false}
        className="max-w-[min(28rem,calc(100%-1.5rem))] overflow-hidden rounded-[28px] border-foreground/[0.1] bg-background/96 p-5 text-foreground shadow-[0_28px_90px_-36px_rgba(0,0,0,0.75)] sm:p-7"
      >
        <div data-modal-content>

          {/* Close Button */}
          <button
            onClick={handleClose}
            aria-label={copy.close}
            className="absolute right-5 top-5 rounded-full p-2 text-foreground/50 transition-[color,background-color,transform] duration-150 hover:bg-foreground/[0.07] hover:text-foreground active:scale-[0.97]"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <DialogHeader className="mb-6 flex-row items-center gap-2 space-y-0 pr-10 text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <Brain className="w-4 h-4 text-primary" strokeWidth={1.7} />
            </div>
            <div>
              <DialogTitle className="text-xs font-black uppercase tracking-[0.2em] text-foreground/90">{copy.title}</DialogTitle>
              <p className="text-[10px] text-foreground/45">{copy.subtitle}</p>
            </div>
          </DialogHeader>

          {/* Shareable Glass Card Surface */}
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-5">
            <div className="mb-4 flex items-center justify-between border-b border-foreground/10 pb-4">
              <div className="flex items-center gap-4">
                <ConfidenceGauge score={twinScore} size="sm" />
                <div>
                  <p className="text-[9px] font-black tracking-widest text-foreground/45 uppercase">{copy.accuracy}</p>
                  <TrustBadge level={trustLevel as any} />
                </div>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                {copy.optimal}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-foreground/[0.07] bg-foreground/[0.018] p-3">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-foreground/45">{copy.peak}</span>
                <span className="text-xs font-bold text-primary">{peakWindow}</span>
              </div>
              <div className="rounded-xl border border-foreground/[0.07] bg-foreground/[0.018] p-3">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-foreground/45">{copy.style}</span>
                <span className="text-xs font-bold text-foreground capitalize">{focusStyle}</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-foreground/[0.07] pt-2 text-xs text-foreground/60">
              <span>{operationalLoadLabel}: <strong className="text-foreground">{cognitiveLoad}%</strong></span>
            </div>
          </div>

          {/* Share Actions */}
          <div className="space-y-3">
            <button
              onClick={handleCopyText}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold tracking-wide text-primary-foreground transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  {copy.copied}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  {copy.copy}
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-foreground/45">
              {copy.helper}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
