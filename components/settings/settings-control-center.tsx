'use client'

import { useEffect, useId, useState } from 'react'
import {
  Brain, Sparkles, LayoutDashboard, Settings, Bot, Globe, Shield, Crown, KeyRound
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tab } from './settings-shared'
import { useTranslation } from '@/lib/i18n'
import { LayoutGroup } from 'framer-motion'
import { NavigationIndicator } from '@/components/ui/navigation-indicator'

// ─── Tab section components ──────────────────────────────────────────────────
import { SettingsTwin } from './settings-twin'
import { SettingsPersonalization } from './settings-personalization'
import { SettingsModules } from './settings-modules'
import { SettingsPreferences } from './settings-preferences'
import { SettingsAiModels } from './settings-ai-models'
import { SettingsIntegrations } from './settings-integrations'
import { SettingsAdvanced } from './settings-advanced'
import { SettingsBilling } from './settings-billing'
import { SettingsMcpAccess } from './settings-mcp-access'

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS: { id: Tab; icon: React.ElementType }[] = [
  { id: 'twin', icon: Brain },
  { id: 'personalization', icon: Sparkles },
  { id: 'modules', icon: LayoutDashboard },
  { id: 'preferences', icon: Settings },
  { id: 'ai_models', icon: Bot },
  { id: 'integrations', icon: Globe },
  { id: 'billing', icon: Crown },
  { id: 'mcp', icon: KeyRound },
  { id: 'advanced', icon: Shield },
]

const TAB_LABELS = {
  es: { twin: 'Gemelo Cognitivo', personalization: 'Personalización', modules: 'Módulos', preferences: 'Preferencias', ai_models: 'Modelos de IA', integrations: 'Integraciones', billing: 'Plan', advanced: 'Avanzado' },
  en: { twin: 'Cognitive Twin', personalization: 'Personalization', modules: 'Modules', preferences: 'Preferences', ai_models: 'AI Models', integrations: 'Integrations', billing: 'Plan', advanced: 'Advanced' },
  fr: { twin: 'Jumeau Cognitif', personalization: 'Personnalisation', modules: 'Modules', preferences: 'Préférences', ai_models: 'Modèles IA', integrations: 'Intégrations', billing: 'Forfait', advanced: 'Avancé' },
  de: { twin: 'Kognitiver Zwilling', personalization: 'Personalisierung', modules: 'Module', preferences: 'Einstellungen', ai_models: 'KI-Modelle', integrations: 'Integrationen', billing: 'Tarif', advanced: 'Erweitert' },
} as const

// ─── Main Export ─────────────────────────────────────────────────────────────
export function SettingsControlCenter() {
  const navigationId = useId()
  const { language } = useTranslation()
  const locale = language === 'es' || language === 'fr' || language === 'de' ? language : 'en'
  const labels = {
    ...TAB_LABELS[locale],
    mcp: locale === 'es' ? 'Acceso MCP' : locale === 'fr' ? 'Accès MCP' : locale === 'de' ? 'MCP-Zugriff' : 'MCP access',
  }
  const [activeTab, setActiveTab] = useState<Tab>('twin')

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab')
    if (TABS.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab as Tab)
    }
  }, [])

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
    <div className="w-full grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)] gap-6 md:gap-8 max-w-5xl mx-auto items-start">
      {/* Premium Navigation Hub */}
      <div
        className="novo-settings-nav flex overflow-x-auto gap-1 p-1 rounded-2xl sticky top-0 z-20 md:flex-col md:overflow-visible md:gap-1.5 md:p-2 md:rounded-[26px] md:w-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <LayoutGroup id={navigationId}>
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative shrink-0 flex min-h-11 items-center justify-center md:justify-start gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap md:w-full focus-visible:outline-2 focus-visible:outline-offset-2',
                activeTab === tab.id
                  ? 'novo-nav-label-active'
                  : 'novo-nav-label hover:bg-foreground/[0.04]',
              )}
            >
              {activeTab === tab.id && <NavigationIndicator layoutId="settings-nav-pill" />}
              <Icon className="relative z-10 w-4 h-4 flex-shrink-0" />
              <span className="relative z-10">{labels[tab.id]}</span>
            </button>
          )
        })}
        </LayoutGroup>
      </div>

      {/* ─── Tab Content ──────────────────────────────────────────────── */}
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {activeTab === 'twin' && <SettingsTwin />}
        {activeTab === 'personalization' && <SettingsPersonalization />}
        {activeTab === 'modules' && <SettingsModules />}
        {activeTab === 'preferences' && <SettingsPreferences />}
        {activeTab === 'ai_models' && <SettingsAiModels />}
        {activeTab === 'integrations' && <SettingsIntegrations />}
        {activeTab === 'billing' && <SettingsBilling />}
        {activeTab === 'mcp' && <SettingsMcpAccess />}
        {activeTab === 'advanced' && <SettingsAdvanced onOpenMcp={() => setActiveTab('mcp')} />}
      </div>
    </div>
  )
}
