'use client'

import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { ALL_MODULES } from '@/components/settings/settings-shared'
import { Settings2 } from 'lucide-react'
import Link from 'next/link'

// Real data only — reuses the same enabledModules the user actually toggled
// in Settings > Modules (workspaceLayout.enabledModules), not a fixed list
// of "cognitive-sounding" module names.
export function ActiveModulesStrip() {
  const { twin } = useCognitiveTwin()
  const enabledIds = twin.workspaceLayout?.enabledModules ?? []
  const modules = enabledIds
    .map((id) => ALL_MODULES.find((m) => m.id === id))
    .filter((m): m is (typeof ALL_MODULES)[number] => !!m)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/30">
          Active Modules · {modules.length} Active
        </p>
        <Link
          href="/settings"
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-foreground/25 hover:text-foreground/50 transition-colors"
        >
          <Settings2 className="w-3 h-3" />
          Manage
        </Link>
      </div>
      {modules.length === 0 ? (
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-5 text-center">
          <p className="text-xs text-foreground/30">No hay módulos activos. Actívalos en Settings → Modules.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {modules.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.id}
                className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-3.5 flex items-center gap-2.5 hover:bg-foreground/[0.03] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-xs font-semibold text-foreground/75 truncate">{m.title}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
