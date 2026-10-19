'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SessionProvider, useSession } from 'next-auth/react'
import { SettingsProvider } from '@/lib/settings-context'
import { CognitiveProvider } from '@/lib/cognitive-context'
import { CognitiveTwinProvider, useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { useCognitiveTheme } from '@/hooks/use-cognitive-theme'
import { CognitiveRouteShell } from '@/components/cognitive/cognitive-route-shell'
import { NovoSpriteLoader } from '@/components/ui/novo-sprite-loader'
import { AmbientContextHeartbeat } from '@/components/ambient-context-heartbeat'
import { AppMotionSettings } from '@/components/app-motion-settings'
import { LiquidGlassWebComponentLoader } from '@/components/liquid-glass/web-component-loader'

function CognitiveThemeSyncer() {
  useCognitiveTheme()
  return null
}

function CognitiveAuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { twin, isLoading: isTwinLoading } = useCognitiveTwin()

  useEffect(() => {
    if (status === 'unauthenticated' && !pathname?.startsWith('/auth/')) {
      const callbackPath = pathname && pathname.startsWith('/') && !pathname.startsWith('//')
        ? pathname
        : '/cognitive'
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`)
      return
    }
  }, [pathname, router, status])

  // Use the last confirmed snapshot for an immediate return path; only a new
  // account without an initialized Twin needs to wait for the server decision.
  if (status === 'loading') {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <NovoSpriteLoader size="md" label="Preparando Novo" className="text-foreground" />
      </div>
    )
  }

  if (status !== 'authenticated') return null

  return <CognitiveRouteShell>
    {isTwinLoading && <p role="status" className="mb-4 text-xs text-foreground/65">Sincronizando tu Gemelo… Puedes seguir navegando.</p>}
    {!isTwinLoading && !twin.isInitialized && <p className="mb-4 text-sm text-foreground/75">Tu Gemelo todavía no está disponible. <a href="/onboarding" className="underline underline-offset-4">Revisar su configuración</a></p>}
    {children}
  </CognitiveRouteShell>
}

export default function CognitiveClientLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AmbientContextHeartbeat />
      <SettingsProvider>
        <AppMotionSettings>
          <LiquidGlassWebComponentLoader />
          <CognitiveProvider>
            <CognitiveTwinProvider>
              <CognitiveThemeSyncer />
              <CognitiveAuthGate>{children}</CognitiveAuthGate>
            </CognitiveTwinProvider>
          </CognitiveProvider>
        </AppMotionSettings>
      </SettingsProvider>
    </SessionProvider>
  )
}
