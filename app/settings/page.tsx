
'use client'

import { SettingsControlCenter } from '@/components/settings/settings-control-center'
import { useTranslation } from '@/lib/i18n'

const SETTINGS_COPY = {
  es: { eyebrow: 'Centro de control', title: 'Ajustes del sistema', description: 'Configura tu Gemelo Cognitivo, preferencias, integraciones y plan.' },
  en: { eyebrow: 'Control center', title: 'System settings', description: 'Configure your Cognitive Twin, preferences, integrations, and plan.' },
  fr: { eyebrow: 'Centre de contrôle', title: 'Réglages du système', description: 'Configurez votre Jumeau Cognitif, vos préférences, vos intégrations et votre forfait.' },
  de: { eyebrow: 'Kontrollzentrum', title: 'Systemeinstellungen', description: 'Konfiguriere deinen Kognitiven Zwilling, Präferenzen, Integrationen und Tarif.' },
} as const

export default function SettingsPage() {
  const { language } = useTranslation()
  const locale = language === 'es' || language === 'fr' || language === 'de' ? language : 'en'
  const copy = SETTINGS_COPY[locale]

  return (
    <div className="settings-page-shell flex flex-col gap-6 md:gap-8">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 mb-1">{copy.eyebrow}</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/90">
          {copy.title}
        </h1>
        <p className="text-foreground/40 mt-1 text-sm">
          {copy.description}
        </p>
      </div>

      <SettingsControlCenter />
    </div>
  )
}
