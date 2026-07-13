'use client'

import { Button } from '@/components/ui/button'
import { LiquidSwitch } from '@/components/ui/liquid-switch'
import { useToast } from '@/hooks/use-toast'
import { Brain, RefreshCw, ArrowUp, ArrowDown, Star, EyeOff, Plus } from 'lucide-react'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { cn } from '@/lib/utils'
import { Section, ALL_MODULES } from './settings-shared'
import type { DisabledModule } from './settings-shared'

export function SettingsModules() {
  const { toast } = useToast()
  const { twin, updateTwin } = useCognitiveTwin()

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

  return (
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
              className="flex items-center justify-between p-3.5 rounded-2xl border border-foreground/5 bg-foreground/[0.01] hover:bg-foreground/[0.03] transition-colors"
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
                    <span className="font-semibold text-sm text-foreground/95">{modInfo.title}</span>
                    {isPinned && (
                      <span className="text-[9px] font-black tracking-widest uppercase bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                        Pinned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/35">{modInfo.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8', isPinned ? 'text-yellow-500 hover:text-yellow-600' : 'text-foreground/40 hover:text-foreground')}
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
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-foreground/5 bg-foreground/[0.005] hover:bg-foreground/[0.015] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-foreground/5 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm text-foreground/50">{modInfo.title}</span>
                      <p className="text-xs text-foreground/30">{modInfo.desc}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/20 text-foreground/40 hover:text-primary"
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
                    <div className="w-8 h-8 rounded-xl bg-foreground/5 border border-foreground/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-foreground/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground/50">{mod.title}</p>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/15">
                          <EyeOff className="w-2.5 h-2.5 text-amber-400" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Twin Hidden</span>
                        </div>
                      </div>
                      <p className="text-xs text-foreground/30 mb-1">{mod.reason}</p>
                      <div className="flex items-center gap-3 text-[10px] text-foreground/25">
                        <span>Confidence: {mod.confidence}%</span>
                        <span>.</span>
                        <span>Since {new Date(mod.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEnableAnyway(mod.id)}
                      className="text-xs border-foreground/10 hover:border-primary/30 hover:bg-primary/10 hover:text-primary flex-shrink-0"
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
  )
}
