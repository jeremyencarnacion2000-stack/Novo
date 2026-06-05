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
import { NovoSkeleton } from "@/components/ui/NovoSkeleton"
import { NovoEmptyState } from "@/components/ui/NovoEmptyState"
import { AnimatePresence, motion } from "framer-motion"

export default function CalendarClient() {
  const { data: session } = useSession()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isLoading, setIsLoading] = useState(true)

  // Load events on mount and listen to voice execution events
  useEffect(() => {
    if (session?.user?.id) {
      loadEvents()

      const handleVoiceCommand = (e: any) => {
        const action = e.detail?.result?.action
        if (action === "create_event") {
          loadEvents()
        }
      }

      window.addEventListener("voice-command-executed", handleVoiceCommand)
      return () => {
        window.removeEventListener("voice-command-executed", handleVoiceCommand)
      }
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

  // Pre-calculate date map to optimize lookups to O(1)
  const eventsByDate = React.useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events.forEach(event => {
      if (!event.date) return
      const dateObj = typeof event.date === 'string' ? parseISO(event.date) : new Date(event.date)
      const dateStr = format(dateObj, 'yyyy-MM-dd')
      if (!map[dateStr]) {
        map[dateStr] = []
      }
      map[dateStr].push(event)
    })
    return map
  }, [events])

  // Memoize events for selected date
  const selectedDateEvents = React.useMemo(() => {
    if (!selectedDate) return []
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    return eventsByDate[dateStr] || []
  }, [selectedDate, eventsByDate])

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

  // Custom DayButton component with cognitive load tokens
  const CustomDayButton = React.useMemo(() => {
    return (props: any) => {
      const { day, modifiers, ...buttonProps } = props
      const dateObj = day.date
      const dateStr = format(dateObj, 'yyyy-MM-dd')
      const dayEvents = eventsByDate[dateStr] || []

      // Calculate total cognitive load based on type weights
      const totalLoad = dayEvents.reduce((acc, event) => {
        switch (event.type) {
          case 'project': return acc + 3
          case 'school': return acc + 2
          case 'routine': return acc + 2
          case 'habit': return acc + 1
          case 'google': return acc + 1
          default: return acc + 1
        }
      }, 0)

      let loadStyle = ""
      if (totalLoad >= 5) {
        loadStyle = "border-b-2 border-b-red-500/40 bg-red-500/5"
      } else if (totalLoad >= 3) {
        loadStyle = "border-b-2 border-b-amber-500/40 bg-amber-500/5"
      } else if (totalLoad > 0) {
        loadStyle = "border-b-2 border-b-primary/20 bg-primary/5"
      }

      const isSelected = modifiers.selected
      const isToday = modifiers.today
      const isDisabled = modifiers.disabled

      return (
        <button
          {...buttonProps}
          className={`
            relative w-10 h-10 flex flex-col items-center justify-center rounded-lg text-sm transition-all duration-150 select-none
            hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40
            ${buttonProps.className || ""}
            ${isSelected ? "bg-primary text-black font-semibold hover:bg-primary/90" : ""}
            ${isToday && !isSelected ? "text-primary border border-primary/30" : ""}
            ${isDisabled ? "opacity-30 cursor-not-allowed" : ""}
            ${loadStyle}
          `}
        >
          <span className="relative z-10">{props.children}</span>
          
          {/* Micro-tokens representation */}
          {dayEvents.length > 0 && !isSelected && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 pointer-events-none">
              {dayEvents.slice(0, 3).map((event, idx) => {
                let dotColor = "bg-gray-400"
                switch (event.type) {
                  case "project": dotColor = "bg-[#6EE7B7]"; break
                  case "school": dotColor = "bg-[#C4B5FD]"; break
                  case "routine": dotColor = "bg-[#FDBA74]"; break
                  case "habit": dotColor = "bg-[#5EEAD4]"; break
                  case "google": dotColor = "bg-[#A5B4FC]"; break
                }
                return (
                  <span 
                    key={event.id || idx} 
                    className={`w-1 h-1 rounded-full ${dotColor} opacity-90`} 
                  />
                )
              })}
              {dayEvents.length > 3 && (
                <span className="w-1 h-1 rounded-full bg-white opacity-95 animate-pulse" />
              )}
            </div>
          )}
        </button>
      )
    }
  }, [eventsByDate])

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
              components={{
                DayButton: CustomDayButton
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
            <ScrollArea className="h-[400px] pr-4 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="calendar-skeletons"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <NovoSkeleton variant="rect" height={52} className="w-full" />
                    <NovoSkeleton variant="rect" height={52} className="w-full" />
                    <NovoSkeleton variant="rect" height={52} className="w-full" />
                  </motion.div>
                ) : selectedDateEvents.length > 0 ? (
                  <motion.div
                    key="calendar-events"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
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
                  </motion.div>
                ) : (
                  <NovoEmptyState
                    key="calendar-empty"
                    message="Your cognitive slate is clean. Enjoy the open space or command a macro-focus block."
                    actionLabel="Breathe"
                    onAction={() => window.dispatchEvent(new CustomEvent('cognitive:start-breathing'))}
                    className="py-10 min-h-[350px] w-full"
                  />
                )}
              </AnimatePresence>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}