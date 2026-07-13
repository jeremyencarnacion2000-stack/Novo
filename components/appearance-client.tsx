'use client'

import { useState, useEffect } from 'react'
import { SkinToneSuggestions } from '@/components/appearance/skin-tone-suggestions'
import { CognitiveOutfitSuggestions } from '@/components/appearance/cognitive-outfit-suggestions'

export default function AppearanceClient() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => { setIsClient(true) }, [])

  if (!isClient) return null

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Style OS</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Outfit recommendations based on your calendar, skin tone, and personal style
        </p>
      </div>

      <CognitiveOutfitSuggestions />

      <SkinToneSuggestions />
    </div>
  )
}