'use client'

import { NotificationProvider } from '@/lib/notification-context'
import { SettingsModal } from '@/components/settings/settings-modal'

export function CognitiveSettingsModal() {
  return <NotificationProvider><SettingsModal /></NotificationProvider>
}
