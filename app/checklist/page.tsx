'use client'

import dynamic from 'next/dynamic'

const ChecklistClient = dynamic(() => import('@/components/checklist-client'), { ssr: false })

export default function ChecklistPage() {
  return <ChecklistClient />
}
