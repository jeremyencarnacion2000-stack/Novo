'use client'

import dynamic from 'next/dynamic'

const LibraryClient = dynamic(() => import('@/components/library-client'), { ssr: false })

export default function LibraryPage() {
  return <LibraryClient />
}
