'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, X, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CalendarToolbar } from '@/components/calendar/calendar-toolbar';
import { CalendarSidebar } from '@/components/calendar/calendar-sidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { enUS } from 'date-fns/locale';

// Setup date-fns localizer
const locales = {
  'en-US': enUS,
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: new Date(),
    startTime: '09:00',
    endTime: '10:00',
    source: 'google',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);

  // Fetch contacts when searching
  useEffect(() => {
    const searchContacts = async () => {
      if (searchQuery.length < 2) {
        setContacts([]);
        return;
      }
      try {
        const response = await fetch(`/api/clients`);
        if (response.ok) {
          const allClients = await response.json();
          const filtered = allClients.filter((c: any) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setContacts(filtered);
        }
      } catch (error) {
        console.error('Error searching contacts:', error);
      }
    };

    const timer = setTimeout(searchContacts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const sourceLabels = {
    google: { label: 'Google', icon: '📅', color: '#93C5FD' },
    checklist: { label: 'Tasks', icon: '✓', color: '#7DD3FC' },
    project: { label: 'Projects', icon: '📋', color: '#6EE7B7' },
    school: { label: 'School', icon: '🎓', color: '#C4B5FD' },
    routine: { label: 'Routines', icon: '🔄', color: '#FDBA74' },
    habit: { label: 'Habits', icon: '✨', color: '#5EEAD4' },
    business: { label: 'Business', icon: '💼', color: '#FCA5A5' },
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(addMonths(currentDate, 1));
      const enabledSources = Object.entries(filters)
        .filter(([_, enabled]) => enabled)
        .map(([source]) => source);

      const response = await fetch(
        `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}&sources=${enabledSources.join(',')}`
      );

      if (!response.ok) throw new Error('Failed to fetch events');
      const { events: fetchedEvents } = await response.json();

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

  const handleCreateEvent = () => {
    setNewEvent({
      title: '',
      date: currentDate,
      startTime: '09:00',
      endTime: '10:00',
      source: 'google',
    });
    setIsCreateDialogOpen(true);
  };

  const submitCreateEvent = async () => {
    if (!newEvent.title) {
      toast({ title: 'Error', description: 'Please enter a title', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const start = new Date(newEvent.date);
    const [startHour, startMinute] = newEvent.startTime.split(':').map(Number);
    start.setHours(startHour, startMinute);

    const end = new Date(newEvent.date);
    const [endHour, endMinute] = newEvent.endTime.split(':').map(Number);
    end.setHours(endHour, endMinute);

    const createdEvent: CalendarEvent = {
      id: Math.random().toString(36).substr(2, 9),
      title: newEvent.title,
      start,
      end,
      allDay: false,
      source: newEvent.source,
      color: sourceLabels[newEvent.source as keyof typeof sourceLabels].color,
    };

    setEvents(prev => [...prev, createdEvent]);
    setIsCreating(false);
    setIsCreateDialogOpen(false);
    toast({ title: 'Success', description: 'Event created successfully' });
  };

  // Custom event style
  const eventStyleGetter = (event: CalendarEvent) => {
    // Convert hex color to rgba for background with opacity
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Dark mode friendly opacity
    const backgroundColor = hexToRgba(event.color, 0.25);
    const borderColor = event.color;

    return {
      style: {
        backgroundColor: backgroundColor,
        borderRadius: '8px',
        opacity: 1,
        color: event.color, // Text color matches the event color
        borderLeft: `4px solid ${borderColor}`,
        borderTop: '0px',
        borderRight: '0px',
        borderBottom: '0px',
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: '600',
        padding: '2px 8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        marginBottom: '2px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      },
    };
  };

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <style jsx global>{`
        .rbc-calendar {
            font-family: inherit;
        }
        .rbc-header {
            padding: 12px 4px;
            font-weight: 600;
            font-size: 0.75rem;
            color: var(--muted-foreground);
            border-bottom: 1px solid rgba(255,255,255,0.1) !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .rbc-month-view {
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 1.5rem;
            overflow: hidden;
            background: rgba(0,0,0,0.1);
        }
        .rbc-day-bg {
            border-left: 1px solid rgba(255,255,255,0.03) !important;
        }
        .rbc-month-row {
            border-top: 1px solid rgba(255,255,255,0.03) !important;
        }
        .rbc-off-range-bg {
            background: rgba(0,0,0,0.05);
        }
        .rbc-today {
            background: rgba(99, 102, 241, 0.03) !important;
        }
        .rbc-date-cell {
            padding: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--foreground);
            opacity: 0.5;
        }
        .rbc-now {
            color: var(--primary);
            font-weight: 800;
            opacity: 1;
        }
        .rbc-event {
            background: transparent !important;
            padding: 0 !important;
        }
        /* Hide default toolbar since we use custom one */
        .rbc-toolbar {
            display: none !important;
        }
      `}</style>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0 card--secondary rounded-[32px] p-6 overflow-hidden">
        {/* Sidebar */}
        <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-6 overflow-y-auto lg:overflow-visible">
          <CalendarSidebar
            date={currentDate}
            onDateChange={(date) => date && setCurrentDate(date)}
            filters={filters}
            onToggleFilter={toggleFilter}
            sourceLabels={sourceLabels}
            onCreateEvent={handleCreateEvent}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <CalendarToolbar
            label={format(currentDate, 'MMMM yyyy')}
            onNavigate={(action: 'PREV' | 'NEXT' | 'TODAY' | 'DATE') => {
              if (action === 'PREV') handleNavigate(subMonths(currentDate, 1));
              if (action === 'NEXT') handleNavigate(addMonths(currentDate, 1));
              if (action === 'TODAY') handleNavigate(new Date());
            }}
            onView={(view: View) => handleViewChange(view)}
            view={view}
            date={currentDate}
            localizer={localizer}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSettingsClick={() => toast({ title: "Settings", description: "Calendar settings coming soon!" })}
          />

          {/* Search Results Overlay */}
          {searchQuery && (
            <div className="relative z-20">
              <div className="absolute top-0 left-0 right-0 bg-background/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-4 max-h-[400px] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Search Results</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="h-6 w-6 p-0 rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Events Section */}
                  <div>
                    <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                      <CalendarIcon className="h-3 w-3" /> Events ({filteredEvents.length})
                    </h4>
                    {filteredEvents.length > 0 ? (
                      <div className="space-y-2">
                        {filteredEvents.slice(0, 5).map(event => (
                          <div
                            key={event.id}
                            className="p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5"
                            onClick={() => {
                              setSelectedEvent(event);
                              setSearchQuery('');
                            }}
                          >
                            <div className="font-medium text-sm">{event.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(event.start, 'MMM d, yyyy')} {!event.allDay && `• ${format(event.start, 'p')}`}
                            </div>
                          </div>
                        ))}
                        {filteredEvents.length > 5 && (
                          <div className="text-xs text-muted-foreground text-center pt-1">
                            + {filteredEvents.length - 5} more events
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic p-2">No events found</div>
                    )}
                  </div>

                  {/* Contacts Section */}
                  <div>
                    <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                      <User className="h-3 w-3" /> Contacts ({contacts.length})
                    </h4>
                    {contacts.length > 0 ? (
                      <div className="space-y-2">
                        {contacts.map(contact => (
                          <div
                            key={contact.id}
                            className="p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5 flex items-center gap-3"
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {contact.name[0]}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{contact.name}</div>
                              <div className="text-xs text-muted-foreground">{contact.email || contact.phone || 'No contact info'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic p-2">No contacts found</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 mt-4 relative min-h-[400px]">
            <div className="absolute inset-0">
              <Calendar
                localizer={localizer}
                events={filteredEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                view={view}
                onView={handleViewChange}
                date={currentDate}
                onNavigate={handleNavigate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                toolbar={false}
                popup
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Create Event Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[425px] glass-panel border-white/10">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Create New Event</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  autoComplete="off"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="col-span-3 bg-white/5 border-white/10"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <Select
                  value={newEvent.source}
                  onValueChange={(value) => setNewEvent({ ...newEvent, source: value })}
                >
                  <SelectTrigger className="col-span-3 bg-white/5 border-white/10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10">
                    {Object.entries(sourceLabels).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="start" className="text-right">
                  Start
                </Label>
                <Input
                  id="start"
                  name="start"
                  autoComplete="off"
                  type="time"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  className="col-span-3 bg-white/5 border-white/10"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="end" className="text-right">
                  End
                </Label>
                <Input
                  id="end"
                  name="end"
                  autoComplete="off"
                  type="time"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  className="col-span-3 bg-white/5 border-white/10"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={submitCreateEvent} disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Event Details Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="glass-panel rounded-3xl shadow-2xl border border-white/10 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-5">
                <div className="flex items-start justify-between">
                  <h3 className="text-xl font-bold leading-none tracking-tight">{selectedEvent.title}</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2 rounded-full hover:bg-white/10" onClick={() => setSelectedEvent(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/5 p-3 rounded-xl">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {format(selectedEvent.start, 'EEEE, MMMM d')}
                    {!selectedEvent.allDay && ` • ${format(selectedEvent.start, 'p')} - ${format(selectedEvent.end, 'p')}`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-3 py-1 font-medium rounded-full" style={{ backgroundColor: `${selectedEvent.color}20`, color: selectedEvent.color }}>
                    {sourceLabels[selectedEvent.source as keyof typeof sourceLabels]?.icon} {sourceLabels[selectedEvent.source as keyof typeof sourceLabels]?.label}
                  </Badge>
                </div>

                {selectedEvent.metadata?.description && (
                  <div className="bg-white/5 p-4 rounded-xl text-sm text-muted-foreground leading-relaxed">
                    {selectedEvent.metadata.description}
                  </div>
                )}
              </div>
              <div className="bg-white/5 p-4 flex justify-end border-t border-white/10">
                <Button onClick={() => setSelectedEvent(null)} className="rounded-xl px-6">Close</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
