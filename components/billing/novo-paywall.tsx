'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Check, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { modalFlip } from '@/lib/modal-flip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export type PaywallSource = 'settings' | 'twin-mode' | 'limit' | 'landing-intent'
type Interval = 'month' | 'year'
type SupportedLanguage = 'en' | 'es' | 'fr' | 'de'
const PAYWALL_VARIANT = 'comparison-v1'

const COPY = {
  es: {
    eyebrow: 'NOVO PRO · PLAN DE PAGO',
    title: 'Convierte tu contexto en una dirección diaria.',
    twinTitle: 'Activa todo el contexto de tu Gemelo.',
    limitTitle: 'Sigue avanzando sin esperar al próximo mes.',
    description: 'Pro mantiene a Novo disponible cuando el trabajo se vuelve complejo y tu atención importa más.',
    twinDescription: 'Tu Gemelo ya detectó el contexto. Pro le permite conservarlo y convertirlo en una siguiente acción personal.',
    limitDescription: 'Ya utilizaste las acciones incluidas en Free. Pro elimina el límite sin perder el contexto de esta conversación.',
    landingDescription: 'Tu primer día ya está preparado. Pro conserva ese contexto, amplía el historial y mantiene la asistencia disponible.',
    month: 'Mensual',
    year: 'Anual',
    save: 'Ahorra 20%',
    perMonth: '/mes',
    billedYearly: '$95.99 al año',
    chargeMonth: 'Se cobran $9.99 ahora y cada mes.',
    chargeYear: 'Se cobran $95.99 ahora y después cada año.',
    compareFree: 'Free',
    compareFreeValue: 'Acciones mensuales e historial de 30 días',
    comparePro: 'Pro',
    compareProValue: 'Acciones ilimitadas y contexto completo',
    benefits: [
      'Acciones de IA ilimitadas',
      'Modo Twin con tu contexto cognitivo completo',
      'Historial de analíticas sin límite de 30 días',
      'Mapa cognitivo avanzado',
    ],
    ctaMonth: 'Continuar por $9.99 al mes',
    ctaYear: 'Continuar por $95.99 al año',
    reassurance: 'Pago seguro con Lemon Squeezy. Cancela cuando quieras desde tu cuenta.',
    error: 'No se pudo abrir el pago. Inténtalo de nuevo.',
    close: 'Ahora no',
  },
  en: {
    eyebrow: 'NOVO PRO · PAID PLAN',
    title: 'Turn your context into a clear daily direction.',
    twinTitle: 'Unlock the full context of your Twin.',
    limitTitle: 'Keep moving without waiting for next month.',
    description: 'Pro keeps Novo available when work gets complex and your attention matters most.',
    twinDescription: 'Your Twin has already found the context. Pro lets it retain that context and turn it into a personal next step.',
    limitDescription: 'You have used the actions included with Free. Pro removes the limit without losing this conversation’s context.',
    landingDescription: 'Your first day is ready. Pro preserves that context, extends your history, and keeps assistance available.',
    month: 'Monthly',
    year: 'Yearly',
    save: 'Save 20%',
    perMonth: '/month',
    billedYearly: '$95.99 billed yearly',
    chargeMonth: '$9.99 is charged now and every month.',
    chargeYear: '$95.99 is charged now and then every year.',
    compareFree: 'Free',
    compareFreeValue: 'Monthly actions and 30-day history',
    comparePro: 'Pro',
    compareProValue: 'Unlimited actions and full context',
    benefits: ['Unlimited AI actions', 'Twin Mode with your full cognitive context', 'Analytics history beyond 30 days', 'Advanced cognitive map'],
    ctaMonth: 'Continue for $9.99 a month',
    ctaYear: 'Continue for $95.99 a year',
    reassurance: 'Secure payment by Lemon Squeezy. Cancel anytime from your account.',
    error: 'Payment could not be opened. Please try again.',
    close: 'Not now',
  },
  fr: {
    eyebrow: 'NOVO PRO · FORFAIT PAYANT',
    title: 'Transformez votre contexte en une direction quotidienne claire.',
    twinTitle: 'Activez tout le contexte de votre Jumeau.',
    limitTitle: 'Continuez sans attendre le mois prochain.',
    description: 'Pro garde Novo disponible lorsque le travail devient complexe et que votre attention compte le plus.',
    twinDescription: 'Votre Jumeau a déjà identifié le contexte. Pro lui permet de le conserver et d’en faire une prochaine étape personnelle.',
    limitDescription: 'Vous avez utilisé les actions incluses dans Free. Pro supprime la limite sans perdre le contexte de cette conversation.',
    landingDescription: 'Votre première journée est prête. Pro conserve ce contexte, étend l’historique et maintient l’assistance disponible.',
    month: 'Mensuel',
    year: 'Annuel',
    save: 'Économisez 20 %',
    perMonth: '/mois',
    billedYearly: '95,99 $ par an',
    chargeMonth: '9,99 $ sont facturés maintenant, puis chaque mois.',
    chargeYear: '95,99 $ sont facturés maintenant, puis chaque année.',
    compareFree: 'Free',
    compareFreeValue: 'Actions mensuelles et historique de 30 jours',
    comparePro: 'Pro',
    compareProValue: 'Actions illimitées et contexte complet',
    benefits: ['Actions IA illimitées', 'Mode Jumeau avec votre contexte cognitif complet', 'Historique analytique sans limite de 30 jours', 'Carte cognitive avancée'],
    ctaMonth: 'Continuer pour 9,99 $ par mois',
    ctaYear: 'Continuer pour 95,99 $ par an',
    reassurance: 'Paiement sécurisé par Lemon Squeezy. Annulez à tout moment.',
    error: 'Impossible d’ouvrir le paiement. Réessayez.',
    close: 'Plus tard',
  },
  de: {
    eyebrow: 'NOVO PRO · KOSTENPFLICHTIG',
    title: 'Verwandle deinen Kontext in eine klare tägliche Richtung.',
    twinTitle: 'Aktiviere den vollständigen Kontext deines Zwillings.',
    limitTitle: 'Mach weiter, ohne bis zum nächsten Monat zu warten.',
    description: 'Pro hält Novo verfügbar, wenn die Arbeit komplex wird und deine Aufmerksamkeit am wichtigsten ist.',
    twinDescription: 'Dein Zwilling hat den Kontext bereits erkannt. Mit Pro kann er ihn behalten und in einen persönlichen nächsten Schritt verwandeln.',
    limitDescription: 'Du hast die in Free enthaltenen Aktionen genutzt. Pro hebt das Limit auf, ohne den Kontext dieses Gesprächs zu verlieren.',
    landingDescription: 'Dein erster Tag ist bereit. Pro bewahrt diesen Kontext, erweitert deinen Verlauf und hält die Assistenz verfügbar.',
    month: 'Monatlich',
    year: 'Jährlich',
    save: '20 % sparen',
    perMonth: '/Monat',
    billedYearly: '95,99 $ pro Jahr',
    chargeMonth: '9,99 $ werden jetzt und danach monatlich berechnet.',
    chargeYear: '95,99 $ werden jetzt und danach jährlich berechnet.',
    compareFree: 'Free',
    compareFreeValue: 'Monatliche Aktionen und 30 Tage Verlauf',
    comparePro: 'Pro',
    compareProValue: 'Unbegrenzte Aktionen und vollständiger Kontext',
    benefits: ['Unbegrenzte KI-Aktionen', 'Twin-Modus mit vollständigem kognitivem Kontext', 'Analyseverlauf über 30 Tage hinaus', 'Erweiterte kognitive Karte'],
    ctaMonth: 'Für 9,99 $ monatlich fortfahren',
    ctaYear: 'Für 95,99 $ jährlich fortfahren',
    reassurance: 'Sichere Zahlung über Lemon Squeezy. Jederzeit kündbar.',
    error: 'Die Zahlung konnte nicht geöffnet werden. Versuche es erneut.',
    close: 'Nicht jetzt',
  },
} as const

