import type { Metadata } from 'next'
import React from 'react'
import './globals.css'
import ClientLayout from './client-layout'


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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
      </head>
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

        {/* Global SVG Filters */}
        <svg
          aria-hidden="true"
          style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none', overflow: 'visible' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Liquid Gooey */}
            <filter id="liquid-gooey">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>

            {/* ── Novo Liquid Glass — Chromatic Aberration Displacement ── */}
            <filter id="novo-glass" colorInterpolationFilters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
              {/* Displacement map: radial gradient gray→edge colors */}
              <feFlood floodColor="#808080" result="gray" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="preblur" />

              {/* Red channel — strongest displacement */}
              <feDisplacementMap in="preblur" in2="gray" scale="8" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dR" />

              {/* Green channel — medium displacement */}
              <feDisplacementMap in="preblur" in2="gray" scale="5" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dG" />

              {/* Blue channel — least displacement */}
              <feDisplacementMap in="preblur" in2="gray" scale="3" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dB" />

              {/* Merge channels back */}
              <feBlend in="dR" in2="dG" mode="screen" result="rg" />
              <feBlend in="rg" in2="dB" mode="screen" />
            </filter>

            {/* Stronger variant for premium tier */}
            <filter id="novo-glass-strong" colorInterpolationFilters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="preblur" />
              <feFlood floodColor="#808080" result="gray" />

              <feDisplacementMap in="preblur" in2="gray" scale="14" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dR" />

              <feDisplacementMap in="preblur" in2="gray" scale="9" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dG" />

              <feDisplacementMap in="preblur" in2="gray" scale="5" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dB" />

              <feBlend in="dR" in2="dG" mode="screen" result="rg" />
              <feBlend in="rg" in2="dB" mode="screen" />
            </filter>
          </defs>
        </svg>
      </body>
    </html>
  )
}
