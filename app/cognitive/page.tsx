'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ChevronDown, MessageCircle, Plug } from 'lucide-react'
import { CognitiveCommandSurface } from '@/components/cognitive/cognitive-command-surface'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import { useTranslation } from '@/lib/i18n'

const NovoLoopCard = dynamic(() => import('@/components/cognitive/novo-loop-card').then(module => ({ default: module.NovoLoopCard })), {
  loading: () => <p role="status" className="p-5 text-sm text-foreground/70">Preparando tu siguiente paso…</p>,
})

const copy = {
  en: { title: 'Your context', subtitle: 'What Novo understands, what supports it and what to do next.', chat: 'Talk to Novo', sources: 'Connections', plan: 'Decide the next step', detail: 'Review your plan, record progress and adjust your focus.', rhythm: 'Attention rhythm', morning: 'Morning focus', intermediate: 'Balanced', night: 'Evening focus' },
  es: { title: 'Tu contexto', subtitle: 'Lo que Novo entiende, qué lo respalda y cómo seguir avanzando.', chat: 'Hablar con Novo', sources: 'Conexiones', plan: 'Decidir el siguiente paso', detail: 'Revisa tu plan, registra avances y ajusta tu enfoque.', rhythm: 'Ritmo de atención', morning: 'Foco matutino', intermediate: 'Intermedio', night: 'Foco nocturno' },
  fr: { title: 'Votre contexte', subtitle: 'Ce que Novo comprend, sur quoi il s’appuie et comment avancer.', chat: 'Parler à Novo', sources: 'Connexions', plan: 'Décider de la prochaine étape', detail: 'Consultez votre plan, suivez les progrès et ajustez votre attention.', rhythm: 'Rythme d’attention', morning: 'Profil matinal', intermediate: 'Intermédiaire', night: 'Profil nocturne' },
  de: { title: 'Dein Kontext', subtitle: 'Was Novo versteht, worauf es beruht und wie es weitergeht.', chat: 'Mit Novo sprechen', sources: 'Verbindungen', plan: 'Den nächsten Schritt wählen', detail: 'Prüfe deinen Plan, erfasse Fortschritte und passe deinen Fokus an.', rhythm: 'Aufmerksamkeitsrhythmus', morning: 'Morgentyp', intermediate: 'Ausgeglichen', night: 'Abendtyp' },
} as const

export default function CognitivePage() {
  const { language } = useTranslation()
  const { chronotype, setChronotype } = useCognitiveEngine()
  const labels = copy[language as keyof typeof copy] ?? copy.en
  const planRef = useRef<HTMLDetailsElement>(null)
  const [planRequested, setPlanRequested] = useState(false)

  const openPlan = () => {
    setPlanRequested(true)
    if (!planRef.current) return
    planRef.current.open = true
    planRef.current.scrollIntoView?.({ block: 'start', behavior: 'auto' })
    planRef.current.querySelector('summary')?.focus()
  }

  return (
    <section className="cognitive-page min-w-0 space-y-6" aria-labelledby="cognitive-page-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="cognitive-page-title" className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{labels.title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/70">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/connectors" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/10 px-4 text-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/[0.06]"><Plug className="size-3.5" />{labels.sources}</Link>
          <Link href="/chat" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background transition-opacity hover:opacity-85"><MessageCircle className="size-3.5" />{labels.chat}</Link>
        </div>
      </header>

      <details ref={planRef} onToggle={() => { if (planRef.current?.open) setPlanRequested(true) }} className="group scroll-mt-6 rounded-[24px] border border-foreground/10 bg-foreground/[0.025]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-[24px] px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
          <span><span className="block text-sm font-semibold text-foreground">{labels.plan}</span><span className="mt-1 block text-xs leading-relaxed text-foreground/65">{labels.detail}</span></span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-foreground/60 transition-transform group-open:rotate-180" />
        </summary>
        {planRequested && <div className="border-t border-foreground/10 p-3 sm:p-4"><NovoLoopCard /></div>}
      </details>

      <CognitiveCommandSurface onPrimaryAction={openPlan} />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 py-4">
        <label htmlFor="cognitive-rhythm" className="text-xs text-foreground/70">{labels.rhythm}</label>
        <Select value={chronotype} onValueChange={(value) => setChronotype(value as typeof chronotype)}>
          <SelectTrigger id="cognitive-rhythm" size="sm" className="w-40 rounded-xl border-foreground/10 bg-transparent text-xs text-foreground/80"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="morning_lark">{labels.morning}</SelectItem>
            <SelectItem value="intermediate">{labels.intermediate}</SelectItem>
            <SelectItem value="night_owl">{labels.night}</SelectItem>
          </SelectContent>
        </Select>
      </footer>
    </section>
  )
}
