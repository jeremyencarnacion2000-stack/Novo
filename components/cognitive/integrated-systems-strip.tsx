'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus } from 'lucide-react'

// Real connection status only — reuses the same endpoints Settings >
// Integrations already calls, plus the session (Google) and billing status
// (Stripe/Pro) built earlier this session. No GitHub/Gmail — this app
// doesn't integrate with either, so they don't belong in a "connected
// systems" readout.
interface SystemStatus {
  label: string
  connected: boolean
}

export function IntegratedSystemsStrip() {
  const { data: session } = useSession()
  const [notionConnected, setNotionConnected] = useState(false)
  const [driveConnected, setDriveConnected] = useState(false)
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/integration/notion').then((r) => r.json()).then((d) => setNotionConnected(!!d.connected)).catch(() => {})
    fetch('/api/integration/drive').then((r) => r.json()).then((d) => setDriveConnected(!!d.connected && !!d.hasScope)).catch(() => {})
    fetch('/api/billing/status').then((r) => r.json()).then((d) => setIsPro(d.plan === 'pro')).catch(() => {})
  }, [session?.user?.id])

  const systems: SystemStatus[] = [
    { label: 'Google', connected: !!session?.user },
    { label: 'Notion', connected: notionConnected },
    { label: 'Drive', connected: driveConnected },
    { label: 'Stripe', connected: isPro },
  ]
  const connectedCount = systems.filter((s) => s.connected).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/30">
          Integrated Systems · {connectedCount}/{systems.length} Connected
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {systems.map((s) => (
          <div
            key={s.label}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
              s.connected
                ? 'bg-emerald-500/[0.06] border-emerald-500/15 text-emerald-300/90'
                : 'bg-foreground/[0.015] border-foreground/[0.06] text-foreground/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${s.connected ? 'bg-emerald-400' : 'bg-foreground/20'}`} />
            {s.label}
          </div>
        ))}
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-foreground/[0.08] text-xs font-semibold text-foreground/30 hover:text-foreground/50 hover:border-foreground/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Integration
        </Link>
      </div>
    </div>
  )
}