function trackPaywall(event: string, source: PaywallSource, interval?: Interval) {
  if (typeof window === 'undefined') return
  const detail = { event, source, interval, paywall_variant: PAYWALL_VARIANT }
  window.dispatchEvent(new CustomEvent('novo:paywall', { detail }))
  const posthog = (window as typeof window & {
    posthog?: { capture: (name: string, properties: Record<string, string | undefined>) => void }
  }).posthog
  posthog?.capture(event, { source, interval, paywall_variant: PAYWALL_VARIANT })
}

function PaywallOffer({
  source,
  className,
  onDismiss,
}: {
  source: PaywallSource
  className?: string
  onDismiss?: () => void
}) {
  const { language } = useTranslation()
  const locale = (language in COPY ? language : 'en') as SupportedLanguage
  const copy = COPY[locale]
  const { toast } = useToast()
  const [interval, setInterval] = useState<Interval>('year')
  const [redirecting, setRedirecting] = useState(false)

  const title = source === 'twin-mode'
    ? copy.twinTitle
    : source === 'limit'
      ? copy.limitTitle
      : copy.title
  const description = source === 'twin-mode'
    ? copy.twinDescription
    : source === 'limit'
      ? copy.limitDescription
      : source === 'landing-intent'
        ? copy.landingDescription
        : copy.description

  const checkout = async () => {
    setRedirecting(true)
    trackPaywall('paywall_checkout_started', source, interval)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval, source, locale }),
      })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error)
      window.location.href = data.url
    } catch {
      trackPaywall('paywall_checkout_failed', source, interval)
      toast({ title: copy.error, variant: 'destructive' })
      setRedirecting(false)
    }
  }

  return (
    <div data-modal-content className={cn('novo-premium-field overflow-hidden rounded-[1.75rem] border border-primary/15 text-foreground shadow-[0_24px_70px_rgba(0,0,0,0.18)]', className)}>
      <div className="relative overflow-hidden border-b border-foreground/[0.07] px-5 pb-6 pt-5 sm:px-7 sm:pt-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-primary/[0.1] blur-3xl" />
        <div className="relative">
          <div className="mb-5 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-primary">
              <Sparkles className="size-3.5" /> {copy.eyebrow}
            </span>
            <span className="rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
              {copy.save}
            </span>
          </div>
          <h2 className="max-w-lg text-[1.8rem] font-medium leading-[1.03] tracking-[-0.05em] sm:text-[2.15rem]">
            {title}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-foreground/55">
            {description}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        <div className="grid grid-cols-2 rounded-2xl bg-foreground/[0.045] p-1">
          {(['month', 'year'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setInterval(value)
                trackPaywall('paywall_interval_selected', source, value)
              }}
              aria-pressed={interval === value}
              className={cn(
                'h-10 rounded-xl text-xs font-semibold transition-[background,color,transform,box-shadow] duration-200 active:scale-[0.98]',
                interval === value
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-foreground/48 hover:text-foreground/75',
              )}
            >
              {value === 'month' ? copy.month : copy.year}
            </button>
          ))}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-4xl font-semibold tracking-[-0.06em]">
              {interval === 'year' ? '$8.00' : '$9.99'}
            </span>
            <span className="ml-1 text-sm text-foreground/45">{copy.perMonth}</span>
          </div>
          {interval === 'year' && <span className="pb-1 text-xs text-foreground/48">{copy.billedYearly}</span>}
        </div>
        <p className="text-xs leading-relaxed text-foreground/52">
          {interval === 'year' ? copy.chargeYear : copy.chargeMonth}
        </p>

        <div className="grid overflow-hidden rounded-2xl border border-foreground/[0.08] sm:grid-cols-2">
          <div className="border-b border-foreground/[0.08] bg-foreground/[0.018] p-3.5 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/40">{copy.compareFree}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/52">{copy.compareFreeValue}</p>
          </div>
          <div className="bg-primary/[0.055] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{copy.comparePro}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/72">{copy.compareProValue}</p>
          </div>
        </div>

        <div className="grid gap-3 border-y border-foreground/[0.07] py-5 sm:grid-cols-2">
          {copy.benefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/[0.12] text-primary">
                <Check className="size-3" strokeWidth={2.5} />
              </span>
              <span className="text-xs leading-relaxed text-foreground/68">{benefit}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={checkout}
          disabled={redirecting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_35px_rgba(var(--primary-rgb),0.17)] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
        >
          {redirecting
            ? <Loader2 className="size-4 animate-spin" />
            : <>{interval === 'year' ? copy.ctaYear : copy.ctaMonth}<ArrowRight className="size-4" /></>}
        </button>

        <div className="flex items-start justify-center gap-2 text-center text-[10px] leading-relaxed text-foreground/42">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>{copy.reassurance}</span>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={() => {
              trackPaywall('paywall_dismissed', source, interval)
              onDismiss()
            }}
            className="mx-auto block text-xs text-foreground/42 transition-colors hover:text-foreground/75"
          >
            {copy.close}
          </button>
        )}
      </div>
    </div>
  )
}

