'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Crown, CreditCard, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Section, SafeAction } from './settings-shared'
import { InlineNovoPaywall } from '@/components/billing/novo-paywall'
import { useTranslation } from '@/lib/i18n'

const BILLING_COPY = {
  es: {
    loadError: 'No se pudo cargar tu plan',
    confirming: 'Confirmando tu pago… esto puede tardar unos segundos.',
    welcome: '¡Bienvenido a Novo Pro!',
    active: 'Tu suscripción está activa.',
    plan: 'Tu plan',
    annual: 'anual',
    monthly: 'mensual',
    cancels: 'Se cancela el',
    freeHint: 'Acciones de IA ilimitadas con Pro',
    usage: 'Acciones de IA este mes',
    billing: 'Facturación',
    opening: 'Abriendo portal…',
    manage: 'Administrar facturación',
    manageDescription: 'Cambia tu método de pago, ve facturas o cancela tu suscripción.',
    portalError: 'No se pudo abrir el portal de facturación',
    upgrade: 'Actualizar a Pro',
  },
  en: {
    loadError: 'Your plan could not be loaded',
    confirming: 'Confirming your payment… this may take a few seconds.',
    welcome: 'Welcome to Novo Pro!',
    active: 'Your subscription is active.',
    plan: 'Your plan',
    annual: 'yearly',
    monthly: 'monthly',
    cancels: 'Cancels on',
    freeHint: 'Unlimited AI actions with Pro',
    usage: 'AI actions this month',
    billing: 'Billing',
    opening: 'Opening portal…',
    manage: 'Manage billing',
    manageDescription: 'Change your payment method, view invoices, or cancel your subscription.',
    portalError: 'The billing portal could not be opened',
    upgrade: 'Upgrade to Pro',
  },
  fr: {
    loadError: 'Impossible de charger votre forfait',
    confirming: 'Confirmation de votre paiement… cela peut prendre quelques secondes.',
    welcome: 'Bienvenue dans Novo Pro !',
    active: 'Votre abonnement est actif.',
    plan: 'Votre forfait',
    annual: 'annuel',
    monthly: 'mensuel',
    cancels: 'Annulation le',
    freeHint: 'Actions IA illimitées avec Pro',
    usage: 'Actions IA ce mois-ci',
    billing: 'Facturation',
    opening: 'Ouverture du portail…',
    manage: 'Gérer la facturation',
    manageDescription: 'Modifiez votre moyen de paiement, consultez vos factures ou annulez votre abonnement.',
    portalError: 'Impossible d’ouvrir le portail de facturation',
    upgrade: 'Passer à Pro',
  },
  de: {
    loadError: 'Dein Tarif konnte nicht geladen werden',
    confirming: 'Zahlung wird bestätigt… das kann einige Sekunden dauern.',
    welcome: 'Willkommen bei Novo Pro!',
    active: 'Dein Abonnement ist aktiv.',
    plan: 'Dein Tarif',
    annual: 'jährlich',
    monthly: 'monatlich',
    cancels: 'Endet am',
    freeHint: 'Unbegrenzte KI-Aktionen mit Pro',
    usage: 'KI-Aktionen in diesem Monat',
    billing: 'Abrechnung',
    opening: 'Portal wird geöffnet…',
    manage: 'Abrechnung verwalten',
    manageDescription: 'Zahlungsmethode ändern, Rechnungen ansehen oder das Abonnement kündigen.',
    portalError: 'Das Abrechnungsportal konnte nicht geöffnet werden',
    upgrade: 'Auf Pro upgraden',
  },
} as const

interface BillingStatus {
  plan: 'free' | 'pro'
  actionsUsed: number
  actionsLimit: number
  interval: 'month' | 'year' | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export function SettingsBilling() {
  const { toast } = useToast()
  const { language } = useTranslation()
  const locale = language === 'es' || language === 'fr' || language === 'de' ? language : 'en'
  const copy = BILLING_COPY[locale]
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [redirecting, setRedirecting] = useState<'portal' | null>(null)
  const confirmingUpgrade = searchParams?.get('upgraded') === '1'
  const paywallSource = searchParams?.get('source') === 'landing-intent' ? 'landing-intent' : 'settings'
  const toldRef = useRef(false)

  const loadStatus = () => fetch('/api/billing/status').then(res => res.json())

  useEffect(() => {
    loadStatus()
      .then(setStatus)
      .catch(() => toast({ title: copy.loadError, variant: 'destructive' }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The billing webhook can take a few seconds to land after checkout
  // redirect — poll briefly instead of trusting the first read, since the
  // plan flip happens server-side and isn't guaranteed to have landed yet.
  useEffect(() => {
    if (!confirmingUpgrade) return
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      const next = await loadStatus().catch(() => null)
      if (next) setStatus(next)
      if (next?.plan === 'pro' || attempts >= 8) {
        clearInterval(interval)
        if (next?.plan === 'pro' && !toldRef.current) {
          toldRef.current = true
          toast({ title: copy.welcome, description: copy.active })
        }
        router.replace('/settings')
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [confirmingUpgrade]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToPortal = async () => {
    setRedirecting('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch {
      toast({ title: copy.portalError, variant: 'destructive' })
      setRedirecting(null)
    }
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/30" />
      </div>
    )
  }

  const isPro = status.plan === 'pro'
  const usagePct = Math.min(100, (status.actionsUsed / status.actionsLimit) * 100)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {confirmingUpgrade && !isPro && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/[0.05]">
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          <p className="text-xs text-foreground/60">{copy.confirming}</p>
        </div>
      )}

      <Section title={copy.plan}>
        <div className="novo-premium-field rounded-2xl border border-primary/15 p-5 space-y-4 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPro ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-foreground/[0.04] border border-foreground/[0.06]'}`}>
              <Crown className={`w-4 h-4 ${isPro ? 'text-amber-400' : 'text-foreground/40'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground/85">
                {isPro ? 'Novo Pro' : 'Novo Free'}
                {isPro && status.interval && <span className="text-foreground/35 font-normal"> · {status.interval === 'year' ? copy.annual : copy.monthly}</span>}
              </p>
              {isPro && status.cancelAtPeriodEnd && status.currentPeriodEnd && (
                <p className="text-xs text-amber-400/70 mt-0.5">
                  {copy.cancels} {new Date(status.currentPeriodEnd).toLocaleDateString(locale)}
                </p>
              )}
              {!isPro && (
                <p className="text-xs text-foreground/35 mt-0.5">{copy.freeHint}</p>
              )}
            </div>
          </div>

          {!isPro && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground/40">{copy.usage}</span>
                <span className="text-foreground/60 font-medium">{status.actionsUsed} / {status.actionsLimit}</span>
              </div>
              <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usagePct >= 100 ? 'bg-red-400' : 'bg-primary'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Section>

      {isPro ? (
        <Section title={copy.billing}>
          <SafeAction
            icon={CreditCard}
            label={redirecting === 'portal' ? copy.opening : copy.manage}
            description={copy.manageDescription}
            onClick={goToPortal}
            loading={redirecting === 'portal'}
          />
        </Section>
      ) : (
        <Section title={copy.upgrade}>
          <InlineNovoPaywall source={paywallSource} />
        </Section>
      )}
    </div>
  )
}
