'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HabitTrackers } from '@/components/trackers/habit-trackers'
import { MetricTrackers } from '@/components/trackers/metric-trackers'
import { TrackerDialog } from '@/components/trackers/tracker-dialog'
import { Tracker } from '@/types/tracker'
import { useTrackers } from '@/hooks/use-swr'
import { useToast } from '@/hooks/use-toast'
import { trackActivity } from '@/lib/activity-tracker'

export default function TrackersPage() {
  const { data: trackers, error, isLoading, mutate } = useTrackers()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTracker, setEditingTracker] = useState<Tracker | undefined>()
  const [activeTab, setActiveTab] = useState('habits')

  const habitTrackers = Array.isArray(trackers) ? trackers.filter((t) => t && typeof t === 'object' && t.type === 'habit') : []
  const metricTrackers = Array.isArray(trackers) ? trackers.filter((t) => t && typeof t === 'object' && t.type === 'metric') : []

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error fetching trackers',
        description: 'Could not fetch trackers. Please try again later.',
        variant: 'destructive',
      })
    }
  }, [error, toast])


  const handleCreate = async (tracker: Omit<Tracker, 'id'>) => {
    try {
      const response = await fetch('/api/trackers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tracker),
      })

      if (response.ok) {
        mutate()
        setDialogOpen(false)
        toast({
          title: 'Tracker created',
          description: 'Your new tracker has been created successfully.',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error creating tracker',
          description: error.error || 'Could not create tracker. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error creating tracker:', error)
      toast({
        title: 'Error creating tracker',
        description: 'Could not create tracker. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleUpdate = async (tracker: Tracker) => {
    try {
      const response = await fetch(`/api/trackers/${tracker.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tracker.name,
          type: tracker.type,
          unit: tracker.unit,
          goal: tracker.goal,
        }),
      })

      if (response.ok) {
        mutate()
        setDialogOpen(false)
        setEditingTracker(undefined)
        toast({
          title: 'Tracker updated',
          description: 'Your tracker has been updated successfully.',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error updating tracker',
          description: error.error || 'Could not update tracker. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating tracker:', error)
      toast({
        title: 'Error updating tracker',
        description: 'Could not update tracker. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/trackers/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        mutate()
        toast({
          title: 'Tracker deleted',
          description: 'Your tracker has been deleted successfully.',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error deleting tracker',
          description: error.error || 'Could not delete tracker. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting tracker:', error)
      toast({
        title: 'Error deleting tracker',
        description: 'Could not delete tracker. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (tracker: Tracker) => {
    setEditingTracker(tracker)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingTracker(undefined)
  }

  const handleLogEntry = async (id: string, value: number) => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const response = await fetch(`/api/trackers/${id}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: today, value }),
      })

      if (response.ok) {
        mutate()

        // Track analytics if it's a habit completion (value 1)
        const tracker = trackers?.find(t => t.id === id)
        if (tracker && tracker.type === 'habit' && value === 1) {
          trackActivity('habit', true, { id, name: tracker.name, module: 'trackers' })
        }

        toast({
          title: 'Entry logged',
          description: 'Your entry has been logged successfully.',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error logging entry',
          description: error.error || 'Could not log entry. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error logging entry:', error)
      toast({
        title: 'Error logging entry',
        description: 'Could not log entry. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleSave = (tracker: Tracker | Omit<Tracker, 'id'>) => {
    if ('id' in tracker) {
      handleUpdate(tracker as Tracker)
    } else {
      handleCreate(tracker as Omit<Tracker, 'id'>)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading trackers...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
            Trackers
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Track your habits and metrics over time
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Tracker
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="habits" className="flex-1 sm:flex-none">
            <span className="hidden sm:inline">Habits ({habitTrackers?.length})</span>
            <span className="sm:hidden">Habits</span>
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex-1 sm:flex-none">
            <span className="hidden sm:inline">Metrics ({metricTrackers?.length})</span>
            <span className="sm:hidden">Metrics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="habits" className="mt-6">
          <HabitTrackers
            trackers={habitTrackers || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onLogEntry={handleLogEntry}
          />
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <MetricTrackers
            trackers={metricTrackers || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onLogEntry={handleLogEntry}
          />
        </TabsContent>
      </Tabs>

      <TrackerDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleSave}
        tracker={editingTracker}
      />
    </div>
  )
}