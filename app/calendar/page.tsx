'use client'

import dynamic from 'next/dynamic'

const CalendarClient = dynamic(() => import('@/components/calendar-client'), { ssr: false })

export default function CalendarPage() {
  return <CalendarClient />
}
