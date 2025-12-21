import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'
import './globals.css'
import ClientLayout from './client-layout'
import { ChatbotSidebar } from '@/components/ai/modern-chatbot/chatbot-sidebar'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Novo - Productivity Hub',
  description: 'Your all-in-one productivity platform for routines, tasks, projects, and tracking',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icon-light-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full font-sans antialiased relative">
        {/* Dynamic Background Overlay */}
        {/* Dynamic Background Overlay - Level 0 */}
        <div
          className="fixed inset-0 z-[-1] pointer-events-none transition-all duration-500 ease-in-out"
          style={{
            background: `
              radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 85% 30%, rgba(124, 58, 237, 0.10) 0%, transparent 40%),
              radial-gradient(circle at 15% 70%, rgba(56, 189, 248, 0.10) 0%, transparent 40%),
              linear-gradient(to bottom, rgba(11, 11, 15, 0.85), rgba(11, 11, 15, 0.95))
            `,
            backdropFilter: 'blur(var(--bg-blur, 40px))'
          }}
        />
        {/* Dynamic Dimness Overlay */}
        <div
          className="fixed inset-0 z-[-1] pointer-events-none bg-black transition-opacity duration-500 ease-in-out"
          style={{ opacity: 'var(--bg-dimness, 0.2)' }}
        />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
