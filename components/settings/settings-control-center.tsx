'use client'

import { useState } from 'react'
import {
  Brain, Sparkles, LayoutDashboard, Settings, Bot, Globe, Shield, Crown
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
import { SettingsBilling } from './settings-billing'

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'twin', label: 'Cognitive Twin', icon: Brain },
  { id: 'personalization', label: 'Personalization', icon: Sparkles },
  { id: 'modules', label: 'Modules', icon: LayoutDashboard },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'ai_models', label: 'AI Models', icon: Bot },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'billing', label: 'Plan', icon: Crown },
  { id: 'advanced', label: 'Advanced', icon: Shield },
]

// ─── Main Export ─────────────────────────────────────────────────────────────
export function SettingsControlCenter() {
  const [activeTab, setActiveTab] = useState<Tab>('twin')

  // No own scroll/max-height on the root below — this renders in two
  // different scroll contexts (the /settings page route, via PageWrapper's
  // own scroll container + pb-40 nav clearance; and SettingsModal's
  // `flex-1 overflow-y-auto` panel). A `max-h-[85vh] overflow-y-auto` used
  // to sit there, capping this at its own independent scroll region — on
  // the page route that orphaned it from PageWrapper's bottom padding
  // reserved for the fixed mobile nav, so the last tab's content (e.g. the
  // accent color picker) could render right up against/under the nav
  // instead of above it.
  return (
    <div className="w-full flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Premium Navigation Hub */}
      <div
        className="flex overflow-x-auto gap-1 p-1 rounded-2xl bg-foreground/[0.02] border border-foreground/[0.05] sticky top-0 backdrop-blur-xl z-20"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'shrink-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-300 whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-primary/15 text-primary border border-primary/25 shadow-[0_2px_12px_rgba(var(--primary-rgb),0.12)]'
                  : 'text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.02]',
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
      {activeTab === 'billing' && <SettingsBilling />}
      {activeTab === 'advanced' && <SettingsAdvanced />}
    </div>
  )
}
