'use client'

import { useState, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LiquidSwitch } from '@/components/ui/liquid-switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, Trash2, Upload, Check } from 'lucide-react'
import { useSettings } from '@/lib/settings-context'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { Section, Row } from './settings-shared'

export function SettingsPersonalization() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { settings, updateSettings, resetSettings } = useSettings()

  // Background upload states
  const [isUploadingBg, setIsUploadingBg] = useState(false)
  const bgInputRef = useRef<HTMLInputElement>(null)

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

  return (
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
                      x
                    </button>
                    {settings.backgroundImage === img && (
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-white text-[8px]">&#10003;</span>
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
  )
}
