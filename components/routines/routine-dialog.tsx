'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Plus, X } from 'lucide-react'
import { Routine, RoutineTask } from '@/types/routine'

interface RoutineDialogProps {
  open: boolean
  onClose: () => void
  onSave: (routine: Routine | Omit<Routine, 'id'>) => void
  routine?: Routine
}

export function RoutineDialog({ open, onClose, onSave, routine }: RoutineDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('morning')
  const [duration, setDuration] = useState(30)
  const [tasks, setTasks] = useState<RoutineTask[]>([])
  const [isActive, setIsActive] = useState(true)
  const [newTaskText, setNewTaskText] = useState('')

  useEffect(() => {
    if (routine) {
      setName(routine.name)
      setDescription(routine.description)
      setTimeOfDay(routine.timeOfDay)
      setDuration(routine.duration)
      setTasks(routine.tasks)
      setIsActive(routine.isActive)
    } else {
      // Reset form
      setName('')
      setDescription('')
      setTimeOfDay('morning')
      setDuration(30)
      setTasks([])
      setIsActive(true)
    }
  }, [routine, open])

  const handleAddTask = () => {
    if (newTaskText.trim()) {
      setTasks([
        ...tasks,
        {
          id: Date.now().toString(),
          text: newTaskText,
          completed: false,
        },
      ])
      setNewTaskText('')
    }
  }

  const handleRemoveTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const routineData = {
      name,
      description,
      timeOfDay,
      duration,
      tasks,
      isActive,
    }

    if (routine) {
      onSave({ ...routineData, id: routine.id })
    } else {
      onSave(routineData)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{routine ? 'Edit Routine' : 'Create New Routine'}</DialogTitle>
            <DialogDescription>
              {routine
                ? 'Update your routine details and tasks'
                : 'Set up a new routine with tasks to complete'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Morning Routine"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your routine"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timeOfDay">Time of Day</Label>
                <Select value={timeOfDay} onValueChange={(value: any) => setTimeOfDay(value)}>
                  <SelectTrigger id="timeOfDay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="anytime">Anytime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  min={5}
                  max={300}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  Enable this routine to appear in your daily schedule
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="space-y-4">
              <Label>Tasks</Label>
              <div className="flex gap-2">
                <Input
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Add a task..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTask()
                    }
                  }}
                />
                <Button type="button" size="icon" onClick={handleAddTask}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {tasks.length > 0 && (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-md border p-3"
                    >
                      <span className="text-sm">{task.text}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTask(task.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{routine ? 'Update' : 'Create'} Routine</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
