'use client'

import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useSettings } from '@/lib/settings-context'

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { settings } = useSettings()
  
  return (
    <SidebarProvider>
      <div 
        className={`flex min-h-screen w-full ${settings.compactMode ? 'compact-mode' : ''} ${!settings.showAnimations ? 'no-animations' : ''}`}
      >
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className={`container py-8 px-6 lg:px-8 ${settings.compactMode ? 'dashboard-shell' : ''}`}>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
