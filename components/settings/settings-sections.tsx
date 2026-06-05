'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { LiquidSwitch } from '@/components/ui/liquid-switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { Moon, Sun, Bell, Database, User, Lock, Globe, Download, Trash2, RefreshCw, History, Bot, Upload, CheckCircle, XCircle, Check, GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Music, ListChecks, CheckSquare, KanbanSquare, TrendingUp, Timer, Brain, ArrowUp, ArrowDown, Star, Plus } from 'lucide-react'
import { useSettings } from '@/lib/settings-context'
import { useNotifications } from '@/lib/notification-context'
import { DataIntegrator } from '@/lib/data-integrator'
import type { AIModel } from '@/types/ai'
import { useState, useRef, useEffect } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { FaGoogle, FaWindows, FaApple, FaGoogleDrive } from 'react-icons/fa'
import { SiNotion, SiApple } from 'react-icons/si'
import { useTranslation } from '@/lib/i18n'
import { aiModelManager } from '@/lib/ai-models'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'

export function SettingsSections() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { settings, updateSettings, resetSettings } = useSettings()
  const { isSupported, permission, requestPermission, settings: notificationSettings, updateSettings: updateNotificationSettings } = useNotifications()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [availableBackups, setAvailableBackups] = useState<{ date: string, data: any }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: session } = useSession() // New: useSession hook

  const { twin, updateTwin } = useCognitiveTwin()

  const handleToggleModule = (moduleId: string) => {
    const currentEnabled = twin.workspaceLayout?.enabledModules || []
    let nextEnabled: string[]
    if (currentEnabled.includes(moduleId)) {
      nextEnabled = currentEnabled.filter(id => id !== moduleId)
    } else {
      nextEnabled = [...currentEnabled, moduleId]
    }
    
    const updated = {
      ...twin,
      workspaceLayout: {
        ...(twin.workspaceLayout || {}),
        enabledModules: nextEnabled
      }
    }
    
    updateTwin(updated)
    
    // Sync with server
    fetch('/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {})
  }

  const handleReorderModule = (index: number, direction: 'up' | 'down') => {
    const currentEnabled = [...(twin.workspaceLayout?.enabledModules || [])]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= currentEnabled.length) return
    
    const temp = currentEnabled[index]
    currentEnabled[index] = currentEnabled[targetIndex]
    currentEnabled[targetIndex] = temp
    
    const updated = {
      ...twin,
      workspaceLayout: {
        ...(twin.workspaceLayout || {}),
        enabledModules: currentEnabled
      }
    }
    
    updateTwin(updated)
    
    fetch('/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {})
  }

  const handleTogglePinModule = (moduleId: string) => {
    const currentPinned = twin.workspaceLayout?.pinnedModules || []
    let nextPinned: string[]
    if (currentPinned.includes(moduleId)) {
      nextPinned = currentPinned.filter(id => id !== moduleId)
    } else {
      nextPinned = [...currentPinned, moduleId]
    }
    
    const updated = {
      ...twin,
      workspaceLayout: {
        ...(twin.workspaceLayout || {}),
        pinnedModules: nextPinned
      }
    }
    
    updateTwin(updated)
    
    fetch('/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {})
  }

  const handleRestoreTwinRecommendations = () => {
    const role = twin.identity?.role || 'professional'
    let recommended = ['today', 'ai', 'cognitive', 'focus']
    if (role === 'student') recommended.push('school', 'library', 'focus')
    else if (role === 'founder') recommended.push('business', 'projects', 'focus')
    else if (role === 'developer') recommended.push('projects', 'focus', 'library')
    else if (role === 'creator') recommended.push('business', 'music', 'spiritual')
    else recommended.push('business', 'routines', 'checklist')

    const nextEnabled = Array.from(new Set(recommended))
    
    const updated = {
      ...twin,
      workspaceLayout: {
        ...(twin.workspaceLayout || {}),
        enabledModules: nextEnabled
      }
    }
    
    updateTwin(updated)
    
    fetch('/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {})

    toast({
      title: 'Recommendations Applied',
      description: `Enabled recommended modules based on your role as ${role}.`,
    })
  }

  // AI Models state
  const [models, setModels] = useState<AIModel[]>([])
  const [isUploadingModel, setIsUploadingModel] = useState(false)
  const [modelUploadProgress, setModelUploadProgress] = useState(0)
  const modelFileInputRef = useRef<HTMLInputElement>(null)
  const [newModelName, setNewModelName] = useState('')
  const [newModelType, setNewModelType] = useState<'lora' | 'base'>('base')
  const [newModelBase, setNewModelBase] = useState('')

  // Background Image state
  const [isUploadingBg, setIsUploadingBg] = useState(false)
  const bgInputRef = useRef<HTMLInputElement>(null)

  const compressImage = (dataUrl: string, maxWidth = 2560, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (maxWidth / width) * height
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = dataUrl
    })
  }

  const handleBgUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Limit original file size to 10MB to avoid browser hang, but we will compress it
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 10MB.',
        variant: 'destructive',
      })
      return
    }

    setIsUploadingBg(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const result = e.target?.result as string
        const compressed = await compressImage(result)

        // Check if compressed result is still too large (e.g. > 2MB)
        if (compressed.length > 2 * 1024 * 1024) {
          // Try again with lower quality but keeping resolution high
          const optimized = await compressImage(result, 1920, 0.7)
          updateSetting('backgroundImage', optimized)
        } else {
          updateSetting('backgroundImage', compressed)
        }

        setIsUploadingBg(false)
        toast({
          title: 'Background updated',
          description: 'Your custom background has been applied (and optimized).',
        })
      } catch (error) {
        console.error('Compression failed:', error)
        setIsUploadingBg(false)
        toast({
          title: 'Upload failed',
          description: 'Failed to process the image.',
          variant: 'destructive',
        })
      }
    }
    reader.onerror = () => {
      setIsUploadingBg(false)
      toast({
        title: 'Upload failed',
        description: 'Failed to read the image file.',
        variant: 'destructive',
      })
    }
    reader.readAsDataURL(file)
  }

  // Load available backups on mount
  useEffect(() => {
    const backups = DataIntegrator.getAvailableBackups()
    setAvailableBackups(backups)
  }, [])

  // Load AI models on mount
  useEffect(() => {
    const loadedModels = aiModelManager.getModels()
    setModels(loadedModels)
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
      <Card className="glass-card border-white/5">
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
              <CardTitle className="text-lg md:text-xl">{t('settings.appearance.title')}</CardTitle>
              <CardDescription className="text-sm">{t('settings.appearance.desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.theme.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.theme.desc')}
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
              <Label>{t('settings.compact.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.compact.desc')}
              </p>
            </div>
            <LiquidSwitch
              checked={settings.compactMode}
              onCheckedChange={(checked) => updateSetting('compactMode', checked)}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.animations.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.animations.desc')}
              </p>
            </div>
            <LiquidSwitch
              checked={settings.showAnimations}
              onCheckedChange={(checked) => updateSetting('showAnimations', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Background Image</Label>
            <p className="text-sm text-muted-foreground">
              Upload a custom background image for the application.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={bgInputRef}
                onChange={handleBgUpload}
              />
              <Button
                variant="outline"
                onClick={() => bgInputRef.current?.click()}
                disabled={isUploadingBg}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploadingBg ? 'Uploading...' : 'Upload Image'}
              </Button>
              {settings.backgroundImage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateSetting('backgroundImage', '')}
                  title="Remove background"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            {/* Recent Wallpapers — Windows 10/11 style */}
            {settings.backgroundHistory && settings.backgroundHistory.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs text-muted-foreground">Recent backgrounds</Label>
                <div className="grid grid-cols-4 gap-2">
                  {settings.backgroundHistory.map((img, i) => (
                    <div
                      key={i}
                      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all aspect-video ${settings.backgroundImage === img
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-white/10 hover:border-white/30'
                        }`}
                      onClick={() => updateSetting('backgroundImage', img)}
                    >
                      <img
                        src={img}
                        alt={`Background ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Remove from history */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const updated = settings.backgroundHistory.filter((_, idx) => idx !== i)
                          updateSetting('backgroundHistory', updated)
                          // If removing the active background, clear it
                          if (settings.backgroundImage === img) {
                            updateSetting('backgroundImage', '')
                          }
                        }}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                        title="Remove from history"
                      >
                        ×
                      </button>
                      {/* Active indicator */}
                      {settings.backgroundImage === img && (
                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-white text-[8px]">✓</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>Background Dimness</Label>
                <p className="text-sm text-muted-foreground">
                  Adjust the darkness of the background ({settings.backgroundDimness}%)
                </p>
              </div>
              <div className="w-full sm:w-[200px] space-y-3">
                <Progress value={settings.backgroundDimness} className="h-1.5 bg-foreground/10" />
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={settings.backgroundDimness}
                  onChange={(e) => updateSetting('backgroundDimness', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>Background Blur</Label>
                <p className="text-sm text-muted-foreground">
                  Adjust the blur intensity of the background image ({settings.backgroundBlur}px)
                </p>
              </div>
              <div className="w-full sm:w-[200px] space-y-3">
                <Progress value={(settings.backgroundBlur / 50) * 100} className="h-1.5 bg-foreground/10" />
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={settings.backgroundBlur}
                  onChange={(e) => updateSetting('backgroundBlur', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>Auto Contrast</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically adjust background based on time of day
                </p>
              </div>
              <LiquidSwitch
                checked={settings.autoContrast}
                onCheckedChange={(checked) => updateSetting('autoContrast', checked)}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>Glass Opacity</Label>
                <p className="text-sm text-muted-foreground">
                  Adjust the transparency of glass panels ({settings.glassOpacity}%)
                </p>
              </div>
              <div className="w-full sm:w-[200px] space-y-3">
                <Progress value={settings.glassOpacity} className="h-1.5 bg-foreground/10" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.glassOpacity}
                  onChange={(e) => updateSetting('glassOpacity', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>Glass Blur</Label>
                <p className="text-sm text-muted-foreground">
                  Adjust the blur intensity of glass panels ({settings.glassBlur}px)
                </p>
              </div>
              <div className="w-full sm:w-[200px] space-y-3">
                <Progress value={(settings.glassBlur / 50) * 100} className="h-1.5 bg-foreground/10" />
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={settings.glassBlur}
                  onChange={(e) => updateSetting('glassBlur', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <Separator />

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to reset all appearance settings to default?')) {
                    resetSettings()
                    toast({
                      title: "Settings Reset",
                      description: "Appearance settings have been restored to defaults.",
                    })
                  }
                }}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-0.5">
                <Label>Accent Color</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred accent color
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { id: 'indigo', color: '#6366f1' },
                  { id: 'purple', color: '#a855f7' },
                  { id: 'violet', color: '#8b5cf6' },
                  { id: 'blue', color: '#3b82f6' },
                  { id: 'cyan', color: '#06b6d4' },
                  { id: 'green', color: '#22c55e' },
                  { id: 'orange', color: '#f97316' },
                  { id: 'red', color: '#ef4444' },
                  { id: 'pink', color: '#ec4899' },
                  { id: 'rose', color: '#f43f5e' },
                ].map((color) => (
                  <button
                    key={color.id}
                    onClick={() => updateSetting('accentColor', color.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${settings.accentColor === color.id
                      ? 'ring-2 ring-offset-2 ring-primary scale-110'
                      : 'hover:scale-110 opacity-70 hover:opacity-100'
                      }`}
                    style={{ backgroundColor: color.color }}
                    title={color.id.charAt(0).toUpperCase() + color.id.slice(1)}
                  >
                    {settings.accentColor === color.id && (
                      <Check className="w-4 h-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Modules Configuration */}
      <Card className="glass-card border-white/5">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg md:text-xl">Workspace Modules</CardTitle>
                <CardDescription className="text-sm">
                  Configure, enable, reorder, and pin favorite modules inside your Cognitive OS.
                </CardDescription>
              </div>
            </div>
            {twin.isInitialized && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestoreTwinRecommendations}
                className="text-xs border-primary/30 hover:bg-primary/10 gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                Restore AI Recommendations
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {twin.isInitialized && twin.identity?.role && (
            <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-violet-400">
                <Brain className="h-4 w-4" />
                <span>Twin Intelligence Analysis</span>
              </div>
              <p className="text-muted-foreground">
                Your Cognitive Twin has identified your focus role as <span className="text-foreground font-semibold capitalize">{twin.identity.role}</span>.
                The recommended workspace modules for this profile are:
                <span className="text-foreground font-semibold ml-1">
                  {twin.identity.role === 'student' ? 'School, Library, Focus, Today' :
                   twin.identity.role === 'founder' ? 'Business, Projects, Focus, Today' :
                   twin.identity.role === 'developer' ? 'Projects, Focus, Library, Today' :
                   twin.identity.role === 'creator' ? 'Business, Music, Spiritual, Today' :
                   'Business, Routines, Checklist, Today'}
                </span>.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60 text-xs">
              Active Workspace Modules ({(twin.workspaceLayout?.enabledModules || []).length})
            </h4>
            
            <div className="space-y-2">
              {(twin.workspaceLayout?.enabledModules || []).map((moduleId, index) => {
                const modInfo = [
                  { id: 'today', title: 'Daily Dashboard', icon: Sun, desc: 'Central workspace view.' },
                  { id: 'ai', title: 'AI Assistant', icon: Bot, desc: 'Interact with Gemini & Groq.' },
                  { id: 'cognitive', title: 'Cognitive Engine', icon: Brain, desc: 'View twin cognitive analytics.' },
                  { id: 'focus', title: 'Focus & Pomodoro', icon: Timer, desc: 'Deep work focus timers.' },
                  { id: 'school', title: 'School', icon: GraduationCap, desc: 'Track academic courses, semesters, and grades.' },
                  { id: 'business', title: 'Business', icon: Briefcase, desc: 'Manage clients, deals, and projects.' },
                  { id: 'library', title: 'Library', icon: BookOpen, desc: 'Track reading lists and page logs.' },
                  { id: 'spiritual', title: 'Spiritual', icon: Sparkles, desc: 'Record gratitude and affirmations.' },
                  { id: 'appearance', title: 'Appearance', icon: Heart, desc: 'Log fitness workouts and routines.' },
                  { id: 'music', title: 'Music Player', icon: Music, desc: 'Play ambient background music.' },
                  { id: 'routines', title: 'Routines', icon: ListChecks, desc: 'Habits and daily repeaters.' },
                  { id: 'checklist', title: 'Checklist', icon: CheckSquare, desc: 'Rapid tasks and checklists.' },
                  { id: 'projects', title: 'Projects', icon: KanbanSquare, desc: 'Goal-based project pipelines.' },
                  { id: 'trackers', title: 'Trackers', icon: TrendingUp, desc: 'Track numeric metrics and stats.' },
                ].find(m => m.id === moduleId) || { id: moduleId, title: moduleId, icon: Brain, desc: '' };

                const isPinned = (twin.workspaceLayout?.pinnedModules || []).includes(moduleId);
                const Icon = modInfo.icon;

                return (
                  <div
                    key={moduleId}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 p-0"
                          disabled={index === 0}
                          onClick={() => handleReorderModule(index, 'up')}
                        >
                          <ArrowUp className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 p-0"
                          disabled={index === (twin.workspaceLayout?.enabledModules || []).length - 1}
                          onClick={() => handleReorderModule(index, 'down')}
                        >
                          <ArrowDown className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>

                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{modInfo.title}</span>
                          {isPinned && (
                            <span className="text-[9px] font-black tracking-widest uppercase bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                              Pinned
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{modInfo.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Pin Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isPinned ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => handleTogglePinModule(moduleId)}
                        title={isPinned ? 'Unpin from dashboard' : 'Pin to dashboard'}
                      >
                        <Star className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
                      </Button>

                      {/* Enable/Disable Toggle */}
                      <Switch
                        checked={true}
                        onCheckedChange={() => handleToggleModule(moduleId)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60 text-xs">
              Available Modules
            </h4>
            
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: 'today', title: 'Daily Dashboard', icon: Sun, desc: 'Central workspace view.' },
                { id: 'ai', title: 'AI Assistant', icon: Bot, desc: 'Interact with Gemini & Groq.' },
                { id: 'cognitive', title: 'Cognitive Engine', icon: Brain, desc: 'View twin cognitive analytics.' },
                { id: 'focus', title: 'Focus & Pomodoro', icon: Timer, desc: 'Deep work focus timers.' },
                { id: 'school', title: 'School', icon: GraduationCap, desc: 'Track academic courses, semesters, and grades.' },
                { id: 'business', title: 'Business', icon: Briefcase, desc: 'Manage clients, deals, and projects.' },
                { id: 'library', title: 'Library', icon: BookOpen, desc: 'Track reading lists and page logs.' },
                { id: 'spiritual', title: 'Spiritual', icon: Sparkles, desc: 'Record gratitude and affirmations.' },
                { id: 'appearance', title: 'Appearance', icon: Heart, desc: 'Log fitness workouts and routines.' },
                { id: 'music', title: 'Music Player', icon: Music, desc: 'Play ambient background music.' },
                { id: 'routines', title: 'Routines', icon: ListChecks, desc: 'Habits and daily repeaters.' },
                { id: 'checklist', title: 'Checklist', icon: CheckSquare, desc: 'Rapid tasks and checklists.' },
                { id: 'projects', title: 'Projects', icon: KanbanSquare, desc: 'Goal-based project pipelines.' },
                { id: 'trackers', title: 'Trackers', icon: TrendingUp, desc: 'Track numeric metrics and stats.' },
              ]
                .filter(m => !(twin.workspaceLayout?.enabledModules || []).includes(m.id))
                .map((modInfo) => {
                  const Icon = modInfo.icon;
                  return (
                    <div
                      key={modInfo.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.005] hover:bg-white/[0.015] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/5 text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-medium text-sm text-muted-foreground">{modInfo.title}</span>
                          <p className="text-xs text-muted-foreground/60">{modInfo.desc}</p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-primary/20 text-muted-foreground hover:text-primary"
                        onClick={() => handleToggleModule(modInfo.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
            </div>
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
              <CardTitle className="text-lg md:text-xl">{t('settings.general.title')}</CardTitle>
              <CardDescription className="text-sm">{t('settings.general.desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.language.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.language.desc')}
              </p>
            </div>
            <Select
              value={settings.language || 'en'}
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

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">{t('settings.notifications.title')}</CardTitle>
              <CardDescription className="text-sm">{t('settings.notifications.desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.daily_reminder.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.daily_reminder.desc')}
              </p>
            </div>
            <LiquidSwitch
              checked={settings.dailyReminder}
              onCheckedChange={(checked) => updateSetting('dailyReminder', checked)}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.reminder_time.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.reminder_time.desc')}
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
              <Label>{t('settings.routine_notif.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.routine_notif.desc')}
              </p>
            </div>
            <LiquidSwitch
              checked={settings.routineNotifications}
              onCheckedChange={(checked) => updateSetting('routineNotifications', checked)}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.project_deadlines.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.project_deadlines.desc')}
              </p>
            </div>
            <LiquidSwitch
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
                  <LiquidSwitch
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
                  <LiquidSwitch
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
                  <LiquidSwitch
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
                  <LiquidSwitch
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
              <CardTitle className="text-lg md:text-xl">{t('settings.profile.title')}</CardTitle>
              <CardDescription className="text-sm">{t('settings.profile.desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('settings.display_name')}</Label>
            <Input
              id="displayName"
              value={settings.displayName}
              onChange={(e) => updateSetting('displayName', e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('settings.email')}</Label>
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
            <Label>{t('settings.password')}</Label>
            <Button variant="outline" className="w-full">
              <Lock className="mr-2 h-4 w-4" />
              {t('settings.change_password')}
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
              <CardTitle className="text-lg md:text-xl">{t('settings.data.title')}</CardTitle>
              <CardDescription className="text-sm">{t('settings.data.desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.auto_backup.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.auto_backup.desc')}
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
              <Label>{t('settings.backup_freq.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.backup_freq.desc')}
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
            <Label>{t('settings.export.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('settings.export.desc')}
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
            <Label>{t('settings.import.label')}</Label>
            <p className="text-sm text-muted-foreground mb-2">
              {t('settings.import.desc')}
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
            <Label className="text-destructive">{t('settings.danger.label')}</Label>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDeleteAllData}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('settings.delete_all')}
            </Button>
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
              <CardTitle className="text-lg md:text-xl">{t('settings.general.title')}</CardTitle>
              <CardDescription className="text-sm">{t('settings.general.desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.start_week.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.start_week.desc')}
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
              <Label>{t('settings.date_format.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.date_format.desc')}
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
              <Label>{t('settings.time_format.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.time_format.desc')}
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
              <Label>{t('settings.language.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.language.desc')}
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



      {/* Account Actions */}
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <Lock className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl text-destructive">Account Actions</CardTitle>
              <CardDescription className="text-sm">Manage your account session</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Sign Out from Novo
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" className="w-full sm:w-auto">
          Save Changes
        </Button>
      </div>
    </div >
  )
}
