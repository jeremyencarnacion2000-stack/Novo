"use client"

import React, { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { DayPicker } from "react-day-picker"
import { format, isSameDay, parseISO } from "date-fns"
import { DataIntegrator, type CalendarEvent } from "@/lib/data-integrator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

import { Loader2, Calendar as CalendarIcon } from "lucide-react"
import "react-day-picker/dist/style.css"

export default function CalendarClient() {
  const { data: session } = useSession()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.id) {
      loadEvents()
    }
  }, [session?.user?.id])

  const loadEvents = async () => {
    if (!session?.user?.id) return
    setIsLoading(true)
    try {
      const allEvents = await DataIntegrator.getCalendarEvents(session.user.id)
      setEvents(Array.isArray(allEvents) ? allEvents : [])
    } catch (error) {
      console.error("Failed to load calendar events", error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedDateEvents = events.filter((event) =>
    selectedDate && isSameDay(event.date, selectedDate)
  )

  const getEventColor = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "project": return "bg-[#6EE7B7]/10 text-[#6EE7B7] border-[#6EE7B7]/20"
      case "school": return "bg-[#C4B5FD]/10 text-[#C4B5FD] border-[#C4B5FD]/20"
      case "routine": return "bg-[#FDBA74]/10 text-[#FDBA74] border-[#FDBA74]/20"
      case "habit": return "bg-[#5EEAD4]/10 text-[#5EEAD4] border-[#5EEAD4]/20"
      case "google": return "bg-[#A5B4FC]/10 text-[#A5B4FC] border-[#A5B4FC]/20"
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">View your schedule and upcoming events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-8 lg:col-span-9">
          <CardContent className="p-6 flex justify-center">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="p-3"
              modifiers={{
                hasEvent: (date) => events.some((event) => isSameDay(event.date, date))
              }}
              modifiersStyles={{
                hasEvent: { fontWeight: "bold", textDecoration: "underline" }
              }}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-4 lg:col-span-3 h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : selectedDateEvents.length > 0 ? (
                <div className="space-y-4">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm font-medium ${event.completed ? "line-through text-muted-foreground" : ""}`}>
                          {event.title}
                        </span>
                        <Badge variant="outline" className={`text-[10px] capitalize ${getEventColor(event.type)}`}>
                          {event.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No events for this day
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}