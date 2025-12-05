'use client'

import dynamic from 'next/dynamic'

const AppearanceClient = dynamic(() => import('@/components/appearance-client'), { ssr: false })

export default function AppearancePage() {
  return <AppearanceClient />
}
