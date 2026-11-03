'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { CommandPaletteOnDemand } from '@/components/command-palette-on-demand'
import { useMobileOverlay } from '@/components/mobile-overlay-provider'
import { useSettings } from '@/lib/settings-context'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { restoreMobileNavigationFocus } from '@/lib/mobile-nav-motion'

const SettingsModal = dynamic(() => import('@/components/cognitive/cognitive-settings-modal').then(module => ({ default: module.CognitiveSettingsModal })), { ssr: false })
const VoiceCommandHub = dynamic(() => import('@/components/ai/VoiceCommandHub').then(module => ({ default: module.VoiceCommandHub })), { ssr: false })

/** Load the real controls on demand, without the full chat/music widget stack. */
export function CognitiveNavigationUtilities() {
  const { isSettingsOpen } = useSettings()
  const [settingsRequested, setSettingsRequested] = useState(isSettingsOpen)
  const { activeOverlay, openOverlay, closeOverlay } = useMobileOverlay()
  useEffect(() => { if (isSettingsOpen) setSettingsRequested(true) }, [isSettingsOpen])
  useEffect(() => {
    if (activeOverlay !== 'voice') window.dispatchEvent(new Event('novo:voice-cancel'))
  }, [activeOverlay])
  useEffect(() => {
    const toggleVoice = () => activeOverlay === 'voice' ? closeOverlay() : openOverlay('voice')
    const openVoice = () => openOverlay('voice')
    window.addEventListener('toggle-voice-command-hub', toggleVoice)
    window.addEventListener('open-voice-command-hub', openVoice)
    return () => { window.removeEventListener('toggle-voice-command-hub', toggleVoice); window.removeEventListener('open-voice-command-hub', openVoice) }
  }, [activeOverlay, closeOverlay, openOverlay])
  return <>
    <CommandPaletteOnDemand />
    {settingsRequested && <SettingsModal />}
    <Dialog open={activeOverlay === 'voice'} onOpenChange={(open) => { if (!open) closeOverlay() }} onExitComplete={restoreMobileNavigationFocus}>
      <DialogContent motionPreset="anchored" mobilePresentation="sheet" className="max-w-sm border-foreground/10 bg-background/95 p-5 backdrop-blur-xl">
        <DialogTitle>Habla con Novo</DialogTitle>
        <DialogDescription>Dicta una pregunta o instrucción. El audio se envía a OpenAI para transcribirlo; Novo añade el texto al chat y espera a que lo revises y envíes.</DialogDescription>
        <VoiceCommandHub />
      </DialogContent>
    </Dialog>
  </>
}
