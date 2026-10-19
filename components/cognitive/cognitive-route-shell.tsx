'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useDevicePresence } from '@/hooks/use-device-presence'
import { LiquidRouteTransition } from '@/components/liquid-route-transition'
import { ResponsiveAppSidebar } from '@/components/responsive-app-sidebar'
import { CognitiveNavigationUtilities } from '@/components/cognitive/cognitive-navigation-utilities'
import { useSettings } from '@/lib/settings-context'
import { cn } from '@/lib/utils'

const MobileNav = dynamic(() => import('@/components/mobile-nav').then((module) => ({ default: module.MobileNav })), { ssr: false })

/**
 * The Cognitive Center gets a deliberately small app shell. The full shell
 * carries chat, voice, music and proactive orchestration modules that are
 * useful elsewhere, but none of them are required to render the Twin graph.
 * Keeping this boundary narrow makes the authenticated cognitive route usable
 * while those secondary modules remain progressively loaded on other pages.
 */
export function CognitiveRouteShell({ children }: { children: ReactNode }) {
  useDevicePresence()
  const { settings } = useSettings()

  return (
    <SidebarProvider defaultOpen={false}>
      <div data-app-viewport className={cn('flex h-dvh w-full overflow-hidden', settings.compactMode && 'compact-mode', !settings.showAnimations && 'no-animations')}>
        <div data-app-wallpaper aria-hidden />
        <ResponsiveAppSidebar />
        <main id="cognitive-main" className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <LiquidRouteTransition>
              <div data-cognitive-scroll className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
                <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-[calc(10rem+env(safe-area-inset-bottom))] md:px-6 md:py-8 lg:px-8">
                  {children}
                </div>
              </div>
            </LiquidRouteTransition>
          </div>
          <CognitiveNavigationUtilities />
          <div className="md:hidden">
            <MobileNav />
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
