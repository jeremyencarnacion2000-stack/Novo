import type { Metadata } from 'next'
import React from 'react'
import Script from 'next/script'
import { headers } from 'next/headers'
import './globals.css'
import ClientLayoutRouter from './client-layout-router'

const GA_MEASUREMENT_ID = 'G-429617187'


const SITE_URL = process.env.NEXTAUTH_URL || 'https://productivitynovo.vercel.app'
const TITLE = 'Novo — Cognitive Operating System'
const DESCRIPTION = 'Deja de organizar tareas. Novo construye un Gemelo Cognitivo a partir de tu comportamiento real para responder una sola pregunta: ¿qué deberías hacer ahora mismo?'

// metadataBase + the openGraph/twitter blocks were missing entirely — every
// link share (WhatsApp, X, LinkedIn, Discord) rendered as a bare URL with no
// preview card, no image, and a stale "Productivity Hub" title from before
// the rebrand. app/opengraph-image.tsx supplies the actual card image;
// Next.js auto-wires it into these tags once metadataBase is set.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  generator: 'v0.app',
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Novo',
    locale: 'es',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
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

// The root layout needs the request path to keep the public review page out
// of the authenticated client shell. This is intentionally dynamic: a static
// client-shell placeholder would hide the landing HTML from JS-disabled
// reviewers and automated agents.
export const dynamic = 'force-dynamic'

// ─── Font Strategy: Self-hosted via CSS variable ─────────────────────────────
// next/font/google requires network access to fonts.googleapis.com at build time.
// To make builds resilient in offline/CI environments, we use a CSS variable
// defined in globals.css that loads Inter via a local @font-face declaration.
// The className below matches what Inter({ variable: '--font-sans' }) would produce.

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const requestHeaders = await headers()
  const requestPath = requestHeaders.get('x-novo-path') ?? requestHeaders.get('x-matched-path') ?? ''
  // OAuth consent is a browser hand-off surface, not part of the authenticated
  // product shell. Keeping it outside ClientLayoutRouter prevents the sidebar,
  // wallpaper and app-level navigation from appearing behind the authorization
  // request opened by an external client.
  const isStandalonePage =
    requestPath === '/landing' ||
    requestPath.startsWith('/landing/') ||
    requestPath === '/oauth/consent' ||
    requestPath.startsWith('/oauth/consent/') ||
    requestPath === '/docs' ||
    requestPath.startsWith('/docs/')

  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
        {/* Outfit — landing-only display font (app/landing/page.tsx scopes it via
            an inline font-family on its root div). Loaded here, not next/font/google,
            for the same offline/CI build-reliability reason as Inter above. Every
            other page keeps --font-sans: Inter unchanged. */}
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300..800&display=swap" rel="stylesheet" />
      </head>

      {/* ── Google Analytics 4 ── loads after hydration, non-blocking */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            send_page_view: true,
          });
        `}
      </Script>

      <body className={`font-sans h-full antialiased relative ${isStandalonePage ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}>
        {/* Wallpaper and dimness are rendered by the body pseudo-layers in
            globals.css. A single owner avoids competing negative stacking
            contexts on desktop Chromium. */}
        {isStandalonePage ? children : <ClientLayoutRouter>{children}</ClientLayoutRouter>}

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
