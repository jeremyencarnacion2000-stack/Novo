'use client'

import dynamic from 'next/dynamic'
import { useSyncExternalStore } from 'react'

const DESKTOP_QUERY = '(min-width: 768px)'

const AppSidebar = dynamic(
  () => import('@/components/app-sidebar').then((module) => ({ default: module.AppSidebar })),
  { ssr: false, loading: () => null },
)

function subscribeToDesktopViewport(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function ResponsiveAppSidebar() {
  const isDesktop = useSyncExternalStore(subscribeToDesktopViewport, getDesktopSnapshot, getServerSnapshot)
  if (!isDesktop) return null

  return (
    <div className="hidden h-full md:flex">
      <AppSidebar />
    </div>
  )
}
