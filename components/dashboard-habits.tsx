'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { Tracker } from '@/types/tracker'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { eventBus } from '@/lib/events/event-bus'
import { useTrackers } from '@/hooks/use-swr'
import { sileo } from '@/lib/sileo-bell'

export const DashboardHabits = React.memo(function DashboardHabits() {
  const { data, mutate } = useTrackers()
  const habits: Tracker[] = Array.isArray(data) ? data.filter((t: any) => t?.type === 'habit').slice(0, 3) : []

  const handleToggleHabit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0]
    const habit = habits.find(h => h.id === id)
    const hasEntry = habit?.entries ? (Array.isArray(habit.entries) ? habit.entries : []).some(e => e.date === today) : false

    try {
      if (hasEntry) {
        await fetch(`/api/trackers/${id}/entries?date=${today}`, { method: 'DELETE' })
      } else {
        await fetch(`/api/trackers/${id}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today, value: 1 })
        })
        eventBus.dispatch('HabitCompleted', { habitId: id, habitName: habit?.name, type: 'habit' })
        sileo.success({
          title: 'Habit Completed',
          description: habit?.name ? `${habit.name} marked as done for today.` : undefined,
          duration: 4000,
        })
      }
      mutate() // revalidate via SWR — no manual re-fetch needed
    } catch (error) {
      console.error('Failed to toggle habit:', error)
    }
  }

  if (habits.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="subtitle-technical">Quick Habits</CardTitle>
        <Link href="/trackers">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-all duration-300">
            <ArrowRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {habits.map(habit => {
          const today = new Date().toISOString().split('T')[0]
          const isCompleted = Array.isArray(habit.entries) ? habit.entries.some(e => e.date === today) : false

          return (
            <div key={habit.id} className="flex items-center justify-between p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.04] hover:bg-foreground/[0.08] transition-all duration-300 group">
              <span className="text-xs font-semibold opacity-70 group-hover:opacity-100 transition-opacity">{habit.name}</span>
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 rounded-xl px-4 transition-all duration-300",
                  isCompleted 
                    ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" 
                    : "bg-foreground/5 border-foreground/5 hover:bg-foreground/10 hover:border-foreground/10"
                )}
                onClick={() => handleToggleHabit(habit.id)}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                ) : (
                  <Circle className="h-3.5 w-3.5 mr-2" />
                )}
                <span className="text-[10px] font-black uppercase tracking-wider">{isCompleted ? 'Done' : 'Mark'}</span>
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
})
