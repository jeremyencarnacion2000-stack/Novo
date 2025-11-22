'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { Tracker } from '@/types/tracker'
import Link from 'next/link'

export function DashboardHabits() {
  const [habits, setHabits] = useState<Tracker[]>([])

  useEffect(() => {
    const savedTrackers = localStorage.getItem('novo_trackers')
    if (savedTrackers) {
      const allTrackers: Tracker[] = JSON.parse(savedTrackers)
      // Filter only habit type trackers
      setHabits(allTrackers.filter(t => t.type === 'habit').slice(0, 3))
    }
  }, [])

  const handleToggleHabit = (id: string) => {
    const today = new Date().toISOString().split('T')[0]
    const savedTrackers = localStorage.getItem('novo_trackers')
    
    if (savedTrackers) {
      const allTrackers: Tracker[] = JSON.parse(savedTrackers)
      const updatedTrackers = allTrackers.map(tracker => {
        if (tracker.id === id) {
          const hasEntry = tracker.entries.some(e => e.date === today)
          let newEntries
          if (hasEntry) {
            newEntries = tracker.entries.filter(e => e.date !== today)
          } else {
            newEntries = [...tracker.entries, { date: today, value: 1 }]
          }
          return { ...tracker, entries: newEntries }
        }
        return tracker
      })
      
      localStorage.setItem('novo_trackers', JSON.stringify(updatedTrackers))
      setHabits(updatedTrackers.filter(t => t.type === 'habit').slice(0, 3))
    }
  }

  if (habits.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Quick Habits</CardTitle>
        <Link href="/trackers">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {habits.map(habit => {
          const today = new Date().toISOString().split('T')[0]
          const isCompleted = habit.entries.some(e => e.date === today)
          
          return (
            <div key={habit.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 transition-colors">
              <span className="text-sm font-medium">{habit.name}</span>
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="sm"
                className={`h-8 ${isCompleted ? 'bg-green-600 hover:bg-green-700' : ''}`}
                onClick={() => handleToggleHabit(habit.id)}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                ) : (
                  <Circle className="h-4 w-4 mr-1" />
                )}
                {isCompleted ? 'Done' : 'Mark'}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
