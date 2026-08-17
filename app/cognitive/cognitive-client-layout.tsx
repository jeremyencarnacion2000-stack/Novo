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
    if (status === 'unauthenticated') router.replace('/landing')
    if (status === 'authenticated' && !isTwinLoading && !twin.isInitialized && pathname !== '/onboarding') {
      router.replace('/onboarding')
    }
  }, [isTwinLoading, pathname, router, status, twin.isInitialized])

  if (status === 'loading' || isTwinLoading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <NovoSpriteLoader size="md" label="Preparando Novo" className="text-foreground" />
      </div>
    )
  }

  if (status !== 'authenticated' || !twin.isInitialized) return null

  return <CognitiveRouteShell>{children}</CognitiveRouteShell>
}

export default function CognitiveClientLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SettingsProvider>
        <CognitiveProvider>
          <CognitiveTwinProvider>
            <CognitiveThemeSyncer />
            <CognitiveAuthGate>{children}</CognitiveAuthGate>
          </CognitiveTwinProvider>
        </CognitiveProvider>
      </SettingsProvider>
    </SessionProvider>
  )
}
