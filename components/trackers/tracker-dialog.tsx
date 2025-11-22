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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tracker } from '@/types/tracker'

interface TrackerDialogProps {
  open: boolean
  onClose: () => void
  onSave: (tracker: Tracker | Omit<Tracker, 'id'>) => void
  tracker?: Tracker
}

export function TrackerDialog({ open, onClose, onSave, tracker }: TrackerDialogProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'habit' | 'metric'>('habit')
  const [unit, setUnit] = useState('')
  const [goal, setGoal] = useState(1)

  useEffect(() => {
    if (tracker) {
      setName(tracker.name)
      setType(tracker.type)
      setUnit(tracker.unit)
      setGoal(tracker.goal)
    } else {
      setName('')
      setType('habit')
      setUnit('')
      setGoal(1)
    }
  }, [tracker, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trackerData = {
      name,
      type,
      unit,
      goal,
      entries: tracker?.entries || [],
    }

    if (tracker) {
      onSave({ ...trackerData, id: tracker.id })
    } else {
      onSave(trackerData)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{tracker ? 'Edit Tracker' : 'Create New Tracker'}</DialogTitle>
            <DialogDescription>
              {tracker
                ? 'Update your tracker settings'
                : 'Set up a new habit or metric to track'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Exercise, Water Intake, etc."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="habit">Habit (Yes/No)</SelectItem>
                  <SelectItem value="metric">Metric (Measurable)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {type === 'habit'
                  ? 'Track completion of daily habits'
                  : 'Measure quantities like steps, pages read, etc.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={
                  type === 'habit'
                    ? 'sessions, times, etc.'
                    : 'glasses, pages, steps, etc.'
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal">
                {type === 'habit' ? 'Weekly Goal' : 'Daily Goal'}
              </Label>
              <Input
                id="goal"
                type="number"
                value={goal}
                onChange={(e) => setGoal(Number(e.target.value))}
                min={1}
                required
              />
              <p className="text-xs text-muted-foreground">
                {type === 'habit'
                  ? 'How many times per week?'
                  : `Target ${unit} per day`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{tracker ? 'Update' : 'Create'} Tracker</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