export function InlineNovoPaywall({ source = 'settings' }: { source?: PaywallSource }) {
  useEffect(() => trackPaywall('paywall_viewed', source), [source])
  return <PaywallOffer source={source} />
}

export function NovoPaywallDialog({
  open,
  onOpenChange,
  source,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: PaywallSource
}) {
  const { language } = useTranslation()
  const locale = (language in COPY ? language : 'en') as SupportedLanguage
  const copy = COPY[locale]

  useEffect(() => {
    if (open) {
      trackPaywall('paywall_viewed', source)
      requestAnimationFrame(() => modalFlip.toggle('novo-paywall'))
    }
  }, [open, source])

  const requestClose = () => {
    modalFlip.untoggle('novo-paywall', () => onOpenChange(false))
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : requestClose()}>
      <DialogContent
        data-flip-to="novo-paywall"
        showCloseButton={false}
        className="max-h-[calc(100dvh-1rem)] max-w-[40rem] overflow-y-auto overscroll-contain border-0 bg-transparent p-0 shadow-none [scrollbar-width:none] sm:max-h-[calc(100dvh-2rem)]"
      >
        <DialogTitle className="sr-only">Novo Pro</DialogTitle>
        <DialogDescription className="sr-only">{copy.eyebrow}</DialogDescription>
        <PaywallOffer source={source} onDismiss={requestClose} />
      </DialogContent>
    </Dialog>
  )
}
