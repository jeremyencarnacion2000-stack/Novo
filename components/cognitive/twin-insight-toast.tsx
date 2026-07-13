'use client'

import { useEffect, useRef } from 'react'
import { toast } from '@/hooks/use-toast'

const SEEN_KEY = 'novo-last-twin-insight-id'
const POLL_MS = 30_000

// Ambient signal that the Cognitive Twin is genuinely learning — polls the
// same feed the /cognitive Bitácora reads (TwinEvolutionLog via
// /api/cognitive/decisions), and toasts only real new inferences (not
// ai_action entries, which are a different signal). First poll just
// baselines the last-seen id so existing history doesn't dump a wall of
// toasts on load.
export function TwinInsightToast() {
  const lastSeenId = useRef<string | null>(null)

  useEffect(() => {
    lastSeenId.current = localStorage.getItem(SEEN_KEY)

    const check = async () => {
      try {
        const res = await fetch('/api/cognitive/decisions')
        if (!res.ok) return
        const entries: { id: string; changeType: string; description: string }[] = await res.json()
        const latestInsight = entries.find((e) => e.changeType !== 'ai_action')
        if (!latestInsight) return

        if (lastSeenId.current && latestInsight.id !== lastSeenId.current) {
          toast({ title: '🧠 Twin Novo', description: latestInsight.description, variant: 'info' })
        }
        lastSeenId.current = latestInsight.id
        localStorage.setItem(SEEN_KEY, latestInsight.id)
      } catch {
        // ponytail: silent — this is an ambient nicety, not a critical path
      }
    }

    check()
    const interval = setInterval(check, POLL_MS)
    return () => clearInterval(interval)
  }, [])

  return null
}
