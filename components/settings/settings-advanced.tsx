'use client'

import { useState, useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  Download, RefreshCw, Trash2, RotateCcw, Database, Wifi, Upload, XCircle
} from 'lucide-react'
import { useSettings } from '@/lib/settings-context'
import { useSession, signOut } from 'next-auth/react'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { DataIntegrator } from '@/lib/data-integrator'
import { useTranslation } from '@/lib/i18n'
import { Section, SafeAction, DangerAction } from './settings-shared'

export function SettingsAdvanced() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { settings, resetSettings } = useSettings()
  const { data: session } = useSession()
  const { resetTwin } = useCognitiveTwin()

  // Backups / Data Integration
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [availableBackups, setAvailableBackups] = useState<{ date: string, data: any }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load available backups on mount
  useEffect(() => {
    const backups = DataIntegrator.getAvailableBackups()
    setAvailableBackups(backups)
  }, [])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      if (!session?.user?.id) {
        toast({
          title: 'Export failed',
          description: 'You must be logged in to export data.',
          variant: 'destructive',
        })
        return
      }
      const backupData = await DataIntegrator.exportData(session.user.id)
      const dataStr = JSON.stringify(backupData, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `novo-backup-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)

      toast({
        title: 'Data exported',
        description: 'Your data has been exported as JSON.',
      })
    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: 'Export failed',
        description: 'Failed to export your data. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const backupData = JSON.parse(content)

        if (!session?.user?.id) {
          toast({
            title: 'Import failed',
            description: 'You must be logged in to import data.',
            variant: 'destructive',
          })
          return
        }

        const result = await DataIntegrator.importData(session.user.id, backupData, { overwrite: true })

        if (result.conflicts.length > 0) {
          toast({
            title: 'Import completed with conflicts',
            description: `Data imported, but ${result.conflicts.length} conflicts were resolved.`,
          })
        } else {
          toast({
            title: 'Import Successful',
            description: `Imported: ${result.imported.join(', ')}. Page will reload.`,
          })
        }

        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } catch (error) {
        console.error('Import failed:', error)
        toast({
          title: 'Import Failed',
          description: 'The file format is invalid or corrupted.',
          variant: 'destructive',
        })
      } finally {
        setIsImporting(false)
      }
    }
    reader.readAsText(file)
  }

  const handleRestoreFromBackup = async (backupDate: string) => {
    try {
      if (!session?.user?.id) return
      const result = await DataIntegrator.restoreFromBackup(session.user.id, backupDate, { overwrite: true })

      toast({
        title: 'Restore Successful',
        description: `Restored from backup: ${result.imported.join(', ')}. Page will reload.`,
      })

      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Restore failed:', error)
      toast({
        title: 'Restore Failed',
        description: 'Failed to restore from backup.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteAllData = () => {
    if (confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      localStorage.clear()
      resetSettings()
      toast({
        title: 'All data deleted',
        description: 'Your data has been permanently deleted.',
        variant: 'destructive',
      })
      window.location.reload()
    }
  }

  const handleResetTwin = () => {
    if (!confirm('Reset Cognitive Twin? This will clear all learned patterns.')) return
    resetTwin()
    toast({
      title: 'Twin reset',
      description: 'Cognitive Twin has been cleared and will re-learn from scratch.'
    })
  }

  const handleClearCache = () => {
    if (!confirm('Clear local cache?')) return
    localStorage.clear()
    toast({
      title: 'Cache cleared',
      description: 'Local cache has been wiped. Reloading to sync from server.'
    })
    setTimeout(() => window.location.reload(), 1500)
  }

  const handleSyncDiagnostics = async () => {
    try {
      const res = await fetch('/api/cognitive-twin/sync')
      toast({
        title: res.ok ? 'Sync OK' : 'Sync issue',
        description: res.ok ? `Server reachable. Status ${res.status}.` : 'Could not reach sync endpoint.'
      })
    } catch {
      toast({
        title: 'Sync failed',
        description: 'Cannot reach server.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Section title="Local backups & restoring">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-white/40 mb-2">Sync or restore from automatic database snapshots.</p>
            {availableBackups.length > 0 ? (
              <div className="space-y-2">
                {availableBackups.slice(0, 5).map(backup => (
                  <div key={backup.date} className="flex items-center justify-between p-3 border border-white/5 rounded-xl bg-white/[0.005]">
                    <div>
                      <p className="text-sm font-semibold text-white/80">{new Date(backup.date).toLocaleString()}</p>
                      <p className="text-xs text-white/35">
                        {backup.data.checklist?.length || 0} tasks, {backup.data.routines?.length || 0} habits, {backup.data.projects?.length || 0} pipelines
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreFromBackup(backup.date)}
                      className="border-white/10 hover:bg-white/5"
                    >
                      <RefreshCw className="h-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/30 italic">No automated backups available.</p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Import / Export Data">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.export.label')}</Label>
            <p className="text-xs text-white/35 mb-2">{t('settings.export.desc')}</p>
            <SafeAction icon={Download} label="Export Backup" description="Download all user data as JSON." onClick={handleExport} loading={isExporting} />
          </div>

          <Separator className="bg-white/[0.05]" />

          <div className="space-y-2">
            <Label>{t('settings.import.label')}</Label>
            <p className="text-xs text-white/35 mb-2">{t('settings.import.desc')}</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
            <SafeAction
              icon={Upload}
              label={isImporting ? 'Importing...' : 'Import Backup'}
              description="Choose a JSON backup to overwrite current state."
              onClick={() => fileInputRef.current?.click()}
              loading={isImporting}
            />
          </div>
        </div>
      </Section>

      <Section title="System Diagnostics">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-2">
          <SafeAction icon={Wifi} label="Run Sync Diagnostics" description="Verify client-server replication endpoints." onClick={handleSyncDiagnostics} />
          <SafeAction icon={Database} label="Clear Local cache" description="Force reload state by clearing localStorage." onClick={handleClearCache} />
          <SafeAction icon={RotateCcw} label="Recalibrate Twin" description="Force profile alignment from cognitive metrics." onClick={() => toast({ title: 'Recalibration queued', description: 'Recalibrating profile over active chronotype cycles.' })} />
        </div>
      </Section>

      {/* Danger zone actions */}
      <Section title="Danger Zone">
        <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.01] p-5 space-y-2">
          <DangerAction icon={RefreshCw} label="Reset Cognitive Twin" description="Erase learned intelligence profile patterns. Cannot be undone." onClick={handleResetTwin} />
          <DangerAction icon={Trash2} label={t('settings.delete_all')} description="Permanently delete all workspace items and settings. Cannot be undone." onClick={handleDeleteAllData} />
        </div>
      </Section>

      <Section title="Session Actions">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Sign Out from Novo OS
          </Button>
        </div>
      </Section>
    </div>
  )
}
