'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const FullClientLayout = dynamic(() => import('./client-layout'), { ssr: false })
const CognitiveClientLayout = dynamic(() => import('./cognitive/cognitive-client-layout'), { ssr: false })

/** Route-level client split: Cognitive must not compile the full app shell. */
export default function ClientLayoutRouter({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // RootLayout normally bypasses the authenticated shell for /landing via
  // the request pathname header. During client navigation, however, the root
  // layout can persist and this router becomes the final authority. Keep the
  // acquisition page independent here too so signed-in visitors never mount
  // global widgets or an app loading placeholder over the landing content.
  if (pathname?.startsWith('/landing')) return <>{children}</>
  if (pathname?.startsWith('/cognitive')) return <CognitiveClientLayout>{children}</CognitiveClientLayout>
  return <FullClientLayout>{children}</FullClientLayout>
}
