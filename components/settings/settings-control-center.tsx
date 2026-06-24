'use client'

import { useState, useRef, useEffect } from 'react'
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
import {
  Brain, Download, RefreshCw, Trash2, Activity, Zap, Clock, AlertTriangle,
  LayoutDashboard, Bot, Timer, GraduationCap, Briefcase, BookOpen, Sparkles,
  Heart, Music, ListChecks, CheckSquare, KanbanSquare, TrendingUp, Sun, Moon,
  Shield, Settings, ChevronRight, RotateCcw, Database, Wifi, EyeOff, Upload,
  CheckCircle, XCircle, Check, Star, ArrowUp, ArrowDown, User, Lock, Globe, Bell, Plus, Link2
} from 'lucide-react'
import { useSettings } from '@/lib/settings-context'
import { useSession, signOut, signIn } from 'next-auth/react'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { DataIntegrator } from '@/lib/data-integrator'
import { ConfidenceGauge, TrustBadge, OrbPrimitive, TelemetryPill } from '@/components/cognitive/primitives'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/lib/notification-context'
import { aiModelManager } from '@/lib/ai-models'
import type { AIModel } from '@/types/ai'
import { useTranslation } from '@/lib/i18n'

// ─── Disabled module metadata ────────────────────────────────────────────────
interface DisabledModule {
  id: string
  title: string
  icon: React.ElementType
  reason: string
  confidence: number
  timestamp: string
}

// ─── All available modules ───────────────────────────────────────────────────
const ALL_MODULES = [
  { id: 'today',     title: 'Daily Dashboard',  icon: Sun,          desc: 'Central workspace view.' },
  { id: 'ai',        title: 'AI Assistant',      icon: Bot,          desc: 'Interact with your cognitive AI.' },
  { id: 'cognitive', title: 'Cognitive Engine',  icon: Brain,        desc: 'View twin cognitive analytics.' },
  { id: 'focus',     title: 'Focus & Pomodoro',  icon: Timer,        desc: 'Deep work focus timers.' },
  { id: 'school',    title: 'School',            icon: GraduationCap,desc: 'Track academic courses and grades.' },
  { id: 'business',  title: 'Business',          icon: Briefcase,    desc: 'Manage clients, deals, and projects.' },
  { id: 'library',   title: 'Library',           icon: BookOpen,     desc: 'Track reading lists and page logs.' },
  { id: 'spiritual', title: 'Spiritual',         icon: Sparkles,     desc: 'Record gratitude and affirmations.' },
  { id: 'appearance',title: 'Fitness',           icon: Heart,        desc: 'Log fitness workouts and routines.' },
  { id: 'music',     title: 'Music Player',      icon: Music,        desc: 'Play ambient background music.' },
  { id: 'routines',  title: 'Routines',          icon: ListChecks,   desc: 'Habits and daily repeaters.' },
  { id: 'checklist', title: 'Checklist',         icon: CheckSquare,  desc: 'Rapid tasks and checklists.' },
  { id: 'projects',  title: 'Projects',          icon: KanbanSquare, desc: 'Goal-based project pipelines.' },
  { id: 'trackers',  title: 'Trackers',          icon: TrendingUp,   desc: 'Track numeric metrics and stats.' },
]

type Tab = 'twin' | 'personalization' | 'modules' | 'preferences' | 'ai_models' | 'advanced' | 'integrations'

// ─── Sub-section wrapper ──────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30">{title}</p>
      {children}
    </div>
  )
}

