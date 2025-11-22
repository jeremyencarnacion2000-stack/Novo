'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Plus, Upload } from 'lucide-react'
import { RoutinesList } from '@/components/routines/routines-list'
import { RoutineDialog } from '@/components/routines/routine-dialog'
import { ImportRoutineDialog } from '@/components/routines/import-routine-dialog'
import { Routine } from '@/types/routine'
import { RoutineDetailDialog } from '@/components/routines/routine-detail-dialog'
import { useAnalyticsSession } from '@/hooks/use-analytics-session'

export default function RoutinesPage() {
  useAnalyticsSession('routines')
  const [routines, setRoutines] = useState<Routine[]>([
    {
      id: 'hypertrophy-1',
      name: 'DÍA 1 – Pecho Superior • Hombros • Tríceps',
      description: 'Rutina de hipertrofia estética con calistenia avanzada + mochila. Tempo: 3s bajada – 1s subida',
      timeOfDay: 'morning',
      duration: 60,
      tasks: [
        { id: 't1', text: 'Flexiones con pies elevados + mochila - 4× 6–12 reps (Drop set)', completed: false },
        { id: 't2', text: 'Pseudo Planche Push Ups - 3× 6–12 reps (Drop set)', completed: false },
        { id: 't3', text: 'Flexiones "squeeze" con mochila - 3× 6–12 reps (Drop set)', completed: false },
        { id: 't4', text: 'Press militar con mochila - 4× 6–12 reps (Drop set)', completed: false },
        { id: 't5', text: 'Elevaciones laterales con mochila - 3× 10–15 reps (Drop set)', completed: false },
        { id: 't6', text: 'Pike push ups pies elevados - 3× 8–12 reps (Drop set)', completed: false },
        { id: 't7', text: 'Fondos entre sillas con mochila - 4× 6–12 (Drop set)', completed: false },
        { id: 't8', text: 'Extensión overhead con mochila - 3× 8–12 (Drop set)', completed: false },
        { id: 't9', text: 'Flexiones diamante - 3 series al fallo', completed: false },
      ],
      isActive: true,
    },
    {
      id: 'hypertrophy-2',
      name: 'DÍA 2 – Espalda • Bíceps • Core',
      description: 'Rutina de hipertrofia estética con calistenia avanzada + mochila. Tempo: 3s bajada – 1s subida',
      timeOfDay: 'morning',
      duration: 60,
      tasks: [
        { id: 't1', text: 'Remo con mochila (torso inclinado) - 4× 6–12 (Drop set)', completed: false },
        { id: 't2', text: 'Dominadas (ancho → neutro → supino) - 4 series al fallo (Drop set)', completed: false },
        { id: 't3', text: 'Remo unilateral con mochila - 3× 10–12 por lado', completed: false },
        { id: 't4', text: 'Face pulls con mochila - 3× 12–15 (Drop set)', completed: false },
        { id: 't5', text: 'Curl con mochila tipo barra - 4× 6–12 (Drop set)', completed: false },
        { id: 't6', text: 'Curl concentrado apoyado en pierna - 3× 10–12', completed: false },
        { id: 't7', text: 'Curl martillo con mochila - 3× 10–12', completed: false },
        { id: 't8', text: 'Plancha con mochila - 3× 30–60 s (Drop set)', completed: false },
        { id: 't9', text: 'Elevaciones de piernas con mochila - 3× 10–15', completed: false },
        { id: 't10', text: 'Rollout improvisado con mochila - 3× 8–12', completed: false },
      ],
      isActive: true,
    },
    {
      id: 'hypertrophy-3',
      name: 'DÍA 3 – Piernas • Glúteos • Core',
      description: 'Rutina de hipertrofia estética con calistenia avanzada + mochila. Tempo: 3s bajada – 1s subida',
      timeOfDay: 'morning',
      duration: 60,
      tasks: [
        { id: 't1', text: 'Sentadillas con mochila - 4× 10–15 (Drop set)', completed: false },
        { id: 't2', text: 'Zancadas con mochila - 3× 10–12 por pierna', completed: false },
        { id: 't3', text: 'Bulgarian Split Squat - 3× 8–10 por pierna', completed: false },
        { id: 't4', text: 'Hip Thrust con mochila - 4× 12–15', completed: false },
        { id: 't5', text: 'Plancha lateral con mochila - 3× 30–45 s por lado', completed: false },
        { id: 't6', text: 'Elevaciones de piernas con mochila - 3× 10–15', completed: false },
        { id: 't7', text: 'Crunch con mochila - 3× 12–20', completed: false },
      ],
      isActive: true,
    },
    {
      id: '1',
      name: 'Morning Routine',
      description: 'Start the day right',
      timeOfDay: 'morning',
      duration: 30,
      tasks: [
        { id: '1', text: 'Meditation', completed: false },
        { id: '2', text: 'Exercise', completed: false },
        { id: '3', text: 'Healthy breakfast', completed: false },
      ],
      isActive: true,
    },
    {
      id: '2',
      name: 'Evening Wind Down',
      description: 'Prepare for restful sleep',
      timeOfDay: 'evening',
      duration: 45,
      tasks: [
        { id: '1', text: 'Review day', completed: false },
        { id: '2', text: 'Plan tomorrow', completed: false },
        { id: '3', text: 'Reading', completed: false },
      ],
      isActive: true,
    },
  ])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Routine | undefined>()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [viewingRoutine, setViewingRoutine] = useState<Routine | null>(null)

  const handleCreate = (routine: Omit<Routine, 'id'>) => {
    const newRoutine = {
      ...routine,
      id: Date.now().toString(),
    }
    setRoutines([...routines, newRoutine])
    setDialogOpen(false)
  }

  const handleUpdate = (routine: Routine) => {
    setRoutines(routines.map((r) => (r.id === routine.id ? routine : r)))
    setDialogOpen(false)
    setEditingRoutine(undefined)
  }

  const handleDelete = (id: string) => {
    setRoutines(routines.filter((r) => r.id !== id))
  }

  const handleEdit = (routine: Routine) => {
    setEditingRoutine(routine)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingRoutine(undefined)
  }

  const handleImport = (routine: Omit<Routine, 'id'>) => {
    const newRoutine = {
      ...routine,
      id: Date.now().toString(),
    }
    setRoutines([...routines, newRoutine])
    setImportDialogOpen(false)
  }

  const handleView = (routine: Routine) => {
    setViewingRoutine(routine)
    setDetailDialogOpen(true)
  }

  const handleUpdateProgress = (routineId: string, taskId: string, completed: boolean) => {
    setRoutines(
      routines.map((r) => {
        if (r.id === routineId) {
          return {
            ...r,
            tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
          }
        }
        return r
      })
    )
    // Update the viewing routine to reflect changes
    if (viewingRoutine?.id === routineId) {
      setViewingRoutine({
        ...viewingRoutine,
        tasks: viewingRoutine.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
      })
    }
  }

  const handleSave = (routine: Routine | Omit<Routine, 'id'>) => {
    if (editingRoutine) {
      handleUpdate(routine as Routine)
    } else {
      handleCreate(routine as Omit<Routine, 'id'>)
    }
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
              Routines
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Manage your daily routines and habits
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Routine
            </Button>
          </div>
        </div>

        <RoutinesList
          routines={routines}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
        />

        <RoutineDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          onSave={handleSave}
          routine={editingRoutine}
        />

        <ImportRoutineDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          onImport={handleImport}
        />

        <RoutineDetailDialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          routine={viewingRoutine}
          onUpdateProgress={handleUpdateProgress}
        />
      </div>
    </DashboardShell>
  )
}
