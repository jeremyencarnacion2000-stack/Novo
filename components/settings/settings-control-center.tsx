'use client'

import { useState } from 'react'
import {
  Brain, Sparkles, LayoutDashboard, Settings, Bot, Globe, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tab } from './settings-shared'

// ─── Tab section components ──────────────────────────────────────────────────
import { SettingsTwin } from './settings-twin'
import { SettingsPersonalization } from './settings-personalization'
import { SettingsModules } from './settings-modules'
import { SettingsPreferences } from './settings-preferences'
import { SettingsAiModels } from './settings-ai-models'
import { SettingsIntegrations } from './settings-integrations'
import { SettingsAdvanced } from './settings-advanced'

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'twin', label: 'Cognitive Twin', icon: Brain },
  { id: 'personalization', label: 'Personalization', icon: Sparkles },
  { id: 'modules', label: 'Modules', icon: LayoutDashboard },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'ai_models', label: 'AI Models', icon: Bot },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'advanced', label: 'Advanced', icon: Shield },
]

// ─── Main Export ─────────────────────────────────────────────────────────────
export function SettingsControlCenter() {
  const [activeTab, setActiveTab] = useState<Tab>('twin')

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

      {/* ─── Tab Content ──────────────────────────────────────────────── */}
      {activeTab === 'twin' && <SettingsTwin />}
      {activeTab === 'personalization' && <SettingsPersonalization />}
      {activeTab === 'modules' && <SettingsModules />}
      {activeTab === 'preferences' && <SettingsPreferences />}
      {activeTab === 'ai_models' && <SettingsAiModels />}
      {activeTab === 'integrations' && <SettingsIntegrations />}
      {activeTab === 'advanced' && <SettingsAdvanced />}
    </div>
  )
}
