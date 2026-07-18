'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Crown, Zap, CreditCard, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Section, SafeAction } from './settings-shared'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [redirecting, setRedirecting] = useState<'checkout' | 'portal' | null>(null)
  const confirmingUpgrade = searchParams?.get('upgraded') === '1'
  const toldRef = useRef(false)

  const loadStatus = () => fetch('/api/billing/status').then(res => res.json())

  useEffect(() => {
    loadStatus()
      .then(setStatus)
      .catch(() => toast({ title: 'No se pudo cargar tu plan', variant: 'destructive' }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Stripe's webhook can take a few seconds to land after the checkout
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
          toast({ title: '¡Bienvenido a Novo Pro!', description: 'Tu suscripción está activa.' })
        }
        router.replace('/settings')
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [confirmingUpgrade]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToCheckout = async (interval: 'month' | 'year') => {
    setRedirecting('checkout')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch {
      toast({ title: 'No se pudo iniciar el pago', variant: 'destructive' })
      setRedirecting(null)
    }
  }

  const goToPortal = async () => {
    setRedirecting('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch {
      toast({ title: 'No se pudo abrir el portal de facturación', variant: 'destructive' })
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
          <p className="text-xs text-foreground/60">Confirmando tu pago con Stripe... esto puede tardar unos segundos.</p>
        </div>
      )}

      <Section title="Tu plan">
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPro ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-foreground/[0.04] border border-foreground/[0.06]'}`}>
              <Crown className={`w-4 h-4 ${isPro ? 'text-amber-400' : 'text-foreground/40'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground/85">
                {isPro ? 'Novo Pro' : 'Novo Free'}
                {isPro && status.interval && <span className="text-foreground/35 font-normal"> · {status.interval === 'year' ? 'anual' : 'mensual'}</span>}
              </p>
              {isPro && status.cancelAtPeriodEnd && status.currentPeriodEnd && (
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Se cancela el {new Date(status.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
              {!isPro && (
                <p className="text-xs text-foreground/35 mt-0.5">Acciones de IA ilimitadas con Pro</p>
              )}
            </div>
          </div>

          {!isPro && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground/40">Acciones de IA este mes</span>
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
        <Section title="Facturación">
          <SafeAction
            icon={CreditCard}
            label={redirecting === 'portal' ? 'Abriendo portal...' : 'Administrar facturación'}
            description="Cambia tu método de pago, ve facturas o cancela tu suscripción."
            onClick={goToPortal}
            loading={redirecting === 'portal'}
          />
        </Section>
      ) : (
        <Section title="Actualizar a Pro">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => goToCheckout('month')}
              disabled={!!redirecting}
              className="flex flex-col items-start gap-1 p-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-primary/20 transition-all duration-300 text-left disabled:opacity-50"
            >
              <span className="text-sm font-semibold text-foreground/85">Mensual</span>
              <span className="text-lg font-bold text-primary">$9.99<span className="text-xs font-normal text-foreground/35">/mes</span></span>
            </button>
            <button
              onClick={() => goToCheckout('year')}
              disabled={!!redirecting}
              className="flex flex-col items-start gap-1 p-4 rounded-2xl border border-primary/20 bg-primary/[0.05] hover:bg-primary/[0.08] transition-all duration-300 text-left disabled:opacity-50 relative"
            >
              <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-wide text-primary/70">Ahorra 20%</span>
              <span className="text-sm font-semibold text-foreground/85">Anual</span>
              <span className="text-lg font-bold text-primary">$95.99<span className="text-xs font-normal text-foreground/35">/año</span></span>
              <span className="text-[11px] text-foreground/40">$8.00/mes · 2 meses gratis</span>
            </button>
          </div>
          <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-4 flex items-start gap-3">
            <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/45">Acciones de IA ilimitadas, sin esperar al reinicio mensual.</p>
          </div>
        </Section>
      )}
    </div>
  )
}
