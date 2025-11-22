'use client'

import { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Camera, Check, Trash2, SplitSquareHorizontal, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface Routine {
  id: string
  name: string
  type: string
  steps: string[]
  completedToday: boolean
  date?: string
}

export default function AppearancePage() {
  const { toast } = useToast()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [isRoutineDialogOpen, setIsRoutineDialogOpen] = useState(false)
  const [newRoutine, setNewRoutine] = useState({ name: '', type: 'skincare', steps: '' })
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])

  useEffect(() => {
    const savedRoutines = localStorage.getItem('novo_appearance_routines')
    if (savedRoutines) {
      setRoutines(JSON.parse(savedRoutines))
    } else {
      setRoutines([
        { 
          id: '1', 
          name: 'Morning Skin Care',
          type: 'skincare',
          steps: ['Cleanser', 'Toner', 'Serum', 'Moisturizer', 'SPF'],
          completedToday: false,
          date: '2023-10-01'
        },
        { 
          id: '2', 
          name: 'Evening Routine',
          type: 'skincare',
          steps: ['Cleanser', 'Exfoliant', 'Night cream'],
          completedToday: false,
          date: '2023-10-02'
        },
      ])
    }
  }, [])

  useEffect(() => {
    if (routines.length > 0) {
      localStorage.setItem('novo_appearance_routines', JSON.stringify(routines))
    }
  }, [routines])

  const handleAddRoutine = () => {
    if (!newRoutine.name.trim() || !newRoutine.steps.trim()) {
      toast({ title: 'Error', description: 'Please enter name and steps', variant: 'destructive' })
      return
    }
    
    const routine: Routine = {
      id: Date.now().toString(),
      name: newRoutine.name,
      type: newRoutine.type,
      steps: newRoutine.steps.split('\n').filter(s => s.trim()),
      completedToday: false
    }
    
    setRoutines([...routines, routine])
    setNewRoutine({ name: '', type: 'skincare', steps: '' })
    setIsRoutineDialogOpen(false)
    toast({ title: 'Routine added successfully' })
  }

  const handleMarkComplete = (id: string) => {
    setRoutines(routines.map(routine => 
      routine.id === id ? { ...routine, completedToday: true } : routine
    ))
    toast({ title: 'Routine completed!' })
  }

  const handleDeleteRoutine = (id: string) => {
    setRoutines(routines.filter(r => r.id !== id))
    toast({ title: 'Routine removed' })
  }

  const togglePhotoSelection = (id: string) => {
    if (selectedPhotos.includes(id)) {
      setSelectedPhotos(selectedPhotos.filter(p => p !== id))
    } else {
      if (selectedPhotos.length < 2) {
        setSelectedPhotos([...selectedPhotos, id])
      }
    }
  }

  return (
    <DashboardShell>
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
                      {routine.steps.map((step, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                          {step}
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Progress Photos</CardTitle>
                <CardDescription>Track visual changes</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant={isCompareMode ? "secondary" : "outline"}
                  onClick={() => {
                    setIsCompareMode(!isCompareMode)
                    setSelectedPhotos([])
                  }}
                >
                  <SplitSquareHorizontal className="h-4 w-4 mr-2" />
                  {isCompareMode ? 'Cancel' : 'Compare'}
                </Button>
                <Button size="sm" variant="outline">
                  <Camera className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isCompareMode && selectedPhotos.length === 2 && (
                <div className="mb-6 p-4 border rounded-lg bg-secondary/10">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Comparison View</h4>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPhotos([])}>
                      <X className="h-4 w-4 mr-2" /> Clear
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedPhotos.map(id => {
                      const photo = routines.find(r => r.id === id)
                      return (
                        <div key={id} className="space-y-2">
                          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-primary">
                            <Camera className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-center text-sm font-medium">{photo?.date || 'Unknown Date'}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {routines.map((photo) => (
                  <div 
                    key={photo.id} 
                    className={`aspect-square bg-muted rounded-lg flex items-center justify-center relative group cursor-pointer transition-all ${
                      isCompareMode 
                        ? selectedPhotos.includes(photo.id) 
                          ? 'ring-2 ring-primary ring-offset-2' 
                          : 'opacity-60 hover:opacity-100'
                        : ''
                    }`}
                    onClick={() => isCompareMode && togglePhotoSelection(photo.id)}
                  >
                    <Camera className="h-8 w-8 text-muted-foreground" />
                    <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-sm rounded px-2 py-1">
                      <p className="text-xs font-medium">{photo.date || 'Today'}</p>
                    </div>
                    {isCompareMode && selectedPhotos.includes(photo.id) && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Style Notes</CardTitle>
            <CardDescription>Hair, outfits, and grooming tips</CardDescription>
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
      </div>
    </DashboardShell>
  )
}
