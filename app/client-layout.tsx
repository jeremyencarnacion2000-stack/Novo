'use client'

import React, { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SessionProvider, useSession } from 'next-auth/react'
import { Toaster } from '@/components/ui/toaster'
import { CommandPalette } from '@/components/command-palette'
import { NetworkStatus } from '@/components/network-status'
import { FloatingChatButton } from '@/components/FloatingChatButton'
import { useFocus, FocusProvider } from '@/lib/focus-context'
import { SettingsProvider } from '@/lib/settings-context'
import { NotificationProvider } from '@/lib/notification-context'
import { PomodoroProvider } from '@/lib/pomodoro-context'
import { PomodoroWidget } from '@/components/pomodoro-widget'
import { FocusTimerWidget } from '@/components/focus-timer-widget'
import ChatbotPanel from '@/chatbot/ChatbotPanel'
import FloatingChatbot from '@/components/ai/floating-chatbot'
import '@/lib/storage'
import { FloatingMusicWidget } from '@/components/music/floating-music-widget'
import { GlobalPlayer } from '@/components/music/global-player'

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // If not authenticated and not on the sign-in page, redirect to sign-in
    if (status === 'unauthenticated' && pathname !== '/auth/signin') {
      router.push('/auth/signin')
    }
  }, [status, router, pathname])

  if (status === 'loading') {
    return <div>Loading...</div> // Or a proper loading spinner/component
  }

  // Only render children if authenticated or on the sign-in page
  if (status === 'authenticated' || pathname === '/auth/signin') {
    return <>{children}</>
  }

  return null
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <SessionProvider>
      <SettingsProvider>
        <NotificationProvider>
          <PomodoroProvider>
            <FocusProvider>
              <AuthWrapper>
                <GlobalPlayer>
                  <>
                    {children}
                    <CommandPalette />
                    <NetworkStatus />
                    <Toaster />
                    <FloatingChatButton isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />
                    {isOpen && <ChatbotPanel isOpen={isOpen} />}
                    <FloatingMusicWidget />
                    <FocusTimerWidget />
                    <PomodoroWidget />
                    <React.Suspense fallback={null}>
                      <FloatingChatbot />
                    </React.Suspense>
                  </>
                </GlobalPlayer>
              </AuthWrapper>
            </FocusProvider>
          </PomodoroProvider>
        </NotificationProvider>
      </SettingsProvider>
    </SessionProvider>
  )
}