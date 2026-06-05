import { Card, CardContent } from '@/components/ui/card'
import { PlayCircle } from 'lucide-react'
import { Routine } from '@/types/routine'
import { RoutineCard } from './routine-card'

interface RoutinesListProps {
  routines: Routine[]
  onEdit: (routine: Routine) => void
  onDelete: (id: string) => void
  onView: (routine: Routine) => void
  activeTransitionId?: string
}

export function RoutinesList({ routines, onEdit, onDelete, onView, activeTransitionId }: RoutinesListProps) {
  if (routines.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <PlayCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center font-medium mb-2">
            No routines yet
          </p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Create your first routine to build consistent habits and boost your productivity
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {routines.map((routine) => (
        <RoutineCard
          key={routine.id}
          routine={routine}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          isActiveTransition={activeTransitionId === routine.id}
        />
      ))}
    </div>
  )
}
