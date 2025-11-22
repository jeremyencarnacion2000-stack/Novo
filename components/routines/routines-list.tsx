import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Clock, CheckCircle2, PlayCircle } from 'lucide-react'
import { Routine } from '@/types/routine'

interface RoutinesListProps {
  routines: Routine[]
  onEdit: (routine: Routine) => void
  onDelete: (id: string) => void
  onView: (routine: Routine) => void
}

export function RoutinesList({ routines, onEdit, onDelete, onView }: RoutinesListProps) {
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
        <Card 
          key={routine.id} 
          className="transition-all hover:shadow-md cursor-pointer"
          onClick={() => onView(routine)}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">{routine.name}</CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {routine.description}
                </CardDescription>
              </div>
              <Badge variant={routine.isActive ? 'default' : 'secondary'} className="shrink-0">
                {routine.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{routine.duration} min</span>
                </div>
                <Badge variant="outline" className="capitalize">
                  {routine.timeOfDay}
                </Badge>
              </div>

              <div className="space-y-2">
                {routine.tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{task.text}</span>
                  </div>
                ))}
                {routine.tasks.length > 3 && (
                  <p className="text-xs text-muted-foreground pl-5">
                    +{routine.tasks.length - 3} more {routine.tasks.length - 3 === 1 ? 'task' : 'tasks'}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(routine)
                  }}
                >
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(routine.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
