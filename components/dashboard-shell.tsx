'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ResponsiveAppSidebar } from '@/components/responsive-app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useSettings } from '@/lib/settings-context'

import { MobileNav } from '@/components/mobile-nav'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PageWrapper } from '@/components/PageWrapper'
const VoiceCommandHub = dynamic(
  () => import("@/components/ai/VoiceCommandHub").then((module) => ({ default: module.VoiceCommandHub })),
  { ssr: false, loading: () => null },
)
import { useDevicePresence } from '@/hooks/use-device-presence'
import { X } from 'lucide-react'
import { useMobileOverlay } from '@/components/mobile-overlay-provider'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface DashboardShellProps {
  children: React.ReactNode
}

function DashboardShellInner({ children }: DashboardShellProps) {
  const { settings } = useSettings()
  const { data: session } = useSession()
  const pathname = usePathname()
  const { activeOverlay, closeOverlay, openOverlay } = useMobileOverlay()
  const isFullScreenPage =
    pathname?.startsWith('/music') ||
    pathname?.startsWith('/ai') ||
    pathname?.startsWith('/chat') ||
    pathname?.startsWith('/calendar') ||
    pathname?.startsWith('/cognitive') ||
    pathname?.startsWith('/social')

  // Voice hub drawer state
  const [desktopVoiceOpen, setDesktopVoiceOpen] = useState(false)
  const mobileVoiceOpen = activeOverlay === 'voice'

  useDevicePresence()

  useEffect(() => {
    let active = true
    let idleHandle: number | null = null
    let timer: number | null = null
    let integrator: { initialize: (userId?: string) => void; destroy: () => void } | null = null

    const initialize = () => {
      if (!active) return
      void import("@/lib/data-integrator").then(({ DataIntegrator }) => {
        if (!active) return
        integrator = DataIntegrator
        DataIntegrator.initialize(session?.user?.id)
      })
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(initialize, { timeout: 2200 })
    } else {
      timer = window.setTimeout(initialize, 1200)
    }

    return () => {
      active = false
      if (idleHandle !== null) window.cancelIdleCallback(idleHandle)
      if (timer !== null) window.clearTimeout(timer)
      integrator?.destroy()
    }
  }, [session?.user?.id])

  // Close voice panel when navigating to full-screen routes
  useEffect(() => {
    if (!isFullScreenPage) return
    setDesktopVoiceOpen(false)
    if (mobileVoiceOpen) closeOverlay()
  }, [closeOverlay, isFullScreenPage, mobileVoiceOpen])

  // Listen to toggle-voice-command-hub custom event
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleToggle = () => {
        if (window.matchMedia('(max-width: 767px)').matches) {
          if (activeOverlay === 'voice') closeOverlay()
          else openOverlay('voice')
          return
        }
        setDesktopVoiceOpen(prev => !prev)
      }
      window.addEventListener('toggle-voice-command-hub', handleToggle)
      return () => {
        window.removeEventListener('toggle-voice-command-hub', handleToggle)
      }
    }
  }, [activeOverlay, closeOverlay, openOverlay])

  const handleCloseVoice = () => {
    if (mobileVoiceOpen) closeOverlay()
    else setDesktopVoiceOpen(false)
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div
        data-app-viewport
        className={cn(
          // h-dvh, not h-screen: on mobile, 100vh is sized against the
          // largest possible viewport (address bar collapsed), not what's
          // actually visible — right after page load, with the address bar
          // still expanded, this pushed bottom content (like the chat
          // composer) below the real visible fold. 100dvh tracks the actual
          // visible viewport as the browser chrome collapses/expands.
          'flex h-dvh w-full overflow-hidden',
          settings.compactMode && 'compact-mode',
          !settings.showAnimations && 'no-animations'
        )}
        // Keep the root in the normal compositor path. It is not animated
        // continuously; a permanent will-change hint would reserve a GPU
        // layer for the entire app and make backdrop surfaces more expensive.
        style={{ transformOrigin: 'top center' }}
      >
        <div data-app-wallpaper aria-hidden />

        {/* Persistent sidebar */}
        <ResponsiveAppSidebar />

        <main
          className="flex-1 relative flex flex-col min-h-0 overflow-hidden transition-[background-color,opacity] duration-300 ease-out"
        >
          <div className="w-full flex-1 flex flex-col min-h-0 relative overflow-hidden">
            <PageWrapper isFullScreen={isFullScreenPage}>
              {isFullScreenPage ? (
                children
              ) : (
                <div
                  className={cn(
                    settings.compactMode && 'dashboard-shell'
                  )}
                >
                  {children}
                </div>
              )}
            </PageWrapper>
          </div>

          {/* Fixed Mobile Navigation — visible on all pages including /ai */}
          <div className="md:hidden">
            <MobileNav />
          </div>

          {/* ── Floating Voice Button ──────────────────────────────────── */}
          {!isFullScreenPage && (
            <Dialog open={desktopVoiceOpen || mobileVoiceOpen} onOpenChange={(open) => !open && handleCloseVoice()}>
              <DialogContent
                motionPreset="anchored"
                mobilePresentation="sheet"
                showCloseButton={false}
                className="w-[calc(100vw-2rem)] max-w-80 rounded-[28px] border-foreground/10 bg-background/95 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-[28px] md:fixed md:bottom-24 md:right-6 md:w-80"
              >
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-foreground/5">
                    <DialogTitle className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Hub de Comandos</DialogTitle>
                    <button
                      onClick={handleCloseVoice}
                      className="min-h-[44px] min-w-[44px] p-1 rounded-lg hover:bg-foreground/5 text-foreground/40 hover:text-foreground transition-colors"
                      title="Cerrar panel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <VoiceCommandHub className="w-full" />
              </DialogContent>
            </Dialog>
          )}

          {/* Fullscreen chat routes hide the visible voice panel, but the
              composer still exposes the voice action. Keep the same recorder
              mounted in the authenticated shell so that action never falls
              back to the retired GeminiLiveOrb event bridge. */}
          {isFullScreenPage && (pathname?.startsWith('/ai') || pathname?.startsWith('/chat')) && (
            <VoiceCommandHub headless />
          )}
        </main>
      </div>
    </SidebarProvider>
  )
}

export function DashboardShell({ children }: DashboardShellProps) {
  return <DashboardShellInner>{children}</DashboardShellInner>
}
