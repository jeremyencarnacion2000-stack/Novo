'use client'

import Link from 'next/link'
import { ArrowUpRight, Plug } from 'lucide-react'

// Notion/Drive connect state + handlers moved to components/connectors/connectors-client.tsx,
// which now drives the full /connectors marketplace page (all 6 real connections
// plus "coming soon" ones). This tab is just a pointer so Settings doesn't
// duplicate that surface.
export function SettingsIntegrations() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-6 flex flex-col items-center text-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
          <Plug className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground/85">Conectores movidos</p>
          <p className="text-xs text-foreground/35 mt-1 max-w-xs">
            Notion, Google Drive y el resto de las integraciones ahora viven en una página dedicada.
          </p>
        </div>
        <Link
          href="/connectors"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
        >
          Ir a Conectores
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
