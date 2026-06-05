import type { Metadata } from 'next'
import React from 'react'
import './globals.css'
import ClientLayout from './client-layout'
// NOTE: ChatbotSidebar is lazy-loaded via next/dynamic in client-layout.tsx
// Importing it here again would double-bundle it — removed.


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

// ─── Font Strategy: Self-hosted via CSS variable ─────────────────────────────
// next/font/google requires network access to fonts.googleapis.com at build time.
// To make builds resilient in offline/CI environments, we use a CSS variable
// defined in globals.css that loads Inter via a local @font-face declaration.
// The className below matches what Inter({ variable: '--font-sans' }) would produce.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="font-sans h-full antialiased relative">
        {/* Background Image is now applied directly to the body in settings-context.tsx */}

        {/* Dynamic Background Overlay - Level 0 (Gradients) — desktop only */}
        <div
          className="bg-overlay fixed inset-0 z-[-2] pointer-events-none hidden md:block"
          style={{
            backdropFilter: 'blur(var(--bg-blur-px, 0px))',
            WebkitBackdropFilter: 'blur(var(--bg-blur-px, 0px))',
          }}
        />

        <div
          className="bg-gradient-overlay fixed inset-0 z-[-1] pointer-events-none transition-opacity duration-500 ease-in-out hidden md:block"
          style={{
            background: 'var(--app-bg-overlay)'
          }}
        />

        {/* Dynamic Dimness Overlay — desktop only */}
        <div
          className="dimness-overlay fixed inset-0 z-[-1] pointer-events-none transition-opacity duration-500 ease-in-out hidden md:block"
          style={{
            background: '#000000',
            opacity: 'var(--bg-dimness, 0.2)'
          }}
        />
        <ClientLayout>{children}</ClientLayout>

        {/* Global SVG Liquid Gooey Filter */}
        <svg
          style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
        >
          <defs>
            <filter id="liquid-gooey">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      </body>
    </html>
  )
}
