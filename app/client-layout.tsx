'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSession, SessionProvider, useSession } from 'next-auth/react'
import { MotionConfig } from 'framer-motion'
import dynamic from 'next/dynamic'
import { NetworkStatus } from '@/components/network-status'
import { FocusProvider } from '@/lib/focus-context'
import { SettingsProvider } from '@/lib/settings-context'
import { NotificationProvider } from '@/lib/notification-context'
import { PomodoroProvider } from '@/lib/pomodoro-context'
import '@/lib/storage'
import { useSessionTracking } from '@/hooks/use-session-tracking'
import { QuickCaptureProvider } from '@/lib/quick-capture-context'
import { registerServiceWorker } from '@/lib/register-sw'
import { OfflineIndicator } from '@/components/offline-indicator'
import { useSyncQueue } from '@/hooks/use-sync-queue'
import { ScrollContainerProvider } from '@/lib/scroll-container-context'
import { CognitiveTwinProvider, useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { CognitiveProvider } from '@/lib/cognitive-context'
import { useCognitiveTheme } from '@/hooks/use-cognitive-theme'
import { PageTransition } from '@/components/ui/page-transition'
import { NovoSpriteLoader } from '@/components/ui/novo-sprite-loader'
import { redirectWhenSessionMissing } from '@/lib/auth-navigation'
import { MobileOverlayProvider } from '@/components/mobile-overlay-provider'
import { CognitiveRouteShell } from '@/components/cognitive/cognitive-route-shell'

function composeProviders(...providers: React.FC<{ children: React.ReactNode }>[]) {
  return function ComposedProviders({ children }: { children: React.ReactNode }) {
    return providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children as React.ReactElement,
    )
  }
}

const AppProviders = composeProviders(
  SessionProvider as any,
  SettingsProvider,
  NotificationProvider,
  PomodoroProvider,
  FocusProvider,
  QuickCaptureProvider,
  ScrollContainerProvider,
  CognitiveProvider,
)

/**
 * CognitiveThemeSyncer — mounts once inside CognitiveProvider.
 * Bridges live BioState → CSS custom properties on <html>.
 * Renders nothing — pure side-effect component.
 */
function CognitiveThemeSyncer() {
  useCognitiveTheme()
  return null
}


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
const NotificationCenter = dynamic(
  () => import('@/components/notification-center').then(m => ({ default: m.NotificationCenter })),
  { ssr: false }
)
const SettingsModal = dynamic(
  () => import('@/components/settings/settings-modal').then(m => ({ default: m.SettingsModal })),
  { ssr: false }
)
const FloatingMusicWidget = dynamic(
  () => import('@/components/music/floating-music-widget').then(m => ({ default: m.FloatingMusicWidget })),
  { ssr: false }
)
const DashboardShell = dynamic(
  () => import('@/components/dashboard-shell').then(m => ({ default: m.DashboardShell })),
  { ssr: false }
)
const GlobalPlayer = dynamic(
  () => import('@/components/music/global-player').then(m => ({ default: m.GlobalPlayer })),
  { ssr: false }
)
const QuickCapture = dynamic(
  () => import('@/components/quick-capture').then(m => ({ default: m.QuickCapture })),
  { ssr: false }
)
const PomodoroWidget = dynamic(
  () => import('@/components/pomodoro-widget').then(m => ({ default: m.PomodoroWidget })),
  { ssr: false }
)
const WelcomeCarousel = dynamic(
  () => import('@/components/onboarding/welcome-screen').then(m => ({ default: m.WelcomeCarousel })),
  { ssr: false }
)
const ChatbotProvider = dynamic(
  () => import('@/components/ai/modern-chatbot/context').then(m => ({ default: m.ChatbotProvider })),
  { ssr: false }
)

function RouteChatbotBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/cognitive')) return <>{children}</>
  return <ChatbotProvider>{children}</ChatbotProvider>
}

function RouteAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/cognitive')) return <CognitiveRouteShell>{children}</CognitiveRouteShell>
  return <DashboardShell>{children}</DashboardShell>
}

function RoutePlayerBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/cognitive')) return <>{children}</>
  return <GlobalPlayer>{children}</GlobalPlayer>
}

function RouteQuickCapture() {
  const pathname = usePathname()
  if (pathname?.startsWith('/cognitive')) return null
  return <QuickCapture />
}
// ─── Auth wrapper ────────────────────────────────────────────────────────────
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { twin, isLoading: isTwinLoading } = useCognitiveTwin()

  useSessionTracking()

  const isPublicPage = pathname?.startsWith('/auth/') || pathname?.startsWith('/welcome') || pathname?.startsWith('/onboarding') || pathname?.startsWith('/landing') || pathname?.startsWith('/privacy') || pathname?.startsWith('/terms') || pathname?.startsWith('/refunds')
  const isAuthFormPage = pathname?.startsWith('/auth/')

  useEffect(() => {
    if (status === 'unauthenticated' && !isPublicPage) {
      // A cold mount right after credentials or an external redirect can
      // report 'unauthenticated' before the new cookie reaches this provider.
      // the session cookie's fetch actually resolves — bail out if a
      // fast re-render flips us back to 'authenticated' or 'loading'
      // before this fires, instead of bouncing to /landing on a false read.
      const timeout = setTimeout(() => {
        void redirectWhenSessionMissing(getSession, (path) => router.replace(path))
      }, 800)
      return () => clearTimeout(timeout)
    } else if (status === 'authenticated' && isAuthFormPage) {
      // Already signed in but stuck on a login/signup route (stale bookmark,
      // back-button, or the SlideToSignIn push('/') racing this render) —
      // bounce out instead of leaving the fixed-overlay login stuck on screen.
      const rawCallback = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('callbackUrl')
        : null
      const callback = rawCallback && rawCallback.startsWith('/') && !rawCallback.startsWith('//')
        ? rawCallback
        : '/'
      router.push(callback)
    } else if (status === 'authenticated' && !isTwinLoading && !twin.isInitialized && pathname !== '/onboarding') {
      router.push('/onboarding')
    }
  }, [status, router, pathname, isPublicPage, isAuthFormPage, twin.isInitialized, isTwinLoading])

  // Public review and acquisition pages must render their server-provided
  // content immediately. They do not need a session or Cognitive Twin to
  // become useful, and blocking them behind the auth loading state leaves
  // crawlers/JS-disabled reviewers with only a blank loading shell.
  if (isPublicPage) {
    return (
      <SessionProvider>
        <SettingsProvider>
          <CognitiveProvider>
            <CognitiveTwinProvider>
              {children}
            </CognitiveTwinProvider>
            </CognitiveProvider>
        </SettingsProvider>
      </SessionProvider>
    )
  }

  if (status === 'loading' || isTwinLoading) {
    // Renders before SettingsProvider has resolved the user's theme/accent
    // (both need a session first), so this can't rely on --background or
    // text-primary's dynamic value - #050505 matches the app's actual dark
    // base (see .dark's --background in globals.css) as a safe literal, not
    // a generic bg-black. /icon.svg is the same mark the sidebar uses, not
    // a one-off shape invented just for this screen.
    return (
      <div className="h-screen w-full flex items-center justify-center" style={{ background: '#050505' }}>
        <NovoSpriteLoader
          size="md"
          label="Preparando Novo"
          className="text-white"
        />
      </div>
    )
  }

  if (status === 'authenticated') {
    return (
      <RouteChatbotBoundary>
        <RouteAppShell>
          {/* Full-screen routes such as /cognitive need a measurable parent.
              Without this, an absolutely-positioned page can leave the route
              transition at zero height and only the header remains visible. */}
          <PageTransition className="h-full min-h-0">
            {children}
          </PageTransition>
        </RouteAppShell>
      </RouteChatbotBoundary>
    )
  }

  return <WelcomeCarousel />
}

