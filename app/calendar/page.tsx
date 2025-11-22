'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format, isSameDay, parseISO } from 'date-fns'
import { CheckSquare, KanbanSquare, ListChecks, GraduationCap, RefreshCw } from 'lucide-react'
import { DataIntegrator, CalendarEvent } from '@/lib/data-integrator'
import { Button } from '@/components/ui/button'
import { DashboardShell } from '@/components/dashboard-shell'

export default function CalendarPage() {
  const { data: session } = useSession()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [routines, setRoutines] = useState<any[]>([])

  const loadEvents = async () => {
    if (session?.user?.id) {
      const allEvents = await DataIntegrator.getCalendarEvents(session.user.id)
      setEvents(allEvents)
      setRoutines(JSON.parse(localStorage.getItem(`user-${session.user.id}-novo_routines`) || '[]'))
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      loadEvents()
    }
  }, [session?.user?.id])

  const getEventsForDate = (date: Date) => {
    const dayEvents = events.filter(e => isSameDay(e.date, date))

    // Add routines for every day (mocking daily recurrence for now)
    routines.filter((r: any) => r.isActive).forEach((r: any) => {
      dayEvents.push({
        id: `routine-${r.id}`,
        title: `Routine: ${r.name}`,
        date: date,
        type: 'routine',
        completed: false
      })
    })

    return dayEvents
  }

  const getEventColor = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "project":
        return "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800"
      case "school":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"
      case "routine":
        return "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800"
      default:
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700"
    }
  }

  const selectedDateEvents = date ? getEventsForDate(date) : []

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <Button variant="outline" size="sm" onClick={loadEvents}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </Button>
          </div>
          <p className="text-muted-foreground">
            View your schedule, deadlines, and routines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
          <Card className="h-fit">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border"
                modifiers={{
                  hasEvent: (day) => getEventsForDate(day).length > 0
                }}
                modifiersStyles={{
                  hasEvent: { fontWeight: 'bold', textDecoration: 'underline', color: 'var(--primary)' }
                }}
              />
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle>
                Schedule for {date ? format(date, 'MMMM d, yyyy') : 'Selected Date'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {selectedDateEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <p>No events scheduled for this day.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDateEvents.map((event, index) => (
                      <div
                        key={`${event.id}-${index}`}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${getEventColor(event.type)}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full bg-background/50`}>
                            {event.type === 'project' && <KanbanSquare className="h-4 w-4" />}
                            {event.type === 'routine' && <ListChecks className="h-4 w-4" />}
                            {event.type === 'school' && <GraduationCap className="h-4 w-4" />}
                            {event.type === 'task' && <CheckSquare className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className={`font-medium ${event.completed ? 'line-through opacity-70' : ''}`}>
                              {event.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs opacity-80">
                              <span className="capitalize">{event.type}</span>
                              {event.metadata?.type ? <span>• {event.metadata.type as string}</span> : null}
                            </div>
                          </div>
                        </div>
                        {event.completed && (
                          <Badge variant="secondary" className="bg-background/50">Completed</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
