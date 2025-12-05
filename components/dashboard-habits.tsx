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
    fetch('/api/trackers')
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        // Filter only habit type trackers
        const allTrackers = ok && Array.isArray(data) ? data : []
        const trackersArray = Array.isArray(allTrackers) ? allTrackers.filter((t) => t && typeof t === 'object') : []
        setHabits(trackersArray.filter(t => t.type === 'habit').slice(0, 3))
      })
      .catch(console.error)
  }, [])

  const handleToggleHabit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0]
    const hasEntry = habits.find(h => h.id === id)?.entries ? (Array.isArray(habits.find(h => h.id === id)?.entries) ? habits.find(h => h.id === id)?.entries : []).some(e => e.date === today) : false

    try {
      if (hasEntry) {
        // Delete entry
        await fetch(`/api/trackers/${id}/entries?date=${today}`, { method: 'DELETE' })
      } else {
        // Add entry
        await fetch(`/api/trackers/${id}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today, value: 1 })
        })
      }

      // Refresh habits
      const res = await fetch('/api/trackers')
      const data = await res.json()
      const allTrackers = res.ok && Array.isArray(data) ? data : []
      const trackersArray = Array.isArray(allTrackers) ? allTrackers.filter((t) => t && typeof t === 'object') : []
      setHabits(trackersArray.filter(t => t.type === 'habit').slice(0, 3))
    } catch (error) {
      console.error('Failed to toggle habit:', error)
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
          const isCompleted = Array.isArray(habit.entries) ? habit.entries.some(e => e.date === today) : false
          
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
