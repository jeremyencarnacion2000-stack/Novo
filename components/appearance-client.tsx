'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Camera, Check, Trash2, SplitSquareHorizontal, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { SkinToneSuggestions } from '@/components/appearance/skin-tone-suggestions'
import { CognitiveOutfitSuggestions } from '@/components/appearance/cognitive-outfit-suggestions'

interface Routine {
  id: string
  name: string
  type: string
  steps: string[]
  completedToday: boolean
  date?: string
}

export default function AppearanceClient() {
  const [isClient, setIsClient] = useState(false)
  const { data: session } = useSession()
  const { toast } = useToast()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [isRoutineDialogOpen, setIsRoutineDialogOpen] = useState(false)
  const [newRoutine, setNewRoutine] = useState({ name: '', type: 'skincare', steps: '' })
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/routines')
        .then(res => {
          if (res.ok) {
            return res.json()
          } else {
            return []
          }
        })
        .then((routinesData) => {
          const routinesArray = Array.isArray(routinesData) ? routinesData : []
          setRoutines(routinesArray)
        })
        .catch(console.error)
    }
  }, [session?.user?.id])

  if (!isClient) return null

  const handleAddRoutine = async () => {
    if (!newRoutine.name.trim() || !newRoutine.steps.trim()) {
      toast({ title: 'Error', description: 'Please enter name and steps', variant: 'destructive' })
      return
    }

    try {
      const tasks = newRoutine.steps.split('\n').filter(s => s.trim()).map(text => ({ text, completed: false }))
      const res = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoutine.name,
          timeOfDay: 'morning', // default
          duration: 15, // default
          tasks
        })
      })
      if (res.ok) {
        const newRoutineData = await res.json()
        setRoutines([...routines, newRoutineData])
        setNewRoutine({ name: '', type: 'skincare', steps: '' })
        setIsRoutineDialogOpen(false)
        toast({ title: 'Routine added successfully' })
      }
    } catch (error) {
      console.error('Failed to add routine:', error)
      toast({ title: 'Error', description: 'Failed to add routine', variant: 'destructive' })
    }
  }

  const handleMarkComplete = async (id: string) => {
    const routine = routines.find(r => r.id === id)
    if (!routine) return

    try {
      const tasksArray = Array.isArray((routine as any).tasks) ? (routine as any).tasks : []
      const updatedTasks = tasksArray.map((task: any) => ({ ...task, completed: true }))
      const res = await fetch(`/api/routines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks })
      })
      if (res.ok) {
        setRoutines(routines.map(r =>
          r.id === id ? { ...r, tasks: updatedTasks } : r
        ))
        toast({ title: 'Routine completed!' })
      }
    } catch (error) {
      console.error('Failed to mark complete:', error)
      toast({ title: 'Error', description: 'Failed to update routine', variant: 'destructive' })
    }
  }

  const handleDeleteRoutine = async (id: string) => {
    try {
      const res = await fetch(`/api/routines/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRoutines(routines.filter(r => r.id !== id))
        toast({ title: 'Routine removed' })
      }
    } catch (error) {
      console.error('Failed to delete routine:', error)
      toast({ title: 'Error', description: 'Failed to delete routine', variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Appearance & Style</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Track skin care, grooming, and aesthetic progress
          </p>
        </div>
        <Dialog open={isRoutineDialogOpen} onOpenChange={setIsRoutineDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Routine
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Routine</DialogTitle>
              <DialogDescription>Create a new skincare or grooming routine</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="routine-name">Routine Name</Label>
                <Input
                  id="routine-name"
                  value={newRoutine.name}
                  onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })}
                  placeholder="e.g. Morning Skin Care"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routine-type">Type</Label>
                <Input
                  id="routine-type"
                  value={newRoutine.type}
                  onChange={(e) => setNewRoutine({ ...newRoutine, type: e.target.value })}
                  placeholder="e.g. skincare, grooming"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routine-steps">Steps (one per line)</Label>
                <textarea
                  id="routine-steps"
                  value={newRoutine.steps}
                  onChange={(e) => setNewRoutine({ ...newRoutine, steps: e.target.value })}
                  placeholder="Cleanser&#10;Toner&#10;Moisturizer"
                  className="w-full min-h-[120px] px-3 py-2 border border-input bg-background rounded-md"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddRoutine}>Add Routine</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Routines</CardTitle>
            <CardDescription>Skin care and grooming</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {routines.map((routine) => (
                <div key={routine.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{routine.name}</h3>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {routine.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {routine.completedToday && (
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <Check className="h-4 w-4" />
                          Done
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRoutine(routine.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {(Array.isArray((routine as any).tasks) ? (routine as any).tasks : (routine as any).steps || []).map((step: any, idx: number) => (
                      <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        {typeof step === 'string' ? step : step.text || step.name || ''}
                      </div>
                    ))}
                  </div>
                  {!routine.completedToday && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleMarkComplete(routine.id)}
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cognitive Outfit Recommendations */}
        <CognitiveOutfitSuggestions />
      </div>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Style Notes</CardTitle>
              <CardDescription>Hair, outfits, and grooming tips</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium text-sm mb-1">Current Hairstyle</h4>
                <p className="text-sm text-muted-foreground">Medium fade with textured top</p>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-medium text-sm mb-1">Favorite Products</h4>
                <p className="text-sm text-muted-foreground">Cerave cleanser, The Ordinary serum</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <SkinToneSuggestions />
      </div>
    </div>
  )
}