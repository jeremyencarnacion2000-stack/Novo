'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from '@/components/providers'
import { CommandPalette } from '@/components/command-palette'
import { NetworkStatus } from '@/components/network-status'
import { FloatingChatButton } from '@/components/FloatingChatButton'
import { useFocus } from '@/lib/focus-context'
import ChatbotPanel from '@/chatbot/ChatbotPanel'
import FloatingChatbot from '@/components/ai/floating-chatbot'
import '@/lib/storage'
import { FloatingMusicWidget } from '@/components/music/floating-music-widget'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Providers>
      {children}
      <CommandPalette />
      <NetworkStatus />
      <Toaster />
      <FloatingChatButton isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />
      {isOpen && <ChatbotPanel isOpen={isOpen} />}
      <FloatingMusicWidget />
      <FloatingChatbot />
    </Providers>
  )
}