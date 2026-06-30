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

interface DashboardShellProps {
  children: React.ReactNode
}

function DashboardShellInner({ children }: DashboardShellProps) {
  const { settings } = useSettings()
  const pathname = usePathname()
  const isFullScreenPage =
    pathname?.startsWith('/music') ||
    pathname?.startsWith('/ai') ||
    pathname?.startsWith('/calendar') ||
    pathname?.startsWith('/cognitive')

  // Voice hub drawer state
  const [voiceOpen, setVoiceOpen] = useState(false)

  // Proactive cognitive orchestrator
  const { insightMessage, dismissInsight } = usePeakTaskOrchestrator()

  useEffect(() => {
    DataIntegrator.initialize()
    return () => DataIntegrator.destroy()
  }, [])

  // Close voice panel when navigating to full-screen routes
  useEffect(() => {
    if (isFullScreenPage) setVoiceOpen(false)
  }, [isFullScreenPage])

  // Listen to toggle-voice-command-hub custom event
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleToggle = () => {
        setVoiceOpen(prev => !prev)
      }
      window.addEventListener('toggle-voice-command-hub', handleToggle)
      return () => {
        window.removeEventListener('toggle-voice-command-hub', handleToggle)
      }
    }
  }, [])

  return (
    <SidebarProvider>
      <div
        className={cn(
          'flex h-screen w-full overflow-hidden',
          settings.compactMode && 'compact-mode',
          !settings.showAnimations && 'no-animations'
        )}
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

          {/* Fixed Mobile Navigation */}
          {pathname !== '/ai' && (
            <div className="md:hidden">
              <MobileNav />
            </div>
          )}

          {/* ── Floating Voice Button ──────────────────────────────────── */}
          {!isFullScreenPage && (
            <div className="fixed bottom-6 right-6 z-[150] flex flex-col items-end gap-3">
              {/* Proactive insight toast */}
              <AnimatePresence>
                {insightMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="
                      max-w-xs w-full rounded-2xl border border-white/10 px-4 py-3
                      backdrop-blur-2xl bg-background/90
                      shadow-[0_8px_40px_rgba(0,0,0,0.5)]
                      flex items-start gap-3
                    "
                  >
                    <p className="flex-1 text-xs text-foreground/75 leading-relaxed">
                      {insightMessage}
                    </p>
                    <button
                      onClick={dismissInsight}
                      className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors text-foreground/30 hover:text-foreground/60"
                      aria-label="Dismiss insight"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Voice drawer panel */}
              <AnimatePresence>
                {voiceOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="
                      fixed bottom-24 right-6 z-[160] w-80 rounded-3xl border border-white/10 p-5
                      backdrop-blur-2xl bg-background/95
                      shadow-[0_20px_80px_rgba(0,0,0,0.6)]
                    "
                  >
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Hub de Comandos</span>
                      <button
                        onClick={() => setVoiceOpen(false)}
                        className="p-1 rounded-lg hover:bg-white/5 text-foreground/40 hover:text-foreground transition-colors"
                        title="Cerrar panel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <VoiceCommandHub className="w-full" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </SidebarProvider>
  )
}

export function DashboardShell({ children }: DashboardShellProps) {
  return <DashboardShellInner>{children}</DashboardShellInner>
}
