'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { useGratitudes, useSWRWithConfig } from '@/hooks/use-swr'
import { useToast } from '@/hooks/use-toast'
import { Goal } from '@/types/goal'

// Since there is no useGoals hook, we create a local one.
const useGoals = () => {
  return useSWRWithConfig<Goal[]>('/api/goals')
}

export default function SpiritualPage() {
  const { data: gratitudes, error: gratitudesError, mutate: mutateGratitudes } = useGratitudes()
  const { data: goals, error: goalsError, mutate: mutateGoals } = useGoals()
  const { toast } = useToast()

  const [newGratitude, setNewGratitude] = useState('')
  const [newGoal, setNewGoal] = useState('')

  useEffect(() => {
    if (gratitudesError || goalsError) {
      toast({
        title: 'Error fetching data',
        description: 'Could not fetch spiritual data. Please try again later.',
        variant: 'destructive',
      })
    }
  }, [gratitudesError, goalsError, toast])

  const handleAddGratitude = async () => {
    if (!newGratitude.trim()) return

    try {
      const response = await fetch('/api/gratitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newGratitude }),
      })
      if (response.ok) {
        mutateGratitudes()
        setNewGratitude('')
        toast({
          title: 'Gratitude added',
          description: 'Your gratitude has been added successfully.',
        })
      } else {
        toast({
          title: 'Error adding gratitude',
          description: 'Could not add gratitude. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error adding gratitude:', error)
      toast({
        title: 'Error adding gratitude',
        description: 'Could not add gratitude. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteGratitude = async (id: string) => {
    try {
      const response = await fetch(`/api/gratitudes/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        mutateGratitudes()
        toast({
          title: 'Gratitude deleted',
          description: 'Your gratitude has been deleted successfully.',
        })
      } else {
        toast({
          title: 'Error deleting gratitude',
          description: 'Could not delete gratitude. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting gratitude:', error)
      toast({
        title: 'Error deleting gratitude',
        description: 'Could not delete gratitude. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleAddGoal = async () => {
    if (!newGoal.trim()) return

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newGoal, completed: false }),
      })
      if (response.ok) {
        mutateGoals()
        setNewGoal('')
        toast({
          title: 'Goal added',
          description: 'Your goal has been added successfully.',
        })
      } else {
        toast({
          title: 'Error adding goal',
          description: 'Could not add goal. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error adding goal:', error)
      toast({
        title: 'Error adding goal',
        description: 'Could not add goal. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleToggleGoal = async (goal: any) => {
    try {
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...goal, completed: !goal.completed }),
      })
      if (response.ok) {
        mutateGoals()
        toast({
          title: 'Goal updated',
          description: 'Your goal has been updated successfully.',
        })
      } else {
        toast({
          title: 'Error updating goal',
          description: 'Could not update goal. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating goal:', error)
      toast({
        title: 'Error updating goal',
        description: 'Could not update goal. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteGoal = async (id: string) => {
    try {
      const response = await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        mutateGoals()
        toast({
          title: 'Goal deleted',
          description: 'Your goal has been deleted successfully.',
        })
      } else {
        toast({
          title: 'Error deleting goal',
          description: 'Could not delete goal. Please try again later.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting goal:', error)
      toast({
        title: 'Error deleting goal',
        description: 'Could not delete goal. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Gratitude Journal</CardTitle>
          <CardDescription>What are you thankful for today?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="I'm grateful for..."
              value={newGratitude}
              onChange={(e) => setNewGratitude(e.target.value)}
            />
            <Button onClick={handleAddGratitude}>Add Gratitude</Button>
          </div>
          <div className="mt-6 space-y-2">
            {gratitudes?.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                <p className="text-sm">{g.content}</p>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteGratitude(g.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Spiritual Goals</CardTitle>
          <CardDescription>Set and track your spiritual aspirations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="e.g., Meditate for 10 minutes"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
            />
            <Button onClick={handleAddGoal}>Add Goal</Button>
          </div>
          <div className="mt-6 space-y-2">
            {goals?.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                <span
                  className={`cursor-pointer ${g.completed ? 'text-muted-foreground line-through' : ''}`}
                  onClick={() => handleToggleGoal(g)}
                >
                  {g.title}
                </span>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(g.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}