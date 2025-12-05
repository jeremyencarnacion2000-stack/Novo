'use client'

import React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useSettings } from '@/lib/settings-context'

import { DataIntegrator } from '@/lib/data-integrator'
import { useEffect } from 'react'

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { settings } = useSettings()

  useEffect(() => {
    DataIntegrator.initialize()
  }, [])

  return (
    <SidebarProvider>
      <div
        className={`flex min-h-screen w-full ${settings.compactMode ? 'compact-mode' : ''} ${!settings.showAnimations ? 'no-animations' : ''}`}
      >
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {/* Mobile Header with Hamburger Menu */}
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-3 md:hidden">
            <SidebarTrigger />
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">N</span>
            </div>
            <div>
              <h2 className="text-base font-bold leading-none">Novo</h2>
              <p className="text-xs text-muted-foreground">Productivity Hub</p>
            </div>
          </div>

          <div className={`container py-8 px-6 lg:px-8 ${settings.compactMode ? 'dashboard-shell' : ''}`}>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
