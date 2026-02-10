'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SessionProvider, useSession } from 'next-auth/react'
import { Toaster } from '@/components/ui/toaster'
import { CommandPalette } from '@/components/command-palette'
import { NetworkStatus } from '@/components/network-status'
import { FocusProvider } from '@/lib/focus-context'
import { SettingsProvider } from '@/lib/settings-context'
import { NotificationProvider } from '@/lib/notification-context'
import { PomodoroProvider } from '@/lib/pomodoro-context'
import { PomodoroWidget } from '@/components/pomodoro-widget'
import '@/lib/storage'
import { FloatingMusicWidget } from '@/components/music/floating-music-widget'
import { GlobalPlayer } from '@/components/music/global-player'
import { MiniChatbot } from '@/components/ai/mini-chatbot'
import { QuickCapture } from '@/components/quick-capture'
import { DashboardShell } from '@/components/dashboard-shell'
import { ChatbotProvider } from '@/components/ai/modern-chatbot/context'
import { ChatbotSidebar } from '@/components/ai/modern-chatbot/chatbot-sidebar'
import { useSessionTracking } from '@/hooks/use-session-tracking'

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // Enable automatic session tracking
  useSessionTracking()

  useEffect(() => {
    // If not authenticated and not on the sign-in page, redirect to sign-in
    if (status === 'unauthenticated' && pathname !== '/auth/signin') {
      router.push('/auth/signin')
    }
  }, [status, router, pathname])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  // Only render children if authenticated or on the sign-in page
  if (status === 'authenticated' || pathname === '/auth/signin') {
    // Don't wrap with DashboardShell on auth pages
    if (pathname === '/auth/signin') {
      return <>{children}</>
    }

    return (
      <DashboardShell>
        {children}
      </DashboardShell>
    )
  }

  return null
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <SettingsProvider>
        <NotificationProvider>
          <PomodoroProvider>
            <FocusProvider>
              <ChatbotProvider>
                <AuthWrapper>
                  <GlobalPlayer>
                    <>
                      {children}
                      <QuickCapture />
                    </>
                  </GlobalPlayer>
                </AuthWrapper>
                <CommandPalette />
                <NetworkStatus />
                <Toaster />
                <FloatingMusicWidget />
                <PomodoroWidget />
                <ChatbotSidebar />
                <MiniChatbot />
              </ChatbotProvider>
            </FocusProvider>
          </PomodoroProvider>
        </NotificationProvider>
      </SettingsProvider>
    </SessionProvider>
  )
}