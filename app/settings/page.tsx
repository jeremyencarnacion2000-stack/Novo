import { DashboardShell } from '@/components/dashboard-shell'
import { SettingsSections } from '@/components/settings/settings-sections'

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
            Settings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Manage your preferences and customize your Novo experience
          </p>
        </div>

        <SettingsSections />
      </div>
    </DashboardShell>
  )
}
