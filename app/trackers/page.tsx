'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HabitTrackers } from '@/components/trackers/habit-trackers'
import { MetricTrackers } from '@/components/trackers/metric-trackers'
import { TrackerDialog } from '@/components/trackers/tracker-dialog'
import { Tracker } from '@/types/tracker'
import { useAnalyticsSession } from '@/hooks/use-analytics-session'

export default function TrackersPage() {
  useAnalyticsSession('trackers')
  const [trackers, setTrackers] = useState<Tracker[]>([
    {
      id: '1',
      name: 'Water Intake',
      type: 'metric',
      unit: 'glasses',
      goal: 8,
      entries: [
        { date: '2024-11-15', value: 7 },
        { date: '2024-11-16', value: 8 },
        { date: '2024-11-17', value: 6 },
        { date: '2024-11-18', value: 8 },
        { date: '2024-11-19', value: 9 },
      ],
    },
    {
      id: '2',
      name: 'Exercise',
      type: 'habit',
      unit: 'sessions',
      goal: 5,
      entries: [
        { date: '2024-11-15', value: 1 },
        { date: '2024-11-16', value: 1 },
        { date: '2024-11-18', value: 1 },
        { date: '2024-11-19', value: 1 },
      ],
    },
    {
      id: '3',
      name: 'Reading',
      type: 'metric',
      unit: 'pages',
      goal: 30,
      entries: [
        { date: '2024-11-15', value: 25 },
        { date: '2024-11-16', value: 32 },
        { date: '2024-11-17', value: 28 },
        { date: '2024-11-18', value: 35 },
        { date: '2024-11-19', value: 30 },
      ],
    },
    {
      id: '4',
      name: 'Meditation',
      type: 'habit',
      unit: 'sessions',
      goal: 7,
      entries: [
        { date: '2024-11-15', value: 1 },
        { date: '2024-11-16', value: 1 },
        { date: '2024-11-17', value: 1 },
        { date: '2024-11-18', value: 1 },
        { date: '2024-11-19', value: 1 },
      ],
    },
  ])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTracker, setEditingTracker] = useState<Tracker | undefined>()
  const [activeTab, setActiveTab] = useState('habits')

  const habitTrackers = trackers.filter((t) => t.type === 'habit')
  const metricTrackers = trackers.filter((t) => t.type === 'metric')

  const handleCreate = (tracker: Omit<Tracker, 'id'>) => {
    const newTracker = {
      ...tracker,
      id: Date.now().toString(),
    }
    setTrackers([...trackers, newTracker])
    setDialogOpen(false)
  }

  const handleUpdate = (tracker: Tracker) => {
    setTrackers(trackers.map((t) => (t.id === tracker.id ? tracker : t)))
    setDialogOpen(false)
    setEditingTracker(undefined)
  }

  const handleDelete = (id: string) => {
    setTrackers(trackers.filter((t) => t.id !== id))
  }

  const handleEdit = (tracker: Tracker) => {
    setEditingTracker(tracker)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingTracker(undefined)
  }

  const handleLogEntry = (id: string, value: number) => {
    const today = new Date().toISOString().split('T')[0]
    setTrackers(
      trackers.map((tracker) => {
        if (tracker.id === id) {
          const existingEntryIndex = tracker.entries.findIndex(
            (e) => e.date === today
          )
          if (existingEntryIndex >= 0) {
            const updatedEntries = [...tracker.entries]
            updatedEntries[existingEntryIndex] = { date: today, value }
            return { ...tracker, entries: updatedEntries }
          } else {
            return {
              ...tracker,
              entries: [...tracker.entries, { date: today, value }],
            }
          }
        }
        return tracker
      })
    )
  }

  const handleSave = (tracker: Tracker | Omit<Tracker, 'id'>) => {
    if ('id' in tracker) {
      handleUpdate(tracker as Tracker)
    } else {
      handleCreate(tracker as Omit<Tracker, 'id'>)
    }
  }

  return (
    <DashboardShell>
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
              <span className="hidden sm:inline">Habits ({habitTrackers.length})</span>
              <span className="sm:hidden">Habits</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex-1 sm:flex-none">
              <span className="hidden sm:inline">Metrics ({metricTrackers.length})</span>
              <span className="sm:hidden">Metrics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="habits" className="mt-6">
            <HabitTrackers
              trackers={habitTrackers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onLogEntry={handleLogEntry}
            />
          </TabsContent>

          <TabsContent value="metrics" className="mt-6">
            <MetricTrackers
              trackers={metricTrackers}
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
    </DashboardShell>
  )
}
