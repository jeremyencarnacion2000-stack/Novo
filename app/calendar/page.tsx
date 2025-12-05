'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { DashboardShell } from '@/components/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Setup date-fns localizer
const locales = {
  'en-US': require('date-fns/locale/en-US'),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: string;
  color: string;
  metadata?: any;
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Source filters
  const [filters, setFilters] = useState({
    google: true,
    checklist: true,
    project: true,
    school: true,
    routine: true,
    habit: true,
    business: true,
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate range based on current view
      const start = startOfMonth(currentDate);
      const end = endOfMonth(addMonths(currentDate, 1));

      // Get enabled sources
      const enabledSources = Object.entries(filters)
        .filter(([_, enabled]) => enabled)
        .map(([source]) => source);

      const response = await fetch(
        `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}&sources=${enabledSources.join(',')}`
      );

      if (!response.ok) throw new Error('Failed to fetch events');

      const { events: fetchedEvents } = await response.json();

      // Convert date strings to Date objects
      const parsedEvents = fetchedEvents.map((event: any) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      }));

      setEvents(parsedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentDate, filters, toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const toggleFilter = (source: string) => {
    setFilters(prev => ({
      ...prev,
      [source]: !prev[source as keyof typeof prev],
    }));
  };

  // Custom event style
  const eventStyleGetter = (event: CalendarEvent) => {
    return {
      style: {
        backgroundColor: event.color,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  const sourceLabels = {
    google: { label: 'Google Calendar', icon: '📅', color: '#3b82f6' },
    checklist: { label: 'Daily Tasks', icon: '✓', color: '#0ea5e9' },
    project: { label: 'Projects', icon: '📋', color: '#10b981' },
    school: { label: 'School', icon: '🎓', color: '#8b5cf6' },
    routine: { label: 'Routines', icon: '🔄', color: '#f97316' },
    habit: { label: 'Habits', icon: '✨', color: '#14b8a6' },
    business: { label: 'Business', icon: '💼', color: '#ef4444' },
  };

  if (loading && events.length === 0) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground mt-1">
              Unified view of all your events and tasks
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Show Events From</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(sourceLabels).map(([key, { label, icon, color }]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={filters[key as keyof typeof filters]}
                    onCheckedChange={() => toggleFilter(key)}
                  />
                  <label
                    htmlFor={key}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card>
          <CardContent className="pt-6">
            <div style={{ height: '600px' }}>
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                view={view}
                onView={handleViewChange}
                date={currentDate}
                onNavigate={handleNavigate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                popup
              />
            </div>
          </CardContent>
        </Card>

        {/* Event Details Modal (Simple version) */}
        {selectedEvent && (
          <Card className="fixed bottom-4 right-4 w-96 shadow-lg z-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{selectedEvent.title}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEvent(null)}
                >
                  ✕
                </Button>
              </div>
              <CardDescription>
                {format(selectedEvent.start, 'PPP')}
                {!selectedEvent.allDay && ` at ${format(selectedEvent.start, 'p')}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge style={{ backgroundColor: selectedEvent.color }}>
                    {sourceLabels[selectedEvent.source as keyof typeof sourceLabels]?.icon || '📌'}
                    {' '}
                    {sourceLabels[selectedEvent.source as keyof typeof sourceLabels]?.label || selectedEvent.source}
                  </Badge>
                </div>
                {selectedEvent.metadata?.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.metadata.description}
                  </p>
                )}
                {selectedEvent.metadata?.priority && (
                  <div className="text-sm">
                    <span className="font-medium">Priority:</span> {selectedEvent.metadata.priority}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
