'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SessionProvider, useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { Toaster } from '@/components/ui/toaster'
import { NetworkStatus } from '@/components/network-status'
import { FocusProvider } from '@/lib/focus-context'
import { SettingsProvider } from '@/lib/settings-context'
import { NotificationProvider } from '@/lib/notification-context'
import { PomodoroProvider } from '@/lib/pomodoro-context'
import { PomodoroWidget } from '@/components/pomodoro-widget'
import '@/lib/storage'
import { GlobalPlayer } from '@/components/music/global-player'
import { QuickCapture } from '@/components/quick-capture'
import { DashboardShell } from '@/components/dashboard-shell'
import { ChatbotProvider } from '@/components/ai/modern-chatbot/context'
import { useSessionTracking } from '@/hooks/use-session-tracking'
import { WelcomeCarousel } from '@/components/onboarding/welcome-screen'
import { QuickCaptureProvider } from '@/lib/quick-capture-context'
import { registerServiceWorker } from '@/lib/register-sw'
import { OfflineIndicator } from '@/components/offline-indicator'
import { useSyncQueue } from '@/hooks/use-sync-queue'
import { ScrollContainerProvider } from '@/lib/scroll-container-context'
import { CognitiveProvider } from '@/lib/cognitive-context'

// ─── Lazy-loaded widgets (not in initial bundle) ────────────────────────────
// These components are heavy and not needed at FCP/LCP time.
// next/dynamic with ssr:false ensures they are code-split into separate chunks.
const ContextHub = dynamic(
  () => import('@/components/ContextHub').then(m => ({ default: m.ContextHub })),
  { ssr: false }
)
const CommandPalette = dynamic(
  () => import('@/components/command-palette').then(m => ({ default: m.CommandPalette })),
  { ssr: false }
)
const ChatbotSidebar = dynamic(
  () => import('@/components/ai/modern-chatbot/chatbot-sidebar').then(m => ({ default: m.ChatbotSidebar })),
  { ssr: false }
)
const NotificationCenter = dynamic(
  () => import('@/components/notification-center').then(m => ({ default: m.NotificationCenter })),
  { ssr: false }
)
const SettingsModal = dynamic(
  () => import('@/components/settings/settings-modal').then(m => ({ default: m.SettingsModal })),
  { ssr: false }
)
const GeminiLiveOrb = dynamic(
  () => import('@/components/ai/GeminiLiveOrb').then(m => ({ default: m.GeminiLiveOrb })),
  { ssr: false }
)
const FloatingMusicWidget = dynamic(
  () => import('@/components/music/floating-music-widget').then(m => ({ default: m.FloatingMusicWidget })),
  { ssr: false }
)

// ─── Auth wrapper ────────────────────────────────────────────────────────────
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { twin, isLoading: isTwinLoading } = useCognitiveTwin()

  useSessionTracking()

  const isPublicPage = pathname?.startsWith('/auth/') || pathname?.startsWith('/welcome') || pathname?.startsWith('/onboarding')

  useEffect(() => {
    if (status === 'unauthenticated' && !isPublicPage) {
      router.push('/welcome')
    } else if (status === 'authenticated' && !isTwinLoading && !twin.isInitialized && pathname !== '/onboarding') {
      router.push('/onboarding')
    }
  }, [status, router, pathname, isPublicPage, twin.isInitialized, isTwinLoading])

  if (status === 'loading' || isTwinLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-white flex items-center justify-center animate-pulse">
            <div className="h-4 w-4 bg-white rounded-full" />
          </div>
          <span className="text-white/50 text-sm font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  if (isPublicPage) {
    return <>{children}</>
  }

  if (status === 'authenticated') {
    return (
      <DashboardShell>
        {children}
      </DashboardShell>
    )
  }

  return <WelcomeCarousel />
}

// ─── Authenticated floating widgets (all lazy) ──────────────────────────────
// MiniChatbot REMOVED — superseded by GeminiLiveOrb + ChatbotSidebar (OmniHub v2)
// FloatingQuickNotes REMOVED — function migrated to OmniHub State 2 pill shortcuts
function AuthenticatedWidgets() {
  const { status } = useSession()
  if (status !== 'authenticated') return null
  return (
    <>
      <CommandPalette />
      <ContextHub />
      <PomodoroWidget />
      <ChatbotSidebar />
      <NotificationCenter />
      <SettingsModal />
      <GeminiLiveOrb />
      <FloatingMusicWidget />
    </>
  )
}

// ─── Sync queue initializer ─────────────────────────────────────────────────
function SyncQueueInit() {
  useSyncQueue()
  return null
}

import { CognitiveTwinProvider, useCognitiveTwin } from '@/lib/cognitive-twin-context'

// ─── Root client layout ──────────────────────────────────────────────────────
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    registerServiceWorker()
  }, [])

  if (!mounted) return null

  return (
    <SessionProvider>
      <SettingsProvider>
        <NotificationProvider>
          <PomodoroProvider>
            <FocusProvider>
              <ChatbotProvider>
                <QuickCaptureProvider>
                  <ScrollContainerProvider>
                    <CognitiveProvider>
                      <CognitiveTwinProvider>
                        <GlobalPlayer>
                          <AuthWrapper>
                            <>
                              {children}
                              <QuickCapture />
                            </>
                          </AuthWrapper>
                        </GlobalPlayer>
                        <AuthenticatedWidgets />
                      </CognitiveTwinProvider>
                    </CognitiveProvider>
                  </ScrollContainerProvider>
                </QuickCaptureProvider>
                <OfflineIndicator />
                <SyncQueueInit />
                <NetworkStatus />
                <Toaster />
              </ChatbotProvider>
            </FocusProvider>
          </PomodoroProvider>
        </NotificationProvider>
      </SettingsProvider>
    </SessionProvider>
  )
}
