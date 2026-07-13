
import { SettingsControlCenter } from '@/components/settings/settings-control-center'

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 mb-1">Control Center</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/90">
          System Settings
        </h1>
        <p className="text-foreground/40 mt-1 text-sm">
          Cognitive Twin telemetry, behavioral controls, and advanced diagnostics.
        </p>
      </div>

      <SettingsControlCenter />
    </div>
  )
}
