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
import '@/lib/storage'
import { useSessionTracking } from '@/hooks/use-session-tracking'
import { QuickCaptureProvider, useQuickCapture } from '@/lib/quick-capture-context'
import { registerServiceWorker } from '@/lib/register-sw'
import { OfflineIndicator } from '@/components/offline-indicator'
import { useSyncQueue } from '@/hooks/use-sync-queue'
import { ScrollContainerProvider } from '@/lib/scroll-container-context'
import { CognitiveTwinProvider, useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { CognitiveProvider } from '@/lib/cognitive-context'
import { useCognitiveTheme } from '@/hooks/use-cognitive-theme'
import { NovoSpriteLoader } from '@/components/ui/novo-sprite-loader'
import { redirectWhenSessionMissing } from '@/lib/auth-navigation'
import { MobileOverlayProvider } from '@/components/mobile-overlay-provider'
import { CognitiveRouteShell } from '@/components/cognitive/cognitive-route-shell'
import { AmbientContextHeartbeat } from '@/components/ambient-context-heartbeat'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import { useSettings } from '@/lib/settings-context'
import { LiquidGlassWebComponentLoader } from '@/components/liquid-glass/web-component-loader'
import { usePlayerStore } from '@/lib/player-store'

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

/**
 * Keep Framer Motion in the same contract as Novo's own animation setting.
 *
 * CSS/Lenis already read `data-animations`, but a MotionConfig outside the
 * SettingsProvider used to keep Framer transitions alive after a user turned
 * animations off. Keeping this boundary inside AppProviders makes the
 * preference atomic across route transitions, overlays, buttons and widgets.
 */
function AppMotionSettings({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const mode = useNovoMotionPolicy(settings.showAnimations)

  return (
    <MotionConfig reducedMotion={mode === 'full' ? 'never' : 'always'}>
      {children}
    </MotionConfig>
  )
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
  const isChatRoute = pathname?.startsWith('/ai') || pathname?.startsWith('/chat')

  // The chatbot is a route surface, not an app-wide dependency. Keeping its
  // provider mounted on every authenticated screen used to load conversations,
  // billing state, model preferences and persistence effects while the user was
  // only looking at Calendar, Routines or Settings. Scope the provider to the
  // two chat entry points so other routes get a quieter main thread and fewer
  // competing requests without changing the chat experience itself.
  if (!isChatRoute) return <>{children}</>
  return <ChatbotProvider>{children}</ChatbotProvider>
}

function RouteAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/cognitive')) return <CognitiveRouteShell>{children}</CognitiveRouteShell>
  return <DashboardShell>{children}</DashboardShell>
}

function RoutePlayerBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [playerLoadIntent, setPlayerLoadIntent] = useState(false)
  const hasCurrentTrack = usePlayerStore((state) => Boolean(state.currentTrack))

  useEffect(() => {
    if (pathname?.startsWith('/cognitive')) return
    const rememberLoadIntent = () => setPlayerLoadIntent(true)
    window.addEventListener('youtube:load-api', rememberLoadIntent)
    return () => window.removeEventListener('youtube:load-api', rememberLoadIntent)
  }, [pathname])

  if (pathname?.startsWith('/cognitive')) return <>{children}</>
  return <>{children}{(playerLoadIntent || hasCurrentTrack) && <GlobalPlayer initialLoadRequested={playerLoadIntent} />}</>
}

