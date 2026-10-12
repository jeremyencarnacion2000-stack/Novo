'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Upload } from 'lucide-react'
import { RoutinesList } from '@/components/routines/routines-list'
import { RoutineDialog } from '@/components/routines/routine-dialog'
import { ImportRoutineDialog } from '@/components/routines/import-routine-dialog'
import { Routine } from '@/types/routine'
import { RoutineDetailDialog } from '@/components/routines/routine-detail-dialog'
import { useRoutines, ROUTINE_STATS_KEY } from '@/hooks/use-swr'
import { useSWRConfig } from 'swr'
import { useToast } from '@/hooks/use-toast'
import { RoutineStatsCard } from '@/components/routines/routine-stats'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import { useTranslation } from '@/lib/i18n'
import { createClientIdempotencyKey } from '@/lib/client-idempotency'

export default function RoutinesPage() {
  const { data: routines, error, isLoading, mutate } = useRoutines()
  const { mutate: globalMutate } = useSWRConfig()
  const { toast } = useToast()
  const { bioState } = useCognitiveEngine()
  const { language } = useTranslation()
  const isReducedCapacity = bioState.phase === 'SYNAPTIC_FATIGUE' || bioState.phase === 'REDUCED_CAPACITY_MODE'
  const copy = language === 'es'
    ? { title: 'Tus rutinas', description: 'Pequeños hábitos que ayudan a Novo a cuidar tu día.', import: 'Importar rutina', add: 'Añadir rutina', simplify: 'Mostrando solo lo esencial mientras recuperas energía.' }
    : { title: 'Your routines', description: 'Small habits that help Novo take care of your day.', import: 'Import routine', add: 'Add routine', simplify: 'Showing only the essentials while you recover your energy.' }

  useEffect(() => {
    if (error) {
      toast({
            title: language === 'es' ? 'No pudimos cargar tus rutinas' : 'We could not load your routines',
            description: language === 'es' ? 'Inténtalo de nuevo en unos instantes.' : 'Please try again in a moment.',
        variant: 'destructive',
      })
    }
  }, [error, toast])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Routine | undefined>()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [viewingRoutine, setViewingRoutine] = useState<Routine | null>(null)
  const createIntentRef = useRef<{ fingerprint: string; key: string } | null>(null)
  const importIntentKey = useRef<string | null>(null)

  const handleCreate = async (routine: Omit<Routine, 'id'>) => {
    const fingerprint = JSON.stringify(routine)
    const previousIntent = createIntentRef.current
    const intent = previousIntent?.fingerprint === fingerprint
      ? previousIntent
      : { fingerprint, key: createClientIdempotencyKey() }
    createIntentRef.current = intent
    try {
      const response = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intent.key },
        body: JSON.stringify(routine),
      })
      if (response.ok) {
        createIntentRef.current = null
        mutate()
        globalMutate(ROUTINE_STATS_KEY)
        globalMutate('/api/analytics')
        setDialogOpen(false)
        toast({
          title: 'Routine created',
          description: 'Your new routine has been created successfully.',
        })
      } else {
        toast({
          title: 'Error creating routine',
          description: 'Could not create routine. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error creating routine:', error)
      toast({
        title: 'Error creating routine',
        description: 'Could not create routine. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleUpdate = async (routine: Routine) => {
    try {
      const response = await fetch(`/api/routines/${routine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routine),
      })
      if (response.ok) {
        mutate()
        globalMutate(ROUTINE_STATS_KEY)
        globalMutate('/api/analytics')
        setDialogOpen(false)
        setEditingRoutine(undefined)
        toast({
          title: 'Routine updated',
          description: 'Your routine has been updated successfully.',
        })
      } else {
        toast({
          title: 'Error updating routine',
          description: 'Could not update routine. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating routine:', error)
      toast({
        title: 'Error updating routine',
        description: 'Could not update routine. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/routines/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        mutate()
        globalMutate(ROUTINE_STATS_KEY)
        globalMutate('/api/analytics')
        toast({
          title: 'Routine deleted',
          description: 'Your routine has been deleted successfully.',
        })
      } else {
        toast({
          title: 'Error deleting routine',
          description: 'Could not delete routine. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting routine:', error)
      toast({
        title: 'Error deleting routine',
        description: 'Could not delete routine. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (routine: Routine) => {
    setEditingRoutine(routine)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingRoutine(undefined)
  }

  const handleImport = async (payload: any) => {
    const intentKey = importIntentKey.current || createClientIdempotencyKey()
    importIntentKey.current = intentKey
    try {
      const response = await fetch('/api/routines/import-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intentKey },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        mutate()
        globalMutate(ROUTINE_STATS_KEY)
        if (importIntentKey.current === intentKey) importIntentKey.current = null
        toast({
          title: 'Import successful',
          description: 'Your routines and data have been imported successfully.',
        })
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Import error details:', errorData)
        toast({
          title: 'Error importing data',
          description: errorData.error || 'Could not import data. Please try again later.',
          variant: 'destructive',
        })
        return false
      }
    } catch (error) {
      console.error('Error importing data:', error)
      toast({
        title: 'Error importing data',
        description: 'Could not import data. Please try again later.',
        variant: 'destructive',
      })
      return false
    }
  }

  const handleView = (routine: Routine) => {
    setViewingRoutine(routine)
    setDetailDialogOpen(true)
  }

  const handleUpdateProgress = async (routineId: string, taskId: string, completed: boolean) => {
    const optimisticRoutines = routines?.map((r) => {
      if (r.id === routineId) {
        return {
          ...r,
          tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
        }
      }
      return r
    })

    if (optimisticRoutines) {
      mutate(optimisticRoutines, false)
    }

    // Update the viewing routine to reflect changes
    if (viewingRoutine?.id === routineId) {
      setViewingRoutine({
        ...viewingRoutine,
        tasks: viewingRoutine.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
      })
    }

    // Persist to API
    const routine = optimisticRoutines?.find(r => r.id === routineId)
    if (routine) {
      try {
        const response = await fetch(`/api/routines/${routineId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(routine),
        })
        if (!response.ok) {
          throw new Error("Failed to update routine")
        }
        mutate()
        globalMutate(ROUTINE_STATS_KEY)
        globalMutate('/api/analytics')
      } catch (error) {
        console.error('Error updating routine progress:', error)
        toast({
          title: 'Error updating routine progress',
          description: 'Could not update routine progress. Please try again later.',
          variant: 'destructive',
        })
        mutate() // Revert optimistic update
      }
    }
  }

  const handleSave = (routine: Routine | Omit<Routine, 'id'>) => {
    if (editingRoutine) {
      handleUpdate(routine as Routine)
    } else {
      handleCreate(routine as Omit<Routine, 'id'>)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-28 bg-foreground/5 rounded-2xl" />
            <div className="h-4 w-52 bg-foreground/[0.03] rounded-xl" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-foreground/5 rounded-xl" />
            <div className="h-9 w-32 bg-foreground/[0.06] rounded-xl" />
          </div>
        </div>
        <div className="h-20 w-full bg-foreground/[0.03] rounded-2xl border border-foreground/5" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-36 bg-foreground/[0.03] rounded-3xl border border-foreground/5" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <ScrollReveal>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">{copy.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {copy.description}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {!isReducedCapacity && <Button
            onClick={() => {
              importIntentKey.current = null
              setImportDialogOpen(true)
            }}
            data-flip-from="btn-import-routine"
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Upload data-shared-item="icon" className="h-4 w-4 mr-2" />
            <span data-shared-item="text">{copy.import}</span>
          </Button>}
          <Button
            onClick={() => setDialogOpen(true)}
            data-flip-from="btn-new-routine"
            className="w-full sm:w-auto"
          >
            <Plus data-shared-item="icon" className="h-4 w-4 mr-2" />
            <span data-shared-item="text">{copy.add}</span>
          </Button>
        </div>
      </div>
      {isReducedCapacity && <p className="text-xs text-muted-foreground" role="status">{copy.simplify}</p>}
      </ScrollReveal>

      {/* Stats Section */}
      <ScrollReveal delay={0.05}>
        <RoutineStatsCard />
      </ScrollReveal>

      <RoutinesList
        routines={routines || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        activeTransitionId={viewingRoutine?.id || editingRoutine?.id}
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
  )
}
