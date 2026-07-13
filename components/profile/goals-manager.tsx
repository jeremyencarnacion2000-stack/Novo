'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, CheckCircle, Circle, Target } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Goal {
    id: string
    title: string
    status: 'active' | 'completed' | 'paused'
    timeframe: 'year' | 'quarter' | 'month'
}

export function GoalsManager() {
    const [goals, setGoals] = useState<Goal[]>([])
    const [newGoalTitle, setNewGoalTitle] = useState('')
    const [activeTab, setActiveTab] = useState('year')
    const { toast } = useToast()

    const fetchGoals = async () => {
        try {
            const response = await fetch('/api/goals')
            if (response.ok) {
                setGoals(await response.json())
            }
        } catch (error) {
            console.error('Failed to fetch goals:', error)
        }
    }

    useEffect(() => {
        fetchGoals()
    }, [])

    const handleAddGoal = async () => {
        if (!newGoalTitle.trim()) return

        try {
            const response = await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newGoalTitle,
                    timeframe: activeTab,
                    status: 'active'
                })
            })

            if (response.ok) {
                setNewGoalTitle('')
                fetchGoals()
                toast({ title: 'Goal added' })
            }
        } catch (error) {
            console.error('Failed to add goal:', error)
        }
    }

    const toggleStatus = async (goal: Goal) => {
        const newStatus = goal.status === 'completed' ? 'active' : 'completed'
        try {
            await fetch('/api/goals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: goal.id, status: newStatus })
            })
            fetchGoals()
        } catch (error) {
            console.error('Failed to update goal:', error)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/goals?id=${id}`, { method: 'DELETE' })
            fetchGoals()
        } catch (error) {
            console.error('Failed to delete goal:', error)
        }
    }

    const GoalList = ({ timeframe }: { timeframe: string }) => {
        const filteredGoals = goals.filter(g => g.timeframe === timeframe)

        return (
            <div className="space-y-4 mt-4">
                <div className="flex gap-2">
                    <Input
                        placeholder={`Add a ${timeframe} goal...`}
                        value={newGoalTitle}
                        onChange={(e) => setNewGoalTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
                    />
                    <Button onClick={handleAddGoal}><Plus className="h-4 w-4" /></Button>
                </div>

                <div className="space-y-2">
                    {filteredGoals.map(goal => (
                        <div key={goal.id} className="flex items-center gap-3 p-4 rounded-[20px] bg-foreground/[0.03] border border-foreground/[0.04] hover:bg-foreground/[0.06] transition-colors duration-300 group">
                            <button onClick={() => toggleStatus(goal)}>
                                {goal.status === 'completed' ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground" />
                                )}
                            </button>
                            <span className={`flex-1 ${goal.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                {goal.title}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDelete(goal.id)}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                    {filteredGoals.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No goals set for this {timeframe} yet.
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Goals & Objectives
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="year">Yearly</TabsTrigger>
                        <TabsTrigger value="quarter">Quarterly</TabsTrigger>
                        <TabsTrigger value="month">Monthly</TabsTrigger>
                    </TabsList>
                    <TabsContent value="year"><GoalList timeframe="year" /></TabsContent>
                    <TabsContent value="quarter"><GoalList timeframe="quarter" /></TabsContent>
                    <TabsContent value="month"><GoalList timeframe="month" /></TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