// ─── Row wrapper ──────────────────────────────────────────────────────────────
function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.04] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/85">{label}</p>
        {description && <p className="text-xs text-white/35 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// ─── Danger Action button ─────────────────────────────────────────────────────
function DangerAction({ icon: Icon, label, description, onClick, loading }: {
  icon: React.ElementType; label: string; description: string; onClick: () => void; loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border border-red-500/15 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/25 transition-all duration-300 text-left group"
    >
      <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors">
        <Icon className="w-4 h-4 text-red-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-300">{loading ? 'Processing…' : label}</p>
        <p className="text-xs text-white/35 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-red-400 transition-colors" />
    </button>
  )
}

// ─── Safe Action button ───────────────────────────────────────────────────────
function SafeAction({ icon: Icon, label, description, onClick, loading }: {
  icon: React.ElementType; label: string; description: string; onClick: () => void; loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 text-left group"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white/80">{loading ? 'Processing…' : label}</p>
        <p className="text-xs text-white/35 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
    </button>
  )
}

// ─── Adaptation option button ─────────────────────────────────────────────────
function OptionButton({ label, description, selected, onClick }: {
  label: string; description: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex flex-col items-start gap-1 p-3.5 rounded-2xl border transition-all duration-300 text-left',
        selected
          ? 'bg-primary/10 border-primary/30 shadow-[0_0_20px_rgba(99,102,241,0.08)]'
          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10',
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full transition-colors', selected ? 'bg-primary' : 'bg-white/20')} />
        <span className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-white/70')}>{label}</span>
      </div>
      <p className="text-[11px] text-white/35 pl-4">{description}</p>
    </button>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function SettingsControlCenter() {
  const [activeTab, setActiveTab] = useState<Tab>('twin')
  
  // Settings contexts & translation
  const { t } = useTranslation()
  const { toast } = useToast()
  const { settings, updateSettings, resetSettings } = useSettings()
  const { isSupported, permission, requestPermission, settings: notificationSettings, updateSettings: updateNotificationSettings } = useNotifications()
  const { data: session } = useSession()
  const { twin, updateTwin, resetTwin } = useCognitiveTwin()

  // Background states
  const [isUploadingBg, setIsUploadingBg] = useState(false)
  const bgInputRef = useRef<HTMLInputElement>(null)

  // Module sorting/pinning actions
  const enabledModules = twin.workspaceLayout?.enabledModules || []

  const handleToggleModule = (moduleId: string) => {
    const next = enabledModules.includes(moduleId)
      ? enabledModules.filter(id => id !== moduleId)
      : [...enabledModules, moduleId]
    const updated = {
      ...twin,
      workspaceLayout: {
        ...(twin.workspaceLayout || {}),
        enabledModules: next
      }
    }
    updateTwin(updated)
    fetch('/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(() => {})
  }

  const handleReorderModule = (index: number, direction: 'up' | 'down') => {
    const currentEnabled = [...enabledModules]
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
      body: JSON.stringify(updated)
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
      body: JSON.stringify(updated)
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
      body: JSON.stringify(updated)
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

  // Backups / Data Integration
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [availableBackups, setAvailableBackups] = useState<{ date: string, data: any }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Twin behavior state overrides
  const [adaptationMode, setAdaptationMode] = useState<'aggressive' | 'balanced' | 'minimal'>('balanced')
  const [schedulingMode, setSchedulingMode] = useState<'adaptive' | 'fixed' | 'manual'>('adaptive')
  const [simplifyAuto, setSimplifyAuto] = useState(false)
  const [recommendHidden, setRecommendHidden] = useState(true)
  const [autoPrioritize, setAutoPrioritize] = useState(true)

  // ── Notion integration state ────────────────────────────────────────────────
  const [notionStatus, setNotionStatus] = useState<{
    connected: boolean
    workspaceName?: string | null
    databaseIds?: string[]
    connectedAt?: string
  } | null>(null)
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionSyncing, setNotionSyncing] = useState(false)
  const [notionDbs, setNotionDbs] = useState<{ id: string; title: string }[]>([])
  const [notionDbsOpen, setNotionDbsOpen] = useState(false)

  // ── Google Drive state ──────────────────────────────────────────────────────
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; hasScope: boolean } | null>(null)
  const [driveBackingUp, setDriveBackingUp] = useState(false)

  // Load available backups and AI models on mount
  useEffect(() => {
    const backups = DataIntegrator.getAvailableBackups()
    setAvailableBackups(backups)
    
    const loadedModels = aiModelManager.getModels()
    setModels(loadedModels)
  }, [])

  // Handle ?notionStatus= query param from OAuth callback redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ns = params.get('notionStatus')
    if (ns === 'connected') {
      toast({ title: '✅ Notion connected', description: 'Your workspace is now linked to Novo.' })
      // Clean the URL
      const url = new URL(window.location.href)
      url.searchParams.delete('notionStatus')
      window.history.replaceState({}, '', url.toString())
    } else if (ns === 'error') {
      const reason = params.get('reason') ?? 'unknown'
      toast({ title: '❌ Notion connection failed', description: `Reason: ${reason}`, variant: 'destructive' })
      const url = new URL(window.location.href)
      url.searchParams.delete('notionStatus')
      url.searchParams.delete('reason')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Fetch Notion + Drive status when the integrations tab is active
  useEffect(() => {
    if (activeTab !== 'integrations' || !session?.user?.id) return

    // Notion
    fetch('/api/integration/notion')
      .then(r => r.json())
      .then(data => setNotionStatus(data))
      .catch(() => setNotionStatus({ connected: false }))

    // Drive
    fetch('/api/integration/drive')
      .then(r => r.json())
      .then(data => setDriveStatus(data))
      .catch(() => setDriveStatus({ connected: false, hasScope: false }))
  }, [activeTab, session?.user?.id])

  // ── Notion helpers ──────────────────────────────────────────────────────────
  const handleNotionConnect = () => {
    window.location.href = '/api/integration/notion/connect'
  }

  const handleNotionDisconnect = async () => {
    setNotionLoading(true)
    try {
      await fetch('/api/integration/notion', { method: 'DELETE' })
      setNotionStatus({ connected: false })
      toast({ title: 'Notion disconnected' })
    } catch {
      toast({ title: 'Failed to disconnect', variant: 'destructive' })
    } finally {
      setNotionLoading(false)
    }
  }

  const handleNotionSync = async () => {
    setNotionSyncing(true)
    try {
      const res = await fetch('/api/integration/notion?action=sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      toast({ title: `✅ Synced ${data.total} tasks from Notion`, description: `${data.created} created, ${data.updated} updated` })
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' })
    } finally {
      setNotionSyncing(false)
    }
  }

  const handleFetchNotionDbs = async () => {
    if (notionDbsOpen) { setNotionDbsOpen(false); return }
    try {
      const res = await fetch('/api/integration/notion?action=databases', { method: 'POST' })
      const data = await res.json()
      setNotionDbs(data.databases || [])
      setNotionDbsOpen(true)
    } catch {
      toast({ title: 'Could not fetch databases', variant: 'destructive' })
    }
  }

  const handleSaveNotionDbs = async (ids: string[]) => {
    await fetch('/api/integration/notion?action=save_databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseIds: ids }),
    })
    setNotionStatus(prev => prev ? { ...prev, databaseIds: ids } : prev)
    toast({ title: 'Databases saved' })
  }

  // ── Drive helpers ───────────────────────────────────────────────────────────
  const handleDriveBackup = async () => {
    setDriveBackingUp(true)
    try {
      const localSettings = settings
      const res = await fetch('/api/integration/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: localSettings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Backup failed')
      toast({
        title: '✅ Backup saved to Drive',
        description: data.fileName,
      })
    } catch (err: any) {
      toast({ title: 'Drive backup failed', description: err.message, variant: 'destructive' })
    } finally {
      setDriveBackingUp(false)
    }
  }

  // Handle auto-backup toggle
  useEffect(() => {
    if (settings.autoBackup && session?.user?.id) {
      DataIntegrator.scheduleAutoBackup(session.user.id, settings.backupFrequency)
    } else {
      const existingTimer = localStorage.getItem('novo-auto-backup-timer')
      if (existingTimer) {
        clearInterval(parseInt(existingTimer))
        localStorage.removeItem('novo-auto-backup-timer')
      }
    }
  }, [settings.autoBackup, settings.backupFrequency, session?.user?.id])

  // Image compressor
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

        if (compressed.length > 2 * 1024 * 1024) {
          const optimized = await compressImage(result, 1920, 0.7)
          updateSettings({ backgroundImage: optimized })
        } else {
          updateSettings({ backgroundImage: compressed })
        }

        setIsUploadingBg(false)
        toast({
          title: 'Background updated',
          description: 'Your custom background has been applied.',
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

  // AI Model functions
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
        variant: 'destructive',
      })
    }
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
        description: 'Push notifications are disabled. Please check your browser settings.',
        variant: 'destructive',
      })
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

  const handleEnableAnyway = (moduleId: string) => {
    handleToggleModule(moduleId)
    toast({
      title: 'Module enabled',
      description: 'You have overridden the Cognitive Twin recommendation.'
    })
  }

  // Derive disabled-by-twin modules
  const roleReasonMap: Record<string, string> = {
    student: 'Academic Focus is currently prioritized.',
    founder: 'Founder workflow is currently active.',
    developer: 'Developer productivity mode is active.',
    creator: 'Creative flow mode is active.',
    professional: 'Professional efficiency mode is active.',
  }
  const role = twin.identity?.role || ''
  const twinReason = roleReasonMap[role] || 'Your current cognitive profile prioritizes focus modules.'

  const twinDisabledModules: DisabledModule[] = ALL_MODULES
    .filter(m => !enabledModules.includes(m.id))
    .map(m => ({
      id: m.id,
      title: m.title,
      icon: m.icon,
      reason: `Hidden because ${twinReason}`,
      confidence: twin.confidenceScore,
      timestamp: twin.updatedAt,
    }))

  // Chronotype / focus labels
  const chronoLabel: Record<string, string> = { morning_lark: 'Morning Lark', night_owl: 'Night Owl', afternoon_peak: 'Afternoon Peak', '': 'Not detected' }
  const focusLabel: Record<string, string> = { deep_builder: 'Deep Builder', reactive_communicator: 'Reactive Communicator', frantic_juggler: 'Frantic Juggler', consistent_planner: 'Consistent Planner', '': 'Not detected' }
  const frictionLabel: Record<string, string> = { context_switching: 'Context Switching', procrastination: 'Procrastination', overcommitment: 'Overcommitment', lack_of_structure: 'Lack of Structure', '': 'Not detected' }

  // 7 tabs definition
  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'twin', label: 'Cognitive Twin', icon: Brain },
    { id: 'personalization', label: 'Personalization', icon: Sparkles },
    { id: 'modules', label: 'Modules', icon: LayoutDashboard },
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'ai_models', label: 'AI Models', icon: Bot },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'advanced', label: 'Advanced', icon: Shield },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto custom-scrollbar overflow-y-auto max-h-[85vh] pr-1">
      {/* Premium Navigation Hub */}
      <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-white/[0.02] border border-white/[0.05] sticky top-0 backdrop-blur-xl z-20">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-primary/15 text-primary border border-primary/25 shadow-[0_2px_12px_rgba(var(--primary-rgb),0.12)]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]',
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ─── Tab 1: Cognitive Twin ────────────────────────────────────────── */}
      {activeTab === 'twin' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.015] p-6 flex flex-col sm:flex-row items-center gap-6">
            <OrbPrimitive size="lg" variant={twin.isInitialized ? 'active' : 'dormant'} />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 mb-1">Cognitive Twin</p>
              <h2 className="text-xl font-bold text-white/90 mb-2">
                {twin.isInitialized ? `${role.charAt(0).toUpperCase() + role.slice(1)} Profile` : 'Not Initialized'}
              </h2>
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <TrustBadge level={twin.trustLevel} />
                <span className="text-xs text-white/30">Updated {new Date(twin.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <ConfidenceGauge score={twin.confidenceScore} size="md" />
          </div>

          <Section title="System Telemetry">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TelemetryPill
                label="Cognitive Load"
                value={twin.metrics.currentCognitiveLoad}
                unit="%"
                status={twin.metrics.currentCognitiveLoad > 75 ? 'warning' : twin.metrics.currentCognitiveLoad > 90 ? 'critical' : 'normal'}
                icon={Activity}
              />
              <TelemetryPill
                label="Burnout Risk"
                value={twin.metrics.burnoutIndex}
                unit="%"
                status={twin.metrics.burnoutIndex > 70 ? 'critical' : twin.metrics.burnoutIndex > 50 ? 'warning' : 'good'}
                icon={AlertTriangle}
              />
              <TelemetryPill
                label="Chronotype"
                value={chronoLabel[twin.energyCurve.chronotype] || 'Not detected'}
                icon={Clock}
                status="normal"
              />
              <TelemetryPill
                label="Focus Style"
                value={focusLabel[twin.identity.focusStyle] || 'Not detected'}
                icon={Zap}
                status="normal"
              />
              <TelemetryPill
                label="Main Friction"
                value={frictionLabel[twin.bottlenecks.mainFrictionPoint] || 'Not detected'}
                icon={AlertTriangle}
                status={twin.bottlenecks.mainFrictionPoint ? 'warning' : 'normal'}
              />
              <TelemetryPill
                label="Decision Fatigue"
                value={twin.metrics.decisionFatigueRisk}
                icon={Brain}
                status={twin.metrics.decisionFatigueRisk === 'critical' ? 'critical' : twin.metrics.decisionFatigueRisk === 'high' ? 'warning' : 'normal'}
              />
            </div>
          </Section>

          <Section title="Adaptation Level">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <OptionButton label="Aggressive" description="Twin adapts rapidly to any detected change in your patterns." selected={adaptationMode === 'aggressive'} onClick={() => setAdaptationMode('aggressive')} />
              <OptionButton label="Balanced" description="Gradual adaptation with confirmation before major changes." selected={adaptationMode === 'balanced'} onClick={() => setAdaptationMode('balanced')} />
              <OptionButton label="Minimal" description="Twin observes only. You control all workspace changes." selected={adaptationMode === 'minimal'} onClick={() => setAdaptationMode('minimal')} />
            </div>
          </Section>

          <Section title="Scheduling Strategy">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <OptionButton label="Adaptive Scheduling" description="Twin rearranges your schedule based on energy and load." selected={schedulingMode === 'adaptive'} onClick={() => setSchedulingMode('adaptive')} />
              <OptionButton label="Fixed Time Blocks" description="Hard blocks that cannot be moved automatically." selected={schedulingMode === 'fixed'} onClick={() => setSchedulingMode('fixed')} />
              <OptionButton label="Manual Planning" description="You plan everything. Twin provides suggestions only." selected={schedulingMode === 'manual'} onClick={() => setSchedulingMode('manual')} />
            </div>
          </Section>

          <Section title="Workspace Behavior">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
              <div className="p-4">
                <Row label="Simplify Interface Automatically" description="Twin hides advanced features during high cognitive load.">
                  <LiquidSwitch checked={simplifyAuto} onCheckedChange={setSimplifyAuto} />
                </Row>
              </div>
              <div className="p-4">
                <Row label="Recommend Hidden Modules" description="Twin surfaces relevant disabled modules as context shifts.">
                  <LiquidSwitch checked={recommendHidden} onCheckedChange={setRecommendHidden} />
                </Row>
              </div>
              <div className="p-4">
                <Row label="Auto Prioritize Tasks" description="Twin reorders your task list based on deadlines and energy.">
                  <LiquidSwitch checked={autoPrioritize} onCheckedChange={setAutoPrioritize} />
                </Row>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ─── Tab 2: Personalization ────────────────────────────────────────── */}
      {activeTab === 'personalization' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Theme & Toggles */}
          <Section title="Theme Preferences">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
              <Row label={t('settings.theme.label')} description={t('settings.theme.desc')}>
                <Select value={settings.theme} onValueChange={(value: any) => updateSettings({ theme: value })}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="auto">Auto Switcher</SelectItem>
                  </SelectContent>
                </Select>
              </Row>

              {settings.theme === 'auto' && (
                <Row label="Auto Theme Mode" description="Trigger criteria for automatic theme transition.">
                  <Select value={settings.autoThemeMode} onValueChange={(value: any) => updateSettings({ autoThemeMode: value })}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System Preference</SelectItem>
                      <SelectItem value="time">Time of Day</SelectItem>
                      <SelectItem value="both">System + Time</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
              )}

              <Separator className="bg-white/[0.05]" />

              <Row label={t('settings.compact.label')} description={t('settings.compact.desc')}>
                <LiquidSwitch checked={settings.compactMode} onCheckedChange={(checked) => updateSettings({ compactMode: checked })} />
              </Row>

              <Separator className="bg-white/[0.05]" />

              <Row label={t('settings.animations.label')} description={t('settings.animations.desc')}>
                <LiquidSwitch checked={settings.showAnimations} onCheckedChange={(checked) => updateSettings({ showAnimations: checked })} />
              </Row>
            </div>
          </Section>

          {/* Accent Color picker */}
          <Section title="Accent Color Picker">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-2">
              <p className="text-xs text-white/40 mb-3">Select your system-wide interactive highlight color.</p>
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
                    onClick={() => updateSettings({ accentColor: color.id })}
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 relative',
                      settings.accentColor === color.id
                        ? 'ring-2 ring-offset-2 ring-primary scale-110'
                        : 'opacity-60 hover:opacity-100 hover:scale-105'
                    )}
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
          </Section>

          {/* Background Wallpapers */}
          <Section title="Workspace Background Wallpaper">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
              <div className="flex items-center gap-3">
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
                  className="border-white/10 hover:bg-white/5"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploadingBg ? 'Optimizing...' : 'Upload Image'}
                </Button>
                {settings.backgroundImage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => updateSettings({ backgroundImage: '' })}
                    title="Remove background"
                  >
                    <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                  </Button>
                )}
              </div>

              {settings.backgroundHistory && settings.backgroundHistory.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-white/40">Recent wallpapers</p>
                  <div className="grid grid-cols-4 gap-2">
                    {settings.backgroundHistory.map((img, i) => (
                      <div
                        key={i}
                        className={cn(
                          'relative group cursor-pointer rounded-lg overflow-hidden border transition-all aspect-video',
                          settings.backgroundImage === img
                            ? 'border-primary ring-2 ring-primary/20 scale-[1.02]'
                            : 'border-white/10 hover:border-white/30'
                        )}
                        onClick={() => updateSettings({ backgroundImage: img })}
                      >
                        <img src={img} alt={`Background ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const updated = settings.backgroundHistory.filter((_, idx) => idx !== i)
                            updateSettings({ backgroundHistory: updated })
                            if (settings.backgroundImage === img) {
                              updateSettings({ backgroundImage: '' })
                            }
                          }}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          title="Remove from history"
                        >
                          ×
                        </button>
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
          </Section>

          {/* Crystalline Material Sliders */}
          <Section title="Crystalline Material controls">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-6">
              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Background Dimness */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Background Dimness</Label>
                    <span className="text-xs text-white/40">{settings.backgroundDimness}%</span>
                  </div>
                  <Progress value={settings.backgroundDimness} className="h-1.5 bg-white/5" />
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={settings.backgroundDimness}
                    onChange={(e) => updateSettings({ backgroundDimness: parseInt(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-transparent"
                  />
                </div>

                {/* Background Blur */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Background Blur</Label>
                    <span className="text-xs text-white/40">{settings.backgroundBlur}px</span>
                  </div>
                  <Progress value={(settings.backgroundBlur / 50) * 100} className="h-1.5 bg-white/5" />
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={settings.backgroundBlur}
                    onChange={(e) => updateSettings({ backgroundBlur: parseInt(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-transparent"
                  />
                </div>

                {/* Sidebar Glass Opacity */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Sidebar Opacity</Label>
                    <span className="text-xs text-white/40">{settings.glassOpacity}%</span>
                  </div>
                  <Progress value={settings.glassOpacity} className="h-1.5 bg-white/5" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={settings.glassOpacity}
                    onChange={(e) => updateSettings({ glassOpacity: parseInt(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-transparent"
                  />
                </div>

                {/* Sidebar Glass Blur */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Sidebar Glass Blur</Label>
                    <span className="text-xs text-white/40">{settings.glassBlur}px</span>
                  </div>
                  <Progress value={(settings.glassBlur / 50) * 100} className="h-1.5 bg-white/5" />
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={settings.glassBlur}
                    onChange={(e) => updateSettings({ glassBlur: parseInt(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-transparent"
                  />
                </div>

                {/* Card Liquid Glass Opacity */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Dashboard Card Glass Opacity</Label>
                    <span className="text-xs text-white/40">{settings.cardOpacity}%</span>
                  </div>
                  <Progress value={settings.cardOpacity} className="h-1.5 bg-white/5" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={settings.cardOpacity}
                    onChange={(e) => updateSettings({ cardOpacity: parseInt(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-transparent"
                  />
                </div>

                {/* Card Liquid Glass Intensity */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Dashboard Card Refraction Blur</Label>
                    <span className="text-xs text-white/40">{settings.cardLiquidIntensity}px</span>
                  </div>
                  <Progress value={(settings.cardLiquidIntensity / 50) * 100} className="h-1.5 bg-white/5" />
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={settings.cardLiquidIntensity}
                    onChange={(e) => updateSettings({ cardLiquidIntensity: parseInt(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-transparent"
                  />
                </div>
              </div>

              <Separator className="bg-white/[0.05]" />

              <Row label="Auto Contrast" description="Automatically adjust wallpaper contrast depending on time of day">
                <LiquidSwitch checked={settings.autoContrast} onCheckedChange={(checked) => updateSettings({ autoContrast: checked })} />
              </Row>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm('Are you sure you want to reset appearance settings?')) {
                      resetSettings()
                      toast({
                        title: 'Settings Reset',
                        description: 'Appearance settings have been restored to defaults.',
                      })
                    }
                  }}
                  className="text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/5 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Reset Appearance Defaults
                </Button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ─── Tab 3: Modules ────────────────────────────────────────────────── */}
      {activeTab === 'modules' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {twin.isInitialized && twin.identity?.role && (
            <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-violet-400">
                <Brain className="h-4 w-4" />
                <span>Twin Intelligence Analysis</span>
              </div>
              <p className="text-muted-foreground">
                Your Cognitive Twin has identified your focus profile as <span className="text-foreground font-semibold capitalize">{twin.identity.role}</span>.
                Recommended modules for this profile:
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

          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60 text-xs">
              Active Workspace Modules ({enabledModules.length})
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestoreTwinRecommendations}
              className="text-xs border-primary/30 hover:bg-primary/10 gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Restore Recommendations
            </Button>
          </div>

          <div className="space-y-2">
            {enabledModules.map((moduleId, index) => {
              const modInfo = ALL_MODULES.find(m => m.id === moduleId) || { id: moduleId, title: moduleId, icon: Brain, desc: '' }
              const isPinned = (twin.workspaceLayout?.pinnedModules || []).includes(moduleId)
              const Icon = modInfo.icon

              return (
                <div
                  key={moduleId}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
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
                        disabled={index === enabledModules.length - 1}
                        onClick={() => handleReorderModule(index, 'down')}
                      >
                        <ArrowDown className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>

                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white/95">{modInfo.title}</span>
                        {isPinned && (
                          <span className="text-[9px] font-black tracking-widest uppercase bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                            Pinned
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/35">{modInfo.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-8 w-8', isPinned ? 'text-yellow-500 hover:text-yellow-600' : 'text-white/40 hover:text-white')}
                      onClick={() => handleTogglePinModule(moduleId)}
                      title={isPinned ? 'Unpin module' : 'Pin module'}
                    >
                      <Star className={cn('h-4 w-4', isPinned && 'fill-current')} />
                    </Button>
                    <LiquidSwitch checked={true} onCheckedChange={() => handleToggleModule(moduleId)} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Available Modules */}
          <Section title="Available Modules">
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_MODULES
                .filter(m => !enabledModules.includes(m.id))
                .map(modInfo => {
                  const Icon = modInfo.icon
                  return (
                    <div
                      key={modInfo.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-white/[0.005] hover:bg-white/[0.015] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/5 text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-white/50">{modInfo.title}</span>
                          <p className="text-xs text-white/30">{modInfo.desc}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-primary/20 text-white/40 hover:text-primary"
                        onClick={() => handleToggleModule(modInfo.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
            </div>
          </Section>

          {/* Disabled by Twin Recommendation overrides */}
          {twinDisabledModules.length > 0 && (
            <Section title="Disabled by Cognitive Twin Recommendations">
              <div className="space-y-2">
                {twinDisabledModules.map(mod => {
                  const Icon = mod.icon
                  return (
                    <div key={mod.id} className="p-4 rounded-2xl border border-amber-500/10 bg-amber-500/[0.03]">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-white/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-white/50">{mod.title}</p>
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/15">
                              <EyeOff className="w-2.5 h-2.5 text-amber-400" />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Twin Hidden</span>
                            </div>
                          </div>
                          <p className="text-xs text-white/30 mb-1">{mod.reason}</p>
                          <div className="flex items-center gap-3 text-[10px] text-white/25">
                            <span>Confidence: {mod.confidence}%</span>
                            <span>·</span>
                            <span>Since {new Date(mod.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEnableAnyway(mod.id)}
                          className="text-xs border-white/10 hover:border-primary/30 hover:bg-primary/10 hover:text-primary flex-shrink-0"
                        >
                          Enable Anyway
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ─── Tab 4: Preferences ────────────────────────────────────────────── */}
      {activeTab === 'preferences' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* User Profile */}
          <Section title={t('settings.profile.title')}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">{t('settings.display_name')}</Label>
                <Input
                  id="displayName"
                  value={settings.displayName}
                  onChange={(e) => updateSettings({ displayName: e.target.value })}
                  placeholder="Enter name"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('settings.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => updateSettings({ email: e.target.value })}
                  placeholder="Enter email"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <Separator className="bg-white/[0.05]" />

              <div className="space-y-2">
                <Label>{t('settings.password')}</Label>
                <Button variant="outline" className="w-full border-white/10 hover:bg-white/5">
                  <Lock className="mr-2 h-4 w-4" />
                  {t('settings.change_password')}
                </Button>
              </div>
            </div>
          </Section>

          {/* Regional Formats */}
          <Section title={t('settings.general.title')}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
              <Row label={t('settings.language.label')} description={t('settings.language.desc')}>
                <Select value={settings.language} onValueChange={(value: any) => updateSettings({ language: value })}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </Row>

              <Separator className="bg-white/[0.05]" />

              <Row label={t('settings.start_week.label')} description={t('settings.start_week.desc')}>
                <Select value={settings.startOfWeek} onValueChange={(value: any) => updateSettings({ startOfWeek: value })}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </Row>

              <Separator className="bg-white/[0.05]" />

              <Row label={t('settings.date_format.label')} description={t('settings.date_format.desc')}>
                <Select value={settings.dateFormat} onValueChange={(value: any) => updateSettings({ dateFormat: value })}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </Row>

              <Separator className="bg-white/[0.05]" />

              <Row label={t('settings.time_format.label')} description={t('settings.time_format.desc')}>
                <Select value={settings.timeFormat} onValueChange={(value: any) => updateSettings({ timeFormat: value })}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour</SelectItem>
                    <SelectItem value="24h">24-hour</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </div>
          </Section>

          {/* Desktop Push Notifications */}
          <Section title={t('settings.notifications.title')}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
              <Row label={t('settings.daily_reminder.label')} description={t('settings.daily_reminder.desc')}>
                <LiquidSwitch checked={settings.dailyReminder} onCheckedChange={(checked) => updateSettings({ dailyReminder: checked })} />
              </Row>

              <Row label={t('settings.reminder_time.label')} description={t('settings.reminder_time.desc')}>
                <Input
                  type="time"
                  value={settings.reminderTime}
                  onChange={(e) => updateSettings({ reminderTime: e.target.value })}
                  className="w-[180px] bg-white/5 border-white/10"
                />
              </Row>

              <Separator className="bg-white/[0.05]" />

              <Row label={t('settings.routine_notif.label')} description={t('settings.routine_notif.desc')}>
                <LiquidSwitch checked={settings.routineNotifications} onCheckedChange={(checked) => updateSettings({ routineNotifications: checked })} />
              </Row>

              <Row label={t('settings.project_deadlines.label')} description={t('settings.project_deadlines.desc')}>
                <LiquidSwitch checked={settings.projectDeadlines} onCheckedChange={(checked) => updateSettings({ projectDeadlines: checked })} />
              </Row>

              <Separator className="bg-white/[0.05]" />

              {isSupported ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white/85">Push Notifications Status</p>
                      <p className="text-xs text-white/35">
                        Status: <span className="capitalize">{permission}</span>
                      </p>
                    </div>
                    {permission !== 'granted' && (
                      <Button variant="outline" size="sm" onClick={handleRequestPermission} className="border-white/10 hover:bg-white/5">
                        Enable Notifications
                      </Button>
                    )}
                  </div>

                  <Separator className="bg-white/[0.05]" />

                  <Row label="Habit Reminders" description="Push updates to log daily habit progress.">
                    <LiquidSwitch
                      checked={notificationSettings.habitReminders}
                      onCheckedChange={(checked) => updateNotificationSettings({ habitReminders: checked })}
                      disabled={permission !== 'granted'}
                    />
                  </Row>

                  <Row label="Task Notifications" description="Updates when tasks are priority reordered.">
                    <LiquidSwitch
                      checked={notificationSettings.taskNotifications}
                      onCheckedChange={(checked) => updateNotificationSettings({ taskNotifications: checked })}
                      disabled={permission !== 'granted'}
                    />
                  </Row>

                  <Row label="Celebrate Milestones" description="Receive congratulations for completed focus blocks.">
                    <LiquidSwitch
                      checked={notificationSettings.progressAchievements}
                      onCheckedChange={(checked) => updateNotificationSettings({ progressAchievements: checked })}
                      disabled={permission !== 'granted'}
                    />
                  </Row>

                  <Row label="Sound Effects" description="Play micro-tones with desktop notifications.">
                    <LiquidSwitch
                      checked={notificationSettings.soundEnabled}
                      onCheckedChange={(checked) => updateNotificationSettings({ soundEnabled: checked })}
                      disabled={permission !== 'granted'}
                    />
                  </Row>
                </div>
              ) : (
                <p className="text-xs text-white/30">Desktop push notifications are not supported in this browser.</p>
              )}
            </div>
          </Section>

          {/* Auto Backup */}
          <Section title="Automatic Backup">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
              <Row label="Auto Backup" description="Automatically back up your workspace data on a recurring schedule.">
                <LiquidSwitch
                  checked={settings.autoBackup}
                  onCheckedChange={(checked) => updateSettings({ autoBackup: checked })}
                />
              </Row>
              {settings.autoBackup && (
                <>
                  <Separator className="bg-white/[0.05]" />
                  <Row label="Backup Frequency" description="How often Novo creates an automatic snapshot of your workspace.">
                    <Select
                      value={settings.backupFrequency}
                      onValueChange={(value: any) => updateSettings({ backupFrequency: value })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                </>
              )}
              <p className="text-[10px] text-white/25 leading-relaxed pt-1">
                Backups are stored locally and can be restored from the Advanced tab. Connect Google Drive for cloud redundancy.
              </p>
            </div>
          </Section>
        </div>
      )}

      {/* ─── Tab 5: AI Models ──────────────────────────────────────────────── */}
      {activeTab === 'ai_models' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Custom Models Uploader */}
          <Section title="Upload Custom AI Model">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="modelName">Model Label</Label>
                  <Input
                    id="modelName"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="LoRA model title..."
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model Type</Label>
                  <Select value={newModelType} onValueChange={(value: any) => setNewModelType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Base Model</SelectItem>
                      <SelectItem value="lora">LoRA Adaptor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newModelType === 'lora' && (
                <div className="space-y-2">
                  <Label htmlFor="baseModel">Base Model Identifier</Label>
                  <Input
                    id="baseModel"
                    value={newModelBase}
                    onChange={(e) => setNewModelBase(e.target.value)}
                    placeholder="e.g., microsoft/DialoGPT-medium"
                    className="bg-white/5 border-white/10"
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
                className="w-full border-white/10 hover:bg-white/5"
                onClick={() => modelFileInputRef.current?.click()}
                disabled={!newModelName.trim() || isUploadingModel}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploadingModel ? 'Uploading...' : 'Select File & Upload'}
              </Button>

              {isUploadingModel && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs">
                    <span>Upload progress</span>
                    <span>{modelUploadProgress}%</span>
                  </div>
                  <Progress value={modelUploadProgress} />
                </div>
              )}
            </div>
          </Section>

          {/* Model selection list */}
          <Section title="Available Models">
            <div className="space-y-2">
              {models.map(model => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3.5 border border-white/5 bg-white/[0.01] rounded-2xl hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {model.isActive ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-white/20" />
                    )}
                    <div>
                      <p className="font-semibold text-sm text-white/90">{model.name}</p>
                      <p className="text-xs text-white/35">
                        {model.type === 'lora' ? `LoRA (${model.baseModel})` : 'Base Model'} • {(model.size / (1024 * 1024)).toFixed(1)} MB • {new Date(model.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!model.isActive && model.id !== 'default' && (
                      <Button variant="outline" size="sm" onClick={() => handleSetActiveModel(model.id)} className="border-white/10 hover:bg-white/5 text-xs">
                        Activate
                      </Button>
                    )}
                    {model.id !== 'default' && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteModel(model.id, model.name)}>
                        <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ─── Tab 6: Integrations ─────────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <p className="text-xs text-white/35">
            Connect external services to sync your data with Novo. All connections use secure OAuth — no passwords are stored.
          </p>

          {/* Google */}
          <Section title="Google Workspace">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
              <div className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/85">Google Account</p>
                      <p className="text-xs text-white/35">
                        {session?.user?.email
                          ? `Connected as ${session.user.email}`
                          : 'Sync Calendar, Drive, and Contacts'}
                      </p>
                    </div>
                  </div>
                  {session?.user ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Connected
                      </span>
                      <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="text-[11px] text-white/30 hover:text-red-400 transition-colors font-medium"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => signIn('google')}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {/* Google Drive row — live backup */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <path d="M7.71 3.5L1.15 15l3.43 5.96L10.14 9.46 7.71 3.5z" fill="#0066DA"/>
                        <path d="M16.29 3.5L13.86 9.46l5.56 11.5H25L21.57 15 16.29 3.5z" fill="#00AC47"/>
                        <path d="M10.14 9.46L4.58 20.96h14.84l-3.56-11.5H10.14z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/85">Google Drive</p>
                      <p className="text-xs text-white/35">
                        {driveStatus?.connected && driveStatus?.hasScope
                          ? 'Backup your workspace data to Google Drive'
                          : driveStatus?.connected && !driveStatus?.hasScope
                            ? 'Drive scope not granted — reconnect Google'
                            : 'Connect Google first to enable Drive backup'}
                      </p>
                    </div>
                  </div>
                  {driveStatus?.connected && driveStatus?.hasScope ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Ready
                      </span>
                      <button
                        onClick={handleDriveBackup}
                        disabled={driveBackingUp}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-blue-300 disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {driveBackingUp ? 'Saving…' : 'Backup Now'}
                      </button>
                    </div>
                  ) : driveStatus?.connected ? (
                    <button
                      onClick={() => signIn('google')}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Grant Access
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-white/5 text-white/30 border border-white/8">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      Not Connected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* Notion — live OAuth integration */}
          <Section title="Productivity">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
              <div className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/60 font-bold text-sm">
                      N
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/85">Notion</p>
                      <p className="text-xs text-white/35">
                        {notionStatus?.connected
                          ? `Workspace: ${notionStatus.workspaceName ?? 'Connected'}`
                          : 'Import tasks and databases from Notion'}
                      </p>
                    </div>
                  </div>
                  {notionStatus?.connected ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Connected
                      </span>
                      <button
                        onClick={handleNotionSync}
                        disabled={notionSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-all text-teal-300 disabled:opacity-50"
                      >
                        <RefreshCw className={cn('w-3.5 h-3.5', notionSyncing && 'animate-spin')} />
                        {notionSyncing ? 'Syncing…' : 'Sync Now'}
                      </button>
                      <button
                        onClick={handleNotionDisconnect}
                        disabled={notionLoading}
                        className="text-[11px] text-white/30 hover:text-red-400 transition-colors font-medium"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleNotionConnect}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  )}
                </div>

                {/* Database selector — shown when connected */}
                {notionStatus?.connected && (
                  <div className="mt-3 pt-3 border-t border-white/[0.05]">
                    <button
                      onClick={handleFetchNotionDbs}
                      className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors"
                    >
                      <Database className="w-3 h-3" />
                      {notionDbsOpen ? 'Hide databases' : `Manage databases (${notionStatus.databaseIds?.length ?? 0} selected)`}
                    </button>

                    {notionDbsOpen && (
                      <div className="mt-2 space-y-1.5">
                        {notionDbs.length === 0 ? (
                          <p className="text-xs text-white/30 italic">No databases found. Make sure Novo has access to your Notion pages.</p>
                        ) : (
                          notionDbs.map(db => {
                            const selected = notionStatus.databaseIds?.includes(db.id) ?? false
                            return (
                              <button
                                key={db.id}
                                onClick={() => {
                                  const currentIds = notionStatus.databaseIds ?? []
                                  const next = selected
                                    ? currentIds.filter(i => i !== db.id)
                                    : [...currentIds, db.id]
                                  handleSaveNotionDbs(next)
                                }}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all',
                                  selected
                                    ? 'bg-teal-500/10 border border-teal-500/20 text-teal-300'
                                    : 'bg-white/[0.02] border border-white/[0.06] text-white/50 hover:bg-white/[0.05]'
                                )}
                              >
                                <span className={cn('w-2 h-2 rounded-sm flex-shrink-0', selected ? 'bg-teal-400' : 'bg-white/20')} />
                                {db.title}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#36C5F0">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/85">Slack</p>
                      <p className="text-xs text-white/35">Receive cognitive alerts in your Slack workspace</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-white/5 text-white/30 border border-white/8">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <p className="text-[10px] text-white/20 text-center pb-2">
            More integrations are added with each Novo release.
          </p>
        </div>
      )}

      {/* ─── Tab 7: Advanced ──────────────────────────────────────────────── */}
      {activeTab === 'advanced' && (
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
      )}
    </div>
  )
}