function RouteQuickCapture() {
  const pathname = usePathname()
  const { isOpen, onOpen, onClose } = useQuickCapture()

  useEffect(() => {
    if (pathname?.startsWith('/cognitive')) return

    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || !event.shiftKey || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      if (isOpen) onClose()
      else onOpen()
    }

    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [isOpen, onClose, onOpen, pathname])

  // Keep the global shortcut responsive, but defer the full notes dialog and
  // its motion/form code until a real user action opens it.
  if (pathname?.startsWith('/cognitive') || !isOpen) return null
  return <QuickCapture />
}
// ─── Auth wrapper ────────────────────────────────────────────────────────────
const StableAuthenticatedContent = React.memo(function StableAuthenticatedContent({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
})

/**
 * Keep the frequently updated Twin context subscription out of AuthWrapper.
 * A Twin refresh should update this small guard, not reconcile the full route
 * shell and all of its dashboard widgets.
 */
function CognitiveTwinGate({
  children,
  pathname,
}: {
  children: React.ReactNode
  pathname: string | null
}) {
  const { twin, isLoading: isTwinLoading } = useCognitiveTwin()
  const router = useRouter()

  useEffect(() => {
    if (!isTwinLoading && !twin.isInitialized && pathname !== '/onboarding') {
      router.push('/onboarding')
    }
  }, [isTwinLoading, pathname, router, twin.isInitialized])

  // Returning users may keep using the last server-confirmed snapshot while
  // the fresh sync runs. New users wait for the authoritative onboarding call.
  if (isTwinLoading && !twin.isInitialized) {
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

  return <StableAuthenticatedContent>{children}</StableAuthenticatedContent>
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useSessionTracking()

  // Onboarding contains the user's private calibration flow. It is a
  // post-auth surface, not a public marketing page: keeping it out of this
  // allow-list prevents anonymous visitors from seeing the form while the
  // session request is still resolving.
  const isPublicPage = pathname?.startsWith('/auth/') || pathname?.startsWith('/welcome') || pathname?.startsWith('/landing') || pathname?.startsWith('/app') || pathname?.startsWith('/privacy') || pathname?.startsWith('/terms') || pathname?.startsWith('/refunds')
  const isAuthFormPage = pathname?.startsWith('/auth/')
  // A protected route should never fall back to the acquisition carousel while
  // the session redirect settles. That was a subtle UX leak on client-side
  // navigations: an expired session briefly showed the welcome/marketing
  // surface inside the app before the sign-in redirect completed. Keep the
  // hand-off in the product language with the same lightweight loader used by
  // the session bootstrap instead.
  const isProtectedClientPage = Boolean(pathname && pathname !== '/' && !isPublicPage)

  useEffect(() => {
    if (status === 'unauthenticated' && pathname === '/') {
      // The root server page is the public acquisition entry point. If an
      // edge/runtime session read returns an anonymous client state before the
      // server redirect settles, land on the public page instead of leaving
      // the welcome carousel mounted at `/`.
      const timeout = setTimeout(() => router.replace('/landing'), 1200)
      return () => clearTimeout(timeout)
    }

    if (status === 'unauthenticated' && !isPublicPage && pathname !== '/') {
      // A cold mount right after credentials or an external redirect can
      // report 'unauthenticated' before the new cookie reaches this provider.
      // the session cookie's fetch actually resolves — bail out if a
      // fast re-render flips us back to 'authenticated' or 'loading'
      // before this fires, instead of bouncing to the login screen on a false
      // read. The root page has its own server redirect to the public landing;
      // letting this client timer compete with that redirect could leave an
      // unauthenticated visitor at `/auth/signin?callbackUrl=/` instead.
      const timeout = setTimeout(() => {
        const callbackPath = pathname && pathname.startsWith('/') && !pathname.startsWith('//')
          ? pathname
          : '/chat'
        const appMissingPath = `/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`
        void redirectWhenSessionMissing(
          getSession,
          (path) => router.replace(path),
          appMissingPath,
        )
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
    }
  }, [status, router, pathname, isPublicPage, isAuthFormPage])

  // Public review and acquisition pages must render their server-provided
  // content immediately. They do not need a session or Cognitive Twin to
  // become useful, and blocking them behind the auth loading state leaves
  // crawlers/JS-disabled reviewers with only a blank loading shell.
  if (isPublicPage) {
    // AppProviders already wraps AuthWrapper. Returning another Session,
    // Settings, Cognitive and Twin provider tree here duplicated effects and
    // subscriptions on public/auth pages without changing their UI. Keep the
    // server-provided page direct and reuse the single root provider graph.
    return <>{children}</>
  }

  if (status === 'loading') {
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
      <CognitiveTwinGate pathname={pathname}>
        <RouteChatbotBoundary>
          <RouteAppShell>
            {/* Full-screen routes such as /cognitive need a measurable parent.
                Without this, an absolutely-positioned page can leave the route
                transition at zero height and only the header remains visible. */}
            {children}
          </RouteAppShell>
        </RouteChatbotBoundary>
      </CognitiveTwinGate>
    )
  }

  if (isProtectedClientPage) {
    return (
      <div
        className="h-screen w-full flex items-center justify-center bg-background text-foreground"
        role="status"
        aria-live="polite"
        aria-label="Preparing sign in"
      >
        <NovoSpriteLoader
          size="md"
          label="Preparando Novo"
          className="text-foreground"
        />
      </div>
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
function CommandPaletteOnDemand() {
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (requested) return
    const openFromShortcut = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setRequested(true)
      }
    }
    const openFromEvent = () => setRequested(true)
    document.addEventListener('keydown', openFromShortcut)
    window.addEventListener('open-command-palette', openFromEvent)
    return () => {
      document.removeEventListener('keydown', openFromShortcut)
      window.removeEventListener('open-command-palette', openFromEvent)
    }
  }, [requested])

  return requested ? <CommandPalette initialOpen /> : null
}

function AuthenticatedWidgets() {
  const { status } = useSession()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [secondaryReady, setSecondaryReady] = useState(false)

  useEffect(() => {
    let active = true
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    const clearSchedule = () => {
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle)
        idleHandle = null
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
    }

    const activate = () => {
      if (!active) return
      clearSchedule()
      setReady(true)
      window.removeEventListener('pointerdown', activate, true)
      window.removeEventListener('keydown', activate, true)
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(activate, { timeout: 520 })
    } else {
      timeoutHandle = window.setTimeout(activate, 320)
    }

    // Global surfaces are available before the first meaningful interaction,
    // but they do not compete with the route's first paint or hydration.
    window.addEventListener('pointerdown', activate, true)
    window.addEventListener('keydown', activate, true)

    return () => {
      active = false
      clearSchedule()
      window.removeEventListener('pointerdown', activate, true)
      window.removeEventListener('keydown', activate, true)
    }
  }, [])

  useEffect(() => {
    if (!ready) {
      setSecondaryReady(false)
      return
    }

    let active = true
    let timer: number | null = null
    const reveal = () => {
      if (active) setSecondaryReady(true)
    }

    // The Hub, command surface and timer remain available at the first idle
    // boundary. Music and notifications are secondary and can wait one quiet
    // turn so their dynamic chunks do not contend with the route becoming
    // interactive.
    if (typeof window.requestIdleCallback === 'function') {
      const idleHandle = window.requestIdleCallback(reveal, { timeout: 1400 })
      return () => {
        active = false
        window.cancelIdleCallback(idleHandle)
      }
    }

    timer = window.setTimeout(reveal, 900)
    return () => {
      active = false
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [ready])

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
      {!isCognitiveRoute && <CommandPaletteOnDemand />}
      {ready && !isCognitiveRoute && <ContextHub />}
      {ready && !isCognitiveRoute && <PomodoroWidget />}
      {ready && !isCognitiveRoute && secondaryReady && !isChatRoute && <NotificationCenter />}
      {ready && <SettingsModal />}
      {ready && !isCognitiveRoute && secondaryReady && <FloatingMusicWidget />}
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
    // Service-worker installation is useful for later visits but does not
    // belong on the critical path of the first authenticated surface.
    const serviceWorkerTimer = window.setTimeout(registerServiceWorker, 1800)

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
      window.clearTimeout(serviceWorkerTimer)
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
    <AppProviders>
      <AppMotionSettings>
        <CognitiveThemeSyncer />
        <LiquidGlassWebComponentLoader />
        <AmbientContextHeartbeat />
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
      </AppMotionSettings>
    </AppProviders>
  )
}