// ─── Authenticated floating widgets (all lazy) ──────────────────────────────
// MiniChatbot REMOVED — voice commands now live in ContextHub
// FloatingQuickNotes REMOVED — function migrated to OmniHub State 2 pill shortcuts
// ChatbotSidebar (OmniHub v2 right-docked panel) REMOVED — it and the /ai page's
// history-drawer toggle shared the same context field (sidebarCollapsed), so
// opening the drawer on /ai also popped this second, separate chat panel open.
// The chat experience is now a single surface: /ai (desktop) and MobileChatSheet
// (mobile), both rendering the same ModernChatbot component.
function AuthenticatedWidgets() {
  const { status } = useSession()
  const pathname = usePathname()
  if (status !== 'authenticated') return null
  const isCognitiveRoute = pathname?.startsWith('/cognitive')
  // The Cognitive Center owns its own attention/recommendation surface.
  // Mounting the global notification/chat/music motion stack here caused a
  // transition promise to be interrupted during hydration, preventing the
  // Center's data effects from starting. Keep the flagship route focused and
  // let the surrounding app retain the shared widgets everywhere else.
  const isChatRoute = pathname?.startsWith('/ai') || pathname?.startsWith('/chat')
  const isOnboardingRoute = pathname?.startsWith('/onboarding')
  if (isOnboardingRoute) return null
  return (
    <>
      {!isCognitiveRoute && <CommandPalette />}
      {!isCognitiveRoute && <ContextHub />}
      {!isCognitiveRoute && <PomodoroWidget />}
      {!isCognitiveRoute && !isChatRoute && <NotificationCenter />}
      <SettingsModal />
      {!isCognitiveRoute && <FloatingMusicWidget />}
    </>
  )
}

// ─── Sync queue initializer ─────────────────────────────────────────────────
function SyncQueueInit() {
  useSyncQueue()
  return null
}


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

    // Intercept ChunkLoadErrors (Next.js/Webpack compilation desync after new deploys)
    const handleChunkLoadError = (e: ErrorEvent) => {
      const errorMsg = e.message || ''
      if (
        errorMsg.includes('ChunkLoadError') ||
        errorMsg.includes('Loading chunk') ||
        errorMsg.includes('Failed to fetch dynamically imported module')
      ) {
        console.warn('[System] ChunkLoadError detected. Performing hard reload to update client chunks.', e)
        window.location.reload()
      }
    }

    const handlePromiseRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason
      if (reason) {
        const name = reason.name || ''
        const msg = reason.message || ''
        if (
          name === 'ChunkLoadError' ||
          msg.includes('ChunkLoadError') ||
          msg.includes('Loading chunk') ||
          msg.includes('Failed to fetch dynamically imported module')
        ) {
          console.warn('[System] Unhandled ChunkLoadError in Promise. Performing hard reload...', reason)
          window.location.reload()
        }
      }
    }

    window.addEventListener('error', handleChunkLoadError)
    window.addEventListener('unhandledrejection', handlePromiseRejection)

    return () => {
      window.removeEventListener('error', handleChunkLoadError)
      window.removeEventListener('unhandledrejection', handlePromiseRejection)
    }
  }, [])

  if (!mounted) {
    // The public review route bypasses this component in app/layout.tsx, so
    // authenticated routes can retain their stable provider-free hydration
    // placeholder without exposing private UI before auth resolves.
    return <div className="h-screen w-full bg-background" aria-hidden />
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppProviders>
        <CognitiveThemeSyncer />
        <CognitiveTwinProvider>
          <MobileOverlayProvider>
            <RoutePlayerBoundary>
              <AuthWrapper>
                <>
                  {children}
                  <RouteQuickCapture />
                </>
              </AuthWrapper>
            </RoutePlayerBoundary>
            <AuthenticatedWidgets />
          </MobileOverlayProvider>
        </CognitiveTwinProvider>
        <OfflineIndicator />
        <SyncQueueInit />
        <NetworkStatus />
        {/* No standalone Toaster mount — all sileo.* calls route through
            lib/sileo-bell.ts into the notification bell's physical morph
            (see components/notification-center.tsx) */}
      </AppProviders>
    </MotionConfig>
  )
}
