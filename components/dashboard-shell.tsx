'use client'

import React, { useRef, useState, useEffect } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useSettings } from '@/lib/settings-context'
import { DataIntegrator } from '@/lib/data-integrator'
import { MobileNav } from '@/components/mobile-nav'
import { useScrollContainer } from '@/lib/scroll-container-context'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PageWrapper } from '@/components/PageWrapper'
import { VoiceCommandHub } from '@/components/ai/VoiceCommandHub'
import { usePeakTaskOrchestrator } from '@/hooks/use-peak-task-orchestrator'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMobileOverlay } from '@/components/mobile-overlay-provider'

interface DashboardShellProps {
  children: React.ReactNode
}

function DashboardShellInner({ children }: DashboardShellProps) {
  const { settings } = useSettings()
  const pathname = usePathname()
  const { activeOverlay, closeOverlay, openOverlay } = useMobileOverlay()
  const isFullScreenPage =
    pathname?.startsWith('/music') ||
    pathname?.startsWith('/ai') ||
    pathname?.startsWith('/calendar') ||
    pathname?.startsWith('/cognitive') ||
    pathname?.startsWith('/social')

  // Voice hub drawer state
  const [desktopVoiceOpen, setDesktopVoiceOpen] = useState(false)
  const mobileVoiceOpen = activeOverlay === 'voice'

  // Proactive cognitive orchestrator — single unified insight surface (see
  // hooks/use-peak-task-orchestrator.ts for why the old separate DB-polled
  // toast was folded into this same `insight` slot).
  const { insight, dismissInsight } = usePeakTaskOrchestrator()

  useEffect(() => {
    DataIntegrator.initialize()
    return () => DataIntegrator.destroy()
  }, [])

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
        style={{ transformOrigin: 'top center', willChange: 'transform, border-radius' }}
      >
        {/* Persistent sidebar */}
        <div className="hidden md:flex h-full">
          <AppSidebar />
        </div>

        <main
          className="flex-1 relative flex flex-col min-h-0 overflow-hidden transition-all duration-1000"
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
          {!isFullScreenPage && mobileVoiceOpen && (
            <div
              data-mobile-overlay="voice"
              aria-hidden="true"
              className="fixed inset-0 z-[5000] bg-black/60 md:hidden"
              onClick={handleCloseVoice}
            />
          )}
          {!isFullScreenPage && (
            <AnimatePresence>
              {(desktopVoiceOpen || mobileVoiceOpen) && (
                <motion.div
                  data-mobile-overlay="voice"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Hub de Comandos"
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="
                    fixed right-4 z-[5001] w-[calc(100vw-2rem)] max-w-80 rounded-[28px] border border-foreground/10 p-5
                    md:bottom-24 md:right-6 md:z-[160] md:w-80
                    backdrop-blur-[28px] bg-background/95
                    shadow-[0_20px_80px_rgba(0,0,0,0.6)]
                  "
                  style={mobileVoiceOpen ? { bottom: 'var(--mobile-navigation-bottom)' } : undefined}
                >
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-foreground/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Hub de Comandos</span>
                    <button
                      onClick={handleCloseVoice}
                      className="min-h-[44px] min-w-[44px] p-1 rounded-lg hover:bg-foreground/5 text-foreground/40 hover:text-foreground transition-colors"
                      title="Cerrar panel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <VoiceCommandHub className="w-full" />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </SidebarProvider>
  )
}

export function DashboardShell({ children }: DashboardShellProps) {
  return <DashboardShellInner>{children}</DashboardShellInner>
}
