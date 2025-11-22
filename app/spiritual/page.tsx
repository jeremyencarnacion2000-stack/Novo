'use client'

import { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Plus, Heart, Target, Calendar, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface Gratitude {
  id: string
  text: string
  date: string
}

interface Goal {
  id: string
  text: string
  category: string
  progress: number
}

export default function SpiritualPage() {
  const { toast } = useToast()
  const [gratitudes, setGratitudes] = useState<Gratitude[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [newGratitude, setNewGratitude] = useState('')
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false)
  const [newGoal, setNewGoal] = useState({ text: '', category: 'spiritual' })

  useEffect(() => {
    const savedGratitudes = localStorage.getItem('novo_gratitudes')
    const savedGoals = localStorage.getItem('novo_goals')
    
    if (savedGratitudes) {
      setGratitudes(JSON.parse(savedGratitudes))
    } else {
      setGratitudes([
        { id: '1', text: 'Health and energy to pursue my goals', date: new Date().toISOString().split('T')[0] },
      ])
    }
    
    if (savedGoals) {
      setGoals(JSON.parse(savedGoals))
    } else {
      setGoals([
        { id: '1', text: 'Build consistent meditation practice', category: 'spiritual', progress: 60 },
        { id: '2', text: 'Complete personal development course', category: 'growth', progress: 40 },
      ])
    }
  }, [])

  useEffect(() => {
    if (gratitudes.length > 0) {
      localStorage.setItem('novo_gratitudes', JSON.stringify(gratitudes))
    }
  }, [gratitudes])

  useEffect(() => {
    if (goals.length > 0) {
      localStorage.setItem('novo_goals', JSON.stringify(goals))
    }
  }, [goals])

  const handleAddGratitude = () => {
    if (!newGratitude.trim()) {
      toast({ title: 'Error', description: 'Please enter your gratitude', variant: 'destructive' })
      return
    }
    
    const gratitude: Gratitude = {
      id: Date.now().toString(),
      text: newGratitude,
      date: new Date().toISOString().split('T')[0]
    }
    
    setGratitudes([gratitude, ...gratitudes])
    setNewGratitude('')
    toast({ title: 'Gratitude added' })
  }

  const handleAddGoal = () => {
    if (!newGoal.text.trim()) {
      toast({ title: 'Error', description: 'Please enter a goal', variant: 'destructive' })
      return
    }
    
    const goal: Goal = {
      id: Date.now().toString(),
      text: newGoal.text,
      category: newGoal.category,
      progress: 0
    }
    
    setGoals([...goals, goal])
    setNewGoal({ text: '', category: 'spiritual' })
    setIsGoalDialogOpen(false)
    toast({ title: 'Goal added successfully' })
  }

  const handleUpdateProgress = (id: string, increment: number) => {
    setGoals(goals.map(goal => {
      if (goal.id === id) {
        const newProgress = Math.max(0, Math.min(100, goal.progress + increment))
        return { ...goal, progress: newProgress }
      }
      return goal
    }))
  }

  const handleDeleteGratitude = (id: string) => {
    setGratitudes(gratitudes.filter(g => g.id !== id))
  }

  const handleDeleteGoal = (id: string) => {
    setGoals(goals.filter(g => g.id !== id))
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Spiritual & Reflection</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Daily prayers, gratitude, and long-term goals
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Daily Gratitude
              </CardTitle>
              <CardDescription>What are you grateful for today?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea 
                  placeholder="Write your gratitude..."
                  className="min-h-[100px]"
                  value={newGratitude}
                  onChange={(e) => setNewGratitude(e.target.value)}
                />
                <Button className="w-full" onClick={handleAddGratitude}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Gratitude
                </Button>
                <div className="space-y-2 pt-4 border-t">
                  {gratitudes.map((item) => (
                    <div key={item.id} className="p-3 bg-muted rounded-lg relative group">
                      <p className="text-sm pr-8">{item.text}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {item.date}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteGratitude(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Long-term Goals
              </CardTitle>
              <CardDescription>Track your personal growth objectives</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      New Goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Goal</DialogTitle>
                      <DialogDescription>Set a new long-term goal</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="goal-text">Goal</Label>
                        <Textarea
                          id="goal-text"
                          value={newGoal.text}
                          onChange={(e) => setNewGoal({ ...newGoal, text: e.target.value })}
                          placeholder="What do you want to achieve?"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="goal-category">Category</Label>
                        <Input
                          id="goal-category"
                          value={newGoal.category}
                          onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                          placeholder="e.g. spiritual, growth, health"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddGoal}>Add Goal</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <div className="space-y-3">
                  {goals.map((goal) => (
                    <div key={goal.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium flex-1">{goal.text}</p>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {goal.category}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-6 px-2 text-xs"
                              onClick={() => handleUpdateProgress(goal.id, -10)}
                            >
                              -10%
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-6 px-2 text-xs"
                              onClick={() => handleUpdateProgress(goal.id, 10)}
                            >
                              +10%
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">{goal.progress}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Review</CardTitle>
            <CardDescription>Reflect on your week and plan ahead</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">What went well this week?</label>
                <Textarea placeholder="Wins and achievements..." className="min-h-[80px]" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">What could be improved?</label>
                <Textarea placeholder="Areas for growth..." className="min-h-[80px]" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Focus for next week</label>
                <Textarea placeholder="Priorities and intentions..." className="min-h-[80px]" />
              </div>
              <Button className="w-full">Save Weekly Review</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
