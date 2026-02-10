'use client'

import React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useSettings } from '@/lib/settings-context'
import { QuickCapture } from '@/components/quick-notes/quick-capture'
import { DataIntegrator } from '@/lib/data-integrator'
import { useEffect } from 'react'
import { MobileNav } from '@/components/mobile-nav'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { settings } = useSettings()
  const pathname = usePathname()
  const isFullScreenPage = pathname?.startsWith('/music') || pathname?.startsWith('/ai') || pathname?.startsWith('/calendar')

  useEffect(() => {
    DataIntegrator.initialize()
  }, [])

  return (
    <SidebarProvider>
      <div
        className={`flex h-screen w-full overflow-hidden ${settings.compactMode ? 'compact-mode' : ''} ${!settings.showAnimations ? 'no-animations' : ''}`}
      >
        <AppSidebar />
        <main className={`flex-1 relative ${isFullScreenPage ? 'overflow-hidden' : 'overflow-auto'}`}>
          <div className={isFullScreenPage
            ? "h-full w-full"
            : `container py-8 px-6 lg:px-8 ${settings.compactMode ? 'dashboard-shell' : ''} pb-24 md:pb-8`
          }>
            <div className={cn(
              "h-full w-full",
              !isFullScreenPage && "section-enter"
            )}>
              {children}
            </div>
          </div>
          <QuickCapture />
          <MobileNav />
        </main>
      </div>
    </SidebarProvider>
  )
}
