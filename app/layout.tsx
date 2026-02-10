import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'
import './globals.css'
import ClientLayout from './client-layout'
import { ChatbotSidebar } from '@/components/ai/modern-chatbot/chatbot-sidebar'

const inter = Inter({ subsets: ["latin"], display: 'swap' });

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
        {/* Background Image Layer (Custom) */}
        <div
          className="fixed inset-0 z-[-2] pointer-events-none transition-opacity duration-700 ease-in-out"
          style={{
            backgroundImage: 'var(--bg-image, none)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 1
          }}
        />

        {/* Dynamic Background Overlay - Level 0 (Gradients & Blur) */}
        <div
          className="fixed inset-0 z-[-1] pointer-events-none transition-all duration-500 ease-in-out"
          style={{
            background: `
              radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.25) 0%, transparent 60%),
              radial-gradient(circle at 85% 30%, rgba(124, 58, 237, 0.20) 0%, transparent 50%),
              radial-gradient(circle at 15% 60%, rgba(56, 189, 248, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 50% 100%, rgba(99, 102, 241, 0.10) 0%, transparent 50%),
              linear-gradient(to bottom, rgba(2, 2, 3, 0.7), rgba(5, 5, 7, 0.8))
            `,
            backdropFilter: 'blur(var(--bg-blur, 60px))',
            // If there's a background image, we might want to reduce the opacity of the base gradient
            // but the radial gradients should stay for the "glow" effect.
            // For now, we keep it as is, but the linear-gradient at the bottom might cover the image.
            // Let's make the linear-gradient slightly transparent if an image is present.
          }}
        />

        {/* Dynamic Dimness Overlay - The Secret Contrast Layer */}
        <div
          className="fixed inset-0 z-[-1] pointer-events-none transition-opacity duration-500 ease-in-out"
          style={{
            background: 'linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.45))',
            opacity: 1
          }}
        />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
