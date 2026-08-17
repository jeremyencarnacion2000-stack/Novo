'use client'

import Link from 'next/link'
import { Brain, MessageCircle } from 'lucide-react'
import { CognitiveCommandSurface } from '@/components/cognitive/cognitive-command-surface'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import { useTranslation } from '@/lib/i18n'

const copy = {
  en: { title: 'Your context', subtitle: 'The Twin’s working view', chat: 'Talk to the Twin', morning: 'Morning focus', intermediate: 'Balanced', night: 'Evening focus' },
  es: { title: 'Tu contexto', subtitle: 'La vista activa del Gemelo', chat: 'Hablar con el Gemelo', morning: 'Foco matutino', intermediate: 'Intermedio', night: 'Foco nocturno' },
  fr: { title: 'Votre contexte', subtitle: 'La vue active du Jumeau', chat: 'Parler au Jumeau', morning: 'Profil matinal', intermediate: 'Intermédiaire', night: 'Profil nocturne' },
  de: { title: 'Dein Kontext', subtitle: 'Die aktive Sicht des Zwillings', chat: 'Mit dem Zwilling sprechen', morning: 'Morgentyp', intermediate: 'Ausgeglichen', night: 'Abendtyp' },
} as const

export default function CognitivePage() {
  const { language } = useTranslation()
  const { chronotype, setChronotype } = useCognitiveEngine()
  const labels = copy[language as keyof typeof copy] ?? copy.en

  return (
    <main className="cognitive-page h-full min-h-0 w-full p-3 sm:p-4 lg:p-6">
      <div className="cognitive-shell relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-foreground/[0.08] bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_70px_-48px_rgba(0,0,0,0.75)]">
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary" aria-hidden="true"><Brain className="size-4" strokeWidth={1.7} /></div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">{labels.title}</h1>
              <p className="mt-0.5 truncate text-[11px] text-foreground/45">{labels.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={chronotype} onValueChange={(value) => setChronotype(value as typeof chronotype)}>
              <SelectTrigger size="sm" aria-label={labels.subtitle} className="max-w-[8.5rem] rounded-xl border-foreground/[0.09] bg-foreground/[0.035] text-xs text-foreground/70 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-foreground/[0.1] bg-popover/98 p-1 shadow-2xl">
                <SelectItem value="morning_lark" className="rounded-xl text-xs">{labels.morning}</SelectItem>
                <SelectItem value="intermediate" className="rounded-xl text-xs">{labels.intermediate}</SelectItem>
                <SelectItem value="night_owl" className="rounded-xl text-xs">{labels.night}</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/chat" aria-label={labels.chat} className="grid size-9 place-items-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary transition-colors hover:bg-primary/[0.14]"><MessageCircle className="size-4" /></Link>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="px-4 pb-8 sm:px-6 sm:pb-10">
            <CognitiveCommandSurface onPrimaryAction={() => { window.location.href = '/focus' }} />
          </div>
        </div>
      </div>
    </main>
  )
}
