'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { Moon, Sun, Bell, Database, User, Lock, Globe, Download, Trash2, RefreshCw, History, Bot, Upload, CheckCircle, XCircle } from 'lucide-react'
import { useSettings } from '@/lib/settings-context'
import { useNotifications } from '@/lib/notification-context'
import { DataIntegrator } from '@/lib/data-integrator'
import type { AIModel } from '@/types/ai'
import { useState, useRef, useEffect } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react' // New: signIn, signOut, useSession
import { SiSpotify } from 'react-icons/si' // New: Spotify Icon

export function SettingsSections() {
  const { toast } = useToast()
  const { settings, updateSettings, resetSettings } = useSettings()
  const { isSupported, permission, requestPermission, settings: notificationSettings, updateSettings: updateNotificationSettings } = useNotifications()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [availableBackups, setAvailableBackups] = useState<{ date: string, data: any }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: session } = useSession() // New: useSession hook

  // AI Models state
  const [models, setModels] = useState<AIModel[]>([])
  const [isUploadingModel, setIsUploadingModel] = useState(false)
  const [modelUploadProgress, setModelUploadProgress] = useState(0)
  const modelFileInputRef = useRef<HTMLInputElement>(null)
  const [newModelName, setNewModelName] = useState('')
  const [newModelType, setNewModelType] = useState<'lora' | 'base'>('base')
  const [newModelBase, setNewModelBase] = useState('')

  // Load available backups on mount
  useEffect(() => {
    const backups = DataIntegrator.getAvailableBackups()
    setAvailableBackups(backups)
  }, [])

  // Load AI models on mount
  useEffect(() => {
    // Dynamic import to avoid SSR issues with @xenova/transformers
    import('@/lib/ai-models').then(({ aiModelManager }) => {
      const loadedModels = aiModelManager.getModels()
      setModels(loadedModels)
    }).catch(console.error)
  }, [])

  // Handle auto-backup toggle
  useEffect(() => {
    if (settings.autoBackup && session?.user?.id) {
      DataIntegrator.scheduleAutoBackup(session.user.id, settings.backupFrequency)
    } else {
      // Clear existing timer
      const existingTimer = localStorage.getItem('novo-auto-backup-timer')
      if (existingTimer) {
        clearInterval(parseInt(existingTimer))
        localStorage.removeItem('novo-auto-backup-timer')
      }
    }
  }, [settings.autoBackup, settings.backupFrequency])

  const handleSave = () => {
    toast({
      title: 'Settings saved',
      description: 'Your preferences have been updated successfully.',
    })
  }

  const updateSetting = (key: string, value: any) => {
    updateSettings({ [key]: value })
  }

  const handleRequestPermission = async () => {
    const result = await requestPermission()
    if (result === 'granted') {
      toast({
        title: 'Notifications enabled',
        description: 'You will now receive push notifications.',
      })
    } else {
      toast({
        title: 'Notifications denied',
        description: 'Push notifications are disabled. You can enable them in your browser settings.',
        variant: 'destructive',
      })
    }
  }

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
      const userId = session.user.id
      const backupData = await DataIntegrator.exportData(userId)

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

  const handleImportClick = () => {
    fileInputRef.current?.click()
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
        const userId = session.user.id

        const result = await DataIntegrator.importData(userId, backupData, { overwrite: true })

        if (result.conflicts.length > 0) {
          toast({
            title: 'Import completed with conflicts',
            description: `Data imported, but ${result.conflicts.length} conflicts were resolved by overwriting.`,
          })
        } else {
          toast({
            title: 'Import Successful',
            description: `Imported: ${result.imported.join(', ')}. The page will reload.`,
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
      const userId = session.user.id
      const result = await DataIntegrator.restoreFromBackup(userId, backupDate, { overwrite: true })

      toast({
        title: 'Restore Successful',
        description: `Restored from backup: ${result.imported.join(', ')}. The page will reload.`,
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

  // AI Model functions
  const handleModelUploadClick = () => {
    modelFileInputRef.current?.click()
  }

  const handleModelFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !newModelName.trim()) return

    const validation = aiModelManager.validateModelFile(file)
    if (!validation.valid) {
      toast({
        title: 'Invalid model file',
        description: validation.error,
        variant: 'destructive',
      })
      return
    }

    setIsUploadingModel(true)
    setModelUploadProgress(0)

    try {
      const model = await aiModelManager.uploadModel(
        file,
        newModelName.trim(),
        newModelType,
        newModelType === 'lora' ? newModelBase : undefined
      )

      setModels(aiModelManager.getModels())
      setNewModelName('')
      setNewModelBase('')
      setModelUploadProgress(100)

      toast({
        title: 'Model uploaded',
        description: `${model.name} has been uploaded successfully.`,
      })
    } catch (error) {
      console.error('Model upload failed:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload the model. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingModel(false)
      setModelUploadProgress(0)
    }
  }

  const handleSetActiveModel = async (modelId: string) => {
    try {
      await aiModelManager.setActiveModel(modelId)
      setModels(aiModelManager.getModels())

      const model = models.find(m => m.id === modelId)
      toast({
        title: 'Active model changed',
        description: `${model?.name} is now active.`,
      })
    } catch (error) {
      console.error('Failed to set active model:', error)
      toast({
        title: 'Failed to activate model',
        description: 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteModel = async (modelId: string, modelName: string) => {
    if (!confirm(`Are you sure you want to delete the model "${modelName}"?`)) return

    try {
      await aiModelManager.deleteModel(modelId)
      setModels(aiModelManager.getModels())

      toast({
        title: 'Model deleted',
        description: `${modelName} has been removed.`,
      })
    } catch (error) {
      console.error('Failed to delete model:', error)
      toast({
        title: 'Failed to delete model',
        description: 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              {settings.theme === 'dark' ? (
                <Moon className="h-4 w-4 text-primary" />
              ) : (
                <Sun className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Appearance</CardTitle>
              <CardDescription className="text-sm">Customize the look and feel of Novo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
            <Select
              value={settings.theme}
              onValueChange={(value) => updateSetting('theme', value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Use less spacing in the interface
              </p>
            </div>
            <Switch
              checked={settings.compactMode}
              onCheckedChange={(checked) => updateSetting('compactMode', checked)}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Animations</Label>
              <p className="text-sm text-muted-foreground">
                Enable smooth transitions and effects
              </p>
            </div>
            <Switch
              checked={settings.showAnimations}
              onCheckedChange={(checked) => updateSetting('showAnimations', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Notifications</CardTitle>
              <CardDescription className="text-sm">Manage how you receive updates and reminders</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Daily Reminder</Label>
              <p className="text-sm text-muted-foreground">
                Get a daily reminder to check your tasks
              </p>
            </div>
            <Switch
              checked={settings.dailyReminder}
              onCheckedChange={(checked) => updateSetting('dailyReminder', checked)}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Reminder Time</Label>
              <p className="text-sm text-muted-foreground">
                When to send daily reminders
              </p>
            </div>
            <Input
              type="time"
              value={settings.reminderTime}
              onChange={(e) => updateSetting('reminderTime', e.target.value)}
              className="w-full sm:w-[180px]"
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Routine Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Alerts for your scheduled routines
              </p>
            </div>
            <Switch
              checked={settings.routineNotifications}
              onCheckedChange={(checked) => updateSetting('routineNotifications', checked)}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Project Deadlines</Label>
              <p className="text-sm text-muted-foreground">
                Reminders for upcoming project deadlines
              </p>
            </div>
            <Switch
              checked={settings.projectDeadlines}
              onCheckedChange={(checked) => updateSetting('projectDeadlines', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium">Push Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Desktop push notifications for enhanced engagement
              </p>
            </div>

            {isSupported ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Status: {permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Denied' : 'Not requested'}
                    </p>
                  </div>
                  {permission !== 'granted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRequestPermission}
                    >
                      {permission === 'denied' ? 'Re-enable' : 'Enable'} Notifications
                    </Button>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <Label>Habit Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Push notifications for habit tracking
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.habitReminders}
                    onCheckedChange={(checked) => updateNotificationSettings({ habitReminders: checked })}
                    disabled={permission !== 'granted'}
                  />
                </div>

                <Separator />

                {settings.theme === 'auto' && (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto Theme Mode</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose how auto theme switching works
                        </p>
                      </div>
                      <Select
                        value={settings.autoThemeMode}
                        onValueChange={(value: 'system' | 'time' | 'both') => updateSetting('autoThemeMode', value)}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System Preference</SelectItem>
                          <SelectItem value="time">Time of Day</SelectItem>
                          <SelectItem value="both">System + Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />
                  </>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <Label>Task Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications for new tasks and updates
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.taskNotifications}
                    onCheckedChange={(checked) => updateNotificationSettings({ taskNotifications: checked })}
                    disabled={permission !== 'granted'}
                  />
                </div>

                <Separator />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <Label>Progress Achievements</Label>
                    <p className="text-sm text-muted-foreground">
                      Celebrate your milestones and achievements
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.progressAchievements}
                    onCheckedChange={(checked) => updateNotificationSettings({ progressAchievements: checked })}
                    disabled={permission !== 'granted'}
                  />
                </div>

                <Separator />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <Label>Sound Effects</Label>
                    <p className="text-sm text-muted-foreground">
                      Play sounds with notifications
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.soundEnabled}
                    onCheckedChange={(checked) => updateNotificationSettings({ soundEnabled: checked })}
                    disabled={permission !== 'granted'}
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Push notifications are not supported in this browser.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Profile</CardTitle>
              <CardDescription className="text-sm">Manage your personal information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={settings.displayName}
              onChange={(e) => updateSetting('displayName', e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => updateSetting('email', e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Password</Label>
            <Button variant="outline" className="w-full">
              <Lock className="mr-2 h-4 w-4" />
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Data & Privacy</CardTitle>
              <CardDescription className="text-sm">Control your data and backup settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Backup</Label>
              <p className="text-sm text-muted-foreground">
                Automatically backup your data
              </p>
            </div>
            <Switch
              checked={settings.autoBackup}
              onCheckedChange={(checked) => updateSetting('autoBackup', checked)}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Backup Frequency</Label>
              <p className="text-sm text-muted-foreground">
                How often to backup your data
              </p>
            </div>
            <Select
              value={settings.backupFrequency}
              onValueChange={(value) => updateSetting('backupFrequency', value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Export Data</Label>
            <p className="text-sm text-muted-foreground">
              Download all your data as a JSON backup file.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export Backup'}
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Import Data</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Restore your data from a JSON backup file. Existing data will be overwritten.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleImportClick}
              disabled={isImporting}
            >
              <Download className="mr-2 h-4 w-4 rotate-180" />
              {isImporting ? 'Importing...' : 'Import Backup'}
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Available Backups</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Restore from automatically created backups.
            </p>
            {availableBackups.length > 0 ? (
              <div className="space-y-2">
                {availableBackups.slice(0, 5).map((backup) => (
                  <div key={backup.date} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="text-sm font-medium">{new Date(backup.date).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {backup.data.checklist?.length || 0} checklist, {backup.data.routines?.length || 0} routines, {backup.data.projects?.length || 0} projects
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreFromBackup(backup.date)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No automatic backups available.</p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-destructive">Danger Zone</Label>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDeleteAllData}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <SiSpotify className="h-4 w-4 text-[#1DB954]" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Integrations</CardTitle>
              <CardDescription className="text-sm">Connect with other services</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Spotify</Label>
              <p className="text-sm text-muted-foreground">
                Connect your Spotify account to play music
              </p>
            </div>
            {session?.accessToken ? (
              <Button variant="outline" onClick={() => signOut()} className="text-red-500 hover:text-red-600">
                Disconnect
              </Button>
            ) : (
              <Button onClick={() => signIn('spotify')} className="bg-[#1DB954] hover:bg-[#1ed760] text-white">
                Connect Spotify
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* General */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">General</CardTitle>
              <CardDescription className="text-sm">Regional and format preferences</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Start of Week</Label>
              <p className="text-sm text-muted-foreground">
                First day of your week
              </p>
            </div>
            <Select
              value={settings.startOfWeek}
              onValueChange={(value) => updateSetting('startOfWeek', value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="saturday">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Date Format</Label>
              <p className="text-sm text-muted-foreground">
                How dates are displayed
              </p>
            </div>
            <Select
              value={settings.dateFormat}
              onValueChange={(value) => updateSetting('dateFormat', value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Time Format</Label>
              <p className="text-sm text-muted-foreground">
                12-hour or 24-hour clock
              </p>
            </div>
            <Select
              value={settings.timeFormat}
              onValueChange={(value) => updateSetting('timeFormat', value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Language</Label>
              <p className="text-sm text-muted-foreground">
                Interface language
              </p>
            </div>
            <Select
              value={settings.language}
              onValueChange={(value) => updateSetting('language', value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Models */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">AI Models</CardTitle>
              <CardDescription className="text-sm">Manage custom AI models for personalized responses</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          {/* Upload new model */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium">Upload Custom Model</h4>
              <p className="text-sm text-muted-foreground">
                Upload LoRA or base models to personalize your AI assistant
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="modelName">Model Name</Label>
                <Input
                  id="modelName"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="Enter model name"
                />
              </div>

              <div className="space-y-2">
                <Label>Model Type</Label>
                <Select value={newModelType} onValueChange={(value: 'lora' | 'base') => setNewModelType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base Model</SelectItem>
                    <SelectItem value="lora">LoRA Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newModelType === 'lora' && (
              <div className="space-y-2">
                <Label htmlFor="baseModel">Base Model</Label>
                <Input
                  id="baseModel"
                  value={newModelBase}
                  onChange={(e) => setNewModelBase(e.target.value)}
                  placeholder="e.g., microsoft/DialoGPT-medium"
                />
              </div>
            )}

            <input
              type="file"
              ref={modelFileInputRef}
              onChange={handleModelFileSelect}
              accept=".bin,.safetensors,.ckpt,.pth"
              className="hidden"
            />

            <Button
              variant="outline"
              className="w-full"
              onClick={handleModelUploadClick}
              disabled={!newModelName.trim() || isUploadingModel}
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploadingModel ? 'Uploading...' : 'Upload Model'}
            </Button>

            {isUploadingModel && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Upload Progress</span>
                  <span>{modelUploadProgress}%</span>
                </div>
                <Progress value={modelUploadProgress} />
              </div>
            )}
          </div>

          <Separator />

          {/* Model list */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium">Available Models</h4>
              <p className="text-sm text-muted-foreground">
                Select which model to use for AI responses
              </p>
            </div>

            <div className="space-y-2">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {model.isActive ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{model.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {model.type === 'lora' ? `LoRA (${model.baseModel})` : 'Base Model'} •
                        {(model.size / (1024 * 1024)).toFixed(1)} MB •
                        {new Date(model.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!model.isActive && model.id !== 'default' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActiveModel(model.id)}
                      >
                        Activate
                      </Button>
                    )}
                    {model.id !== 'default' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteModel(model.id, model.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Spotify Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <SiSpotify className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Spotify Integration</CardTitle>
              <CardDescription className="text-sm">Connect to Spotify to manage your music and playlists</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>Connect Spotify</Label>
              <p className="text-sm text-muted-foreground">
                Link your Spotify account to access your music library and control playback.
              </p>
            </div>
            {session?.provider === 'spotify' && session?.accessToken ? ( // Check if Spotify session exists
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => signOut({ callbackUrl: '/' })} // Sign out from all providers and redirect to home
              >
                <SiSpotify className="mr-2 h-4 w-4" />
                Disconnect Spotify
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => signIn('spotify')}
              >
                <SiSpotify className="mr-2 h-4 w-4" />
                Connect Spotify
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" className="w-full sm:w-auto">
          Save Changes
        </Button>
      </div>
    </div>
  )
}
