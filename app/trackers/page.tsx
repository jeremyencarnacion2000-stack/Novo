'use client'

import { useState, useEffect } from 'react'
import { modalFlip } from '@/lib/modal-flip'
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
import { motion } from 'framer-motion'

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
    const tempId = `temp-${Date.now()}`
    const optimisticTracker: Tracker = {
      ...tracker,
      id: tempId,
      entries: []
    }
    const currentTrackers = Array.isArray(trackers) ? trackers : []
    const optimisticData = [...currentTrackers, optimisticTracker]

    // untoggle first: it restores the origin button's hidden icon/text and
    // plays the return flight before the dialog unmounts.
    modalFlip.untoggle('btn-new-tracker', () => setDialogOpen(false))
    toast({
      title: 'Tracker created',
      description: 'Your new tracker has been created successfully.',
    })

    try {
      await mutate(
        async () => {
          const response = await fetch('/api/trackers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(tracker),
          })
          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || 'Failed to create tracker')
          }
          return response.json()
        },
        {
          optimisticData,
          rollbackOnError: true,
          populateCache: (newTracker, cachedTrackers) => {
            const base = Array.isArray(cachedTrackers) ? cachedTrackers : []
            // fetcher returns the single created tracker; SWR types it as the list
            return base.map((t) => (t.id === tempId ? (newTracker as any) : t))
          },
          revalidate: true
        }
      )
    } catch (error: any) {
      console.error('Error creating tracker:', error)
      toast({
        title: 'Error creating tracker',
        description: error.message || 'Could not create tracker. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleUpdate = async (tracker: Tracker) => {
    const currentTrackers = Array.isArray(trackers) ? trackers : []
    const optimisticData = currentTrackers.map((t) => (t.id === tracker.id ? { ...t, ...tracker } : t))

    modalFlip.untoggle(`tracker-${tracker.id}`, () => {
      setDialogOpen(false)
      setEditingTracker(undefined)
    })
    toast({
      title: 'Tracker updated',
      description: 'Your tracker has been updated successfully.',
    })

    try {
      await mutate(
        async () => {
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
          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || 'Failed to update tracker')
          }
          return response.json()
        },
        {
          optimisticData,
          rollbackOnError: true,
          populateCache: (updatedTracker, cachedTrackers) => {
            const base = Array.isArray(cachedTrackers) ? cachedTrackers : []
            return base.map((t) => (t.id === tracker.id ? (updatedTracker as any) : t))
          },
          revalidate: true
        }
      )
    } catch (error: any) {
      console.error('Error updating tracker:', error)
      toast({
        title: 'Error updating tracker',
        description: error.message || 'Could not update tracker. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    const currentTrackers = Array.isArray(trackers) ? trackers : []
    const optimisticData = currentTrackers.filter((t) => t.id !== id)

    toast({
      title: 'Tracker deleted',
      description: 'Your tracker has been deleted successfully.',
    })

    try {
      await mutate(
        async () => {
          const response = await fetch(`/api/trackers/${id}`, {
            method: 'DELETE',
          })
          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || 'Failed to delete tracker')
          }
          // populateCache below computes the new list; fetcher result is unused
          return undefined
        },
        {
          optimisticData,
          rollbackOnError: true,
          populateCache: (_, cachedTrackers) => {
            const base = Array.isArray(cachedTrackers) ? cachedTrackers : []
            return base.filter((t) => t.id !== id)
          },
          revalidate: true
        }
      )
    } catch (error: any) {
      console.error('Error deleting tracker:', error)
      toast({
        title: 'Error deleting tracker',
        description: error.message || 'Could not delete tracker. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  // The dialog fires its own modalFlip.toggle() once mounted — calling it
  // here raced the render (flip target not in the DOM yet → plain reveal).
  const handleEdit = (tracker: Tracker) => {
    setEditingTracker(tracker)
    setDialogOpen(true)
  }

  const handleOpenNewTracker = () => {
    setEditingTracker(undefined)
    setDialogOpen(true)
  }

  // TrackerDialog already plays its own return flight before calling this
  // (via useModalFlip) — wrapping it again here would double-untoggle and
  // delay the unmount by a second, redundant animation.
  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingTracker(undefined)
  }

  const handleLogEntry = async (id: string, value: number) => {
    const today = new Date().toISOString().split('T')[0]
    const currentTrackers = Array.isArray(trackers) ? trackers : []
    const optimisticData = currentTrackers.map((t) => {
      if (t.id === id) {
        const hasTodayEntry = t.entries.some((e) => e.date === today)
        const updatedEntries = hasTodayEntry
          ? t.entries.map((e) => (e.date === today ? { ...e, value } : e))
          : [...t.entries, { date: today, value }]
        return { ...t, entries: updatedEntries }
      }
      return t
    })

    toast({
      title: 'Entry logged',
      description: 'Your entry has been logged successfully.',
    })

    try {
      await mutate(
        async () => {
          const response = await fetch(`/api/trackers/${id}/entries`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date: today, value }),
          })

          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || 'Failed to log entry')
          }

          // Track analytics if it's a habit completion (value 1)
          const tracker = trackers?.find(t => t.id === id)
          if (tracker && tracker.type === 'habit' && value === 1) {
            trackActivity('habit', true, { id, name: tracker.name, module: 'trackers' }).catch(err =>
              console.error('Failed to track habit completion:', err)
            )
          }

          return response.json()
        },
        {
          optimisticData,
          rollbackOnError: true,
          populateCache: (loggedEntry, cachedTrackers) => {
            // Note: DB returns the new entry, but we need to merge it back to the list
            const base = Array.isArray(cachedTrackers) ? cachedTrackers : []
            return base.map((t) => {
              if (t.id === id) {
                const hasTodayEntry = t.entries.some((e) => e.date === today)
                const updatedEntries = hasTodayEntry
                  ? t.entries.map((e) => (e.date === today ? (loggedEntry as any) : e))
                  : [...t.entries, loggedEntry as any]
                return { ...t, entries: updatedEntries }
              }
              return t
            })
          },
          revalidate: true
        }
      )
    } catch (error: any) {
      console.error('Error logging entry:', error)
      toast({
        title: 'Error logging entry',
        description: error.message || 'Could not log entry. Please try again later.',
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
        <Button onClick={handleOpenNewTracker} data-flip-from="btn-new-tracker" className="w-full sm:w-auto">
          <Plus data-shared-item="icon" className="h-4 w-4 mr-2" />
          <span data-shared-item="text">New Tracker</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto relative bg-foreground/5 border border-foreground/5 rounded-full p-1 h-11">
          <TabsTrigger
            value="habits"
            className="flex-1 sm:flex-none relative h-9 px-6 rounded-full text-xs font-semibold data-[state=active]:bg-transparent data-[state=active]:text-foreground transition-colors duration-300"
          >
            {activeTab === 'habits' && (
              <motion.div
                layoutId="active-tracker-tab"
                className="absolute inset-0 bg-foreground/10 border border-foreground/10 rounded-full z-0"
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
            <span className="relative z-10 hidden sm:inline">Habits ({habitTrackers?.length})</span>
            <span className="relative z-10 sm:hidden">Habits</span>
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
            className="flex-1 sm:flex-none relative h-9 px-6 rounded-full text-xs font-semibold data-[state=active]:bg-transparent data-[state=active]:text-foreground transition-colors duration-300"
          >
            {activeTab === 'metrics' && (
              <motion.div
                layoutId="active-tracker-tab"
                className="absolute inset-0 bg-foreground/10 border border-foreground/10 rounded-full z-0"
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
            <span className="relative z-10 hidden sm:inline">Metrics ({metricTrackers?.length})</span>
            <span className="relative z-10 sm:hidden">Metrics</span>
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