'use client'

import React, { useState, useEffect } from 'react'
import { Focus, Timer, Volume2, StickyNote, Play, Pause, RotateCcw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { usePomodoro } from '@/lib/pomodoro-context'

const AMBIENT_SOUNDS = [
  { id: 'rain', name: 'Rain', emoji: '🌧️' },
  { id: 'coffee', name: 'Coffee Shop', emoji: '☕' },
  { id: 'ocean', name: 'Ocean Waves', emoji: '🌊' },
  { id: 'forest', name: 'Forest', emoji: '🌲' },
  { id: 'fire', name: 'Fireplace', emoji: '🔥' },
]

export function FocusMode() {
  const [isOpen, setIsOpen] = useState(false)

  // Use Pomodoro Context
  const { mode, timeLeft, isRunning, completedPomodoros, startTimer, pauseTimer, resetTimer } = usePomodoro()

  // Ambient Sounds State
  const [selectedSound, setSelectedSound] = useState<string | null>(null)
  const [volume, setVolume] = useState([50])

  // Quick Notes State
  const [notes, setNotes] = useState('')

  // Load notes from API
  useEffect(() => {
    async function loadNotes() {
      try {
        const response = await fetch('/api/quick-notes')
        if (response.ok) {
          const data = await response.json()
          setNotes(data.content)
        }
      } catch (error) {
        console.error('Failed to load notes:', error)
      }
    }
    loadNotes()
  }, [])

  // Save notes to API with debounce
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (notes) {
        try {
          await fetch('/api/quick-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: notes })
          })
        } catch (error) {
          console.error('Failed to save notes:', error)
        }
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [notes])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getModeLabel = () => {
    switch (mode) {
      case 'work': return 'Trabajo'
      case 'shortBreak': return 'Descanso Corto'
      case 'longBreak': return 'Descanso Largo'
    }
  }

  const getModeColor = () => {
    switch (mode) {
      case 'work': return 'bg-red-500'
      case 'shortBreak': return 'bg-green-500'
      case 'longBreak': return 'bg-blue-500'
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
        >
          <Focus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px]" align="end" side="top">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium leading-none flex items-center gap-2">
              <Focus className="h-4 w-4" />
              Focus Tools
            </h4>
            <p className="text-xs text-muted-foreground">
              Herramientas para maximizar tu productividad
            </p>
          </div>

          <Tabs defaultValue="pomodoro" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pomodoro" className="text-xs">
                <Timer className="h-3 w-3 mr-1" />
                Pomodoro
              </TabsTrigger>
              <TabsTrigger value="sounds" className="text-xs">
                <Volume2 className="h-3 w-3 mr-1" />
                Sonidos
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs">
                <StickyNote className="h-3 w-3 mr-1" />
                Notas
              </TabsTrigger>
            </TabsList>

            {/* Pomodoro Timer */}
            <TabsContent value="pomodoro" className="space-y-4">
              <div className="text-center space-y-3">
                <Badge className={getModeColor()}>
                  {getModeLabel()}
                </Badge>

                <div className="text-5xl font-bold tabular-nums">
                  {formatTime(timeLeft)}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={isRunning ? pauseTimer : startTimer}
                  >
                    {isRunning ? (
                      <>
                        <Pause className="h-4 w-4 mr-1" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        Iniciar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetTimer}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reiniciar
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Pomodoros completados: {completedPomodoros}
                </div>
              </div>
            </TabsContent>

            {/* Ambient Sounds */}
            <TabsContent value="sounds" className="space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {AMBIENT_SOUNDS.map((sound) => (
                    <Button
                      key={sound.id}
                      variant={selectedSound === sound.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedSound(selectedSound === sound.id ? null : sound.id)}
                      className="justify-start"
                    >
                      <span className="mr-2">{sound.emoji}</span>
                      {sound.name}
                    </Button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Volumen</label>
                  <Slider
                    value={volume}
                    onValueChange={setVolume}
                    max={100}
                    step={1}
                    disabled={!selectedSound}
                  />
                </div>

                {selectedSound && (
                  <p className="text-xs text-muted-foreground text-center">
                    🎵 Reproduciendo: {AMBIENT_SOUNDS.find(s => s.id === selectedSound)?.name}
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Quick Notes */}
            <TabsContent value="notes" className="space-y-3">
              <Textarea
                placeholder="Escribe tus ideas rápidas aquí..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[150px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Tus notas se guardan automáticamente
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  )
}