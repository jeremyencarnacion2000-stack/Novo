'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { SidebarProvider } from '@/components/ui/sidebar'

const AppSidebar = dynamic(() => import('@/components/app-sidebar').then((module) => ({ default: module.AppSidebar })), { ssr: false })
const MobileNav = dynamic(() => import('@/components/mobile-nav').then((module) => ({ default: module.MobileNav })), { ssr: false })

/**
 * The Cognitive Center gets a deliberately small app shell. The full shell
 * carries chat, voice, music and proactive orchestration modules that are
 * useful elsewhere, but none of them are required to render the Twin graph.
 * Keeping this boundary narrow makes the authenticated cognitive route usable
 * while those secondary modules remain progressively loaded on other pages.
 */
export function CognitiveRouteShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div data-app-viewport className="flex h-dvh w-full overflow-hidden">
        <div className="hidden h-full md:flex">
          <AppSidebar />
        </div>
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">{children}</div>
          </div>
          <div className="md:hidden">
            <MobileNav />
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
