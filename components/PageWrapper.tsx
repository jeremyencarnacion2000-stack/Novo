'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useScrollContainer } from '@/lib/scroll-container-context'
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider'
import { LiquidRouteTransition } from '@/components/liquid-route-transition'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  isFullScreen?: boolean
}

export function PageWrapper({ children, className, isFullScreen = false }: PageWrapperProps) {
  const { setScrollContainer } = useScrollContainer()

  // Register scroll container
  // A ref assignment does not cause a render. Keep the mounted element in state
  // so SmoothScrollProvider receives it after this page scroller exists.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      setScrollElement(node)
      if (!isFullScreen && node) {
        setScrollContainer(node)
      } else {
        setScrollContainer(null)
      }
    },
    [isFullScreen, setScrollContainer]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => setScrollContainer(null)
  }, [setScrollContainer])

  return (
    <LiquidRouteTransition>
    <div
      ref={setRef}
      className={cn(
        'w-full h-full flex flex-col min-h-0 absolute inset-0',
        isFullScreen
          ? 'overflow-hidden'
          : 'overflow-y-auto overflow-x-hidden scrollbar-hide',
        className
      )}
    >
      {isFullScreen ? (
        <div className="flex-1 min-h-0 w-full relative flex flex-col overflow-hidden">
          {children}
        </div>
      ) : (
        <SmoothScrollProvider scrollElement={scrollElement}>
          {/* pb-40 (not pb-24): GeminiLiveOrb (components/ai/GeminiLiveOrb.tsx)
              floats fixed at bottom:5rem with a 56px button — its top edge
              sits ~136px above the viewport bottom, which pb-24 (96px)
              doesn't clear, so it overlapped the last visible content on
              pages like /checklist and /business. md:pb-8 is unchanged —
              the orb isn't a clearance problem at desktop's larger heights. */}
          <div className="container py-6 px-4 md:py-8 md:px-6 lg:px-8 pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-8 flex-1 w-full">
            {children}
          </div>
        </SmoothScrollProvider>
      )}
    </div>
    </LiquidRouteTransition>
  )
}
