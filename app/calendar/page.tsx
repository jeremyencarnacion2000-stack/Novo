'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { modalFlip } from '@/lib/modal-flip';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, X, Loader2, User, Brain, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CalendarToolbar, CalendarView } from '@/components/calendar/calendar-toolbar';
import { CalendarSidebar } from '@/components/calendar/calendar-sidebar';
import { MonthGrid, CalendarEvent } from '@/components/calendar/month-grid';
import { WeekGrid } from '@/components/calendar/week-grid';
import { DayGrid } from '@/components/calendar/day-grid';
import { safeViewTransition } from '@/hooks/use-view-transition';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCognitiveState } from '@/lib/cognitive-context';
import { useSettings } from '@/lib/settings-context';

// Sources that should dim during cognitive fatigue phases
const FATIGUE_DIM_SOURCES = ['project', 'business', 'school'];
// Sources to highlight during peak focus
const FOCUS_BOOST_SOURCES = ['project', 'checklist'];

export default function CalendarPage() {
  const { toast } = useToast();
  const { setSettingsOpen } = useSettings();
  const { bioState } = useCognitiveState();
  const isFatigue = bioState.phase === 'SYNAPTIC_FATIGUE' || bioState.phase === 'REDUCED_CAPACITY_MODE';
  const isPeak    = bioState.phase === 'PEAK_FOCUS';

  const [events, setEvents]             = useState<CalendarEvent[]>([]);
  const [loading, setLoading]           = useState(true);
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [view, setView]                 = useState<CalendarView>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: new Date(), startTime: '09:00', endTime: '10:00', source: 'google' });
  const [isCreating, setIsCreating]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [contacts, setContacts]         = useState<any[]>([]);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const [filters, setFilters] = useState({
    google: true, checklist: true, project: true, school: true,
    routine: true, habit: true, business: true, holidays: true, novo: true,
  });

  const sourceLabels: Record<string, { label: string; icon: string; color: string }> = {
    google:    { label: 'Google',    icon: '📅', color: '#A5B4FC' },
    checklist: { label: 'Tasks',     icon: '✓',  color: '#67E8F9' },
    project:   { label: 'Projects',  icon: '📋', color: '#6EE7B7' },
    school:    { label: 'School',    icon: '🎓', color: '#C4B5FD' },
    routine:   { label: 'Routines',  icon: '🔄', color: '#FDBA74' },
    habit:     { label: 'Habits',    icon: '✨', color: '#5EEAD4' },
    business:  { label: 'Business',  icon: '💼', color: '#FCA5A5' },
    holidays:  { label: 'Holidays',  icon: '🎉', color: '#CBD5E1' },
    novo:      { label: 'Asistente', icon: '🤖', color: '#818CF8' },
  };

  // ── Fetch events ──
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfMonth(currentDate);
      const end   = endOfMonth(addMonths(currentDate, 1));
      const enabledSources = Object.entries(filters).filter(([, v]) => v).map(([k]) => k);
      const res = await fetch(
        `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}&sources=${enabledSources.join(',')}`
      );
      if (!res.ok) throw new Error('Failed to fetch events');
      const { events: raw } = await res.json();
      setEvents(raw.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
    } catch {
      toast({ title: 'Error', description: 'Failed to load calendar events', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentDate, filters, toast]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Cognitive schedule-event listener (voice agent integration) ──
  useEffect(() => {
    const handler = () => fetchEvents();
    window.addEventListener('cognitive:schedule-event', handler);
    return () => window.removeEventListener('cognitive:schedule-event', handler);
  }, [fetchEvents]);

  // ── Contact search ──
  useEffect(() => {
    if (searchQuery.length < 2) { setContacts([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/clients');
        if (res.ok) {
          const all = await res.json();
          setContacts(all.filter((c: any) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase())
          ));
        }
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Navigation ──
  const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') { setCurrentDate(new Date()); return; }
    const dir = action === 'NEXT' ? 1 : -1;
    setCurrentDate(prev =>
      view === 'month' ? (dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1)) :
      view === 'week'  ? (dir > 0 ? addWeeks(prev, 1)  : subWeeks(prev, 1))  :
                         (dir > 0 ? addDays(prev, 1)   : subDays(prev, 1))
    );
  };

  const handleViewLabel = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy');
    if (view === 'week')  return `Week of ${format(currentDate, 'MMM d, yyyy')}`;
    return format(currentDate, 'EEEE, MMMM d');
  };

  const toggleFilter = (source: string) =>
    setFilters(prev => ({ ...prev, [source]: !prev[source as keyof typeof prev] }));

  const handleCreateEvent = () => {
    setNewEvent({ title: '', date: currentDate, startTime: '09:00', endTime: '10:00', source: 'google' });
    setIsCreateDialogOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  // Fire the flip *after* React has committed the new DOM (dialog/detail div
  // mounted) and the browser has had a frame to lay it out — a fixed
  // setTimeout() raced the render and could fire before the target existed,
  // leaving the modal permanently invisible (data-flip-target defaults to
  // opacity:0 and only modalFlip's own success path clears that).
  useEffect(() => {
    if (!isCreateDialogOpen) return
    const id = requestAnimationFrame(() => { modalFlip.toggle('btn-create-event') })
    return () => cancelAnimationFrame(id)
  }, [isCreateDialogOpen])

  useEffect(() => {
    if (!selectedEvent) return
    const id = requestAnimationFrame(() => { modalFlip.toggle(`event-${selectedEvent.id}`) })
    return () => cancelAnimationFrame(id)
  }, [selectedEvent])

  const handleCloseCreateDialog = () => {
    modalFlip.untoggle('btn-create-event', () => setIsCreateDialogOpen(false));
  };

  const handleCloseSelectedEvent = () => {
    if (selectedEvent) modalFlip.untoggle(`event-${selectedEvent.id}`, () => setSelectedEvent(null));
    else setSelectedEvent(null);
  };

  const submitCreateEvent = async () => {
    if (!newEvent.title) { toast({ title: 'Error', description: 'Please enter a title', variant: 'destructive' }); return; }
    setIsCreating(true);
    const start = new Date(newEvent.date);
    const [sh, sm] = newEvent.startTime.split(':').map(Number);
    start.setHours(sh, sm);
    const end = new Date(newEvent.date);
    const [eh, em] = newEvent.endTime.split(':').map(Number);
    end.setHours(eh, em);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newEvent.title, start, end, allDay: false }),
      });
      if (!res.ok) throw new Error('Failed to create event');
      const { event } = await res.json();
      const created: CalendarEvent = {
        id: `novo:event:${event.id}`,
        title: event.title,
        start: new Date(event.start),
        end: new Date(event.end),
        allDay: event.allDay,
        source: 'novo',
        color: sourceLabels['novo']?.color ?? '#818CF8',
      };
      setEvents(prev => [...prev, created]);
      handleCloseCreateDialog();
      toast({ title: 'Success', description: 'Event created successfully' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear el evento', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const filteredEvents = events.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fatigueDimSources = isFatigue ? FATIGUE_DIM_SOURCES : [];

  return (
    <>
      <div className="h-full w-full p-0 md:p-4 overflow-hidden">
        <Card variant="secondary" className="flex flex-col lg:flex-row gap-6 h-full min-h-0 rounded-none md:rounded-[28px] p-4 md:p-6 pb-24 md:pb-6 overflow-hidden relative border-foreground/10">

          {/* Mobile sidebar toggle */}
          <div className="lg:hidden flex justify-between items-center mb-4">
            <Button variant="outline" onClick={() => setShowMobileSidebar(!showMobileSidebar)}>
              {showMobileSidebar ? <X className="mr-2 h-4 w-4" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
              {showMobileSidebar ? 'Close Filters' : 'Filters & Events'}
            </Button>
          </div>

          {/* Sidebar */}
          <div className={`lg:w-[280px] shrink-0 flex flex-col gap-6 overflow-y-auto lg:overflow-visible transition-all duration-300 ${showMobileSidebar ? 'fixed inset-0 z-50 bg-background/95 backdrop-blur-xl p-6' : 'hidden lg:flex w-full'}`}>
            {showMobileSidebar && (
              <div className="flex justify-end lg:hidden mb-4">
                <Button variant="ghost" size="icon" onClick={() => setShowMobileSidebar(false)}><X className="h-6 w-6" /></Button>
              </div>
            )}
            <CalendarSidebar
              date={currentDate}
              onDateChange={(d) => { if (d) setCurrentDate(d); setShowMobileSidebar(false); }}
              filters={filters}
              onToggleFilter={toggleFilter}
              sourceLabels={sourceLabels}
              onCreateEvent={() => { handleCreateEvent(); setShowMobileSidebar(false); }}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 h-full">

            {/* Cognitive banner */}
            {isFatigue && (
              <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-orange-500/20 bg-orange-500/5 px-4 py-2.5 text-xs text-orange-300">
                <Brain className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Synaptic fatigue detected — complex tasks are dimmed. Consider a {bioState.minutesToNextPhase}-min recovery break.</span>
              </div>
            )}
            {isPeak && (() => {
              const topTask = events.find(e => e.source === 'checklist' || e.source === 'project');
              const topTaskTitle = topTask ? `"${topTask.title}"` : 'your deep focus blocks';
              return (
                <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-300">
                  <Brain className="h-3.5 w-3.5 flex-shrink-0 animate-pulse" />
                  <span>Peak Focus active — start {topTaskTitle} while your focus capacity is at max.</span>
                </div>
              );
            })()}

            <CalendarToolbar
              label={handleViewLabel()}
              onNavigate={handleNavigate}
              onView={setView}
              view={view}
              date={currentDate}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSettingsClick={() => setSettingsOpen(true)}
            />

            {/* Search overlay */}
            {searchQuery && (
              <div className="relative z-20 mb-2">
                <div className="absolute top-0 left-0 right-0 bg-background/95 backdrop-blur-md border border-foreground/10 rounded-2xl shadow-2xl p-4 max-h-[360px] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Search Results</h3>
                    <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="h-6 w-6 p-0 rounded-full"><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-2"><CalendarIcon className="h-3 w-3" /> Events ({filteredEvents.length})</h4>
                      {filteredEvents.slice(0, 5).map(ev => (
                        <div key={ev.id} className="p-2 rounded-lg hover:bg-foreground/5 cursor-pointer" onClick={() => { setSelectedEvent(ev); setSearchQuery(''); }}>
                          <div className="font-medium text-sm">{ev.title}</div>
                          <div className="text-xs text-muted-foreground">{format(ev.start, 'MMM d, yyyy')}</div>
                        </div>
                      ))}
                    </div>
                    {contacts.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-2"><User className="h-3 w-3" /> Contacts ({contacts.length})</h4>
                        {contacts.map(c => (
                          <div key={c.id} className="p-2 rounded-lg hover:bg-foreground/5 cursor-pointer flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{c.name[0]}</div>
                            <div>
                              <div className="font-medium text-sm">{c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.email || c.phone || '—'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Calendar grid area */}
            <div className="flex-1 min-h-0 min-w-0 w-full relative overflow-hidden">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {view === 'month' && (
                    <MonthGrid
                      currentDate={currentDate}
                      events={filteredEvents}
                      onSelectEvent={handleSelectEvent}
                      onSelectDay={(d) => { safeViewTransition(() => { setCurrentDate(d); setView('day'); }); }}
                      fatigueDimSources={fatigueDimSources}
                    />
                  )}
                  {view === 'week' && (
                    <WeekGrid
                      currentDate={currentDate}
                      events={filteredEvents}
                      onSelectEvent={handleSelectEvent}
                      fatigueDimSources={fatigueDimSources}
                    />
                  )}
                  {view === 'day' && (
                    <DayGrid
                      currentDate={currentDate}
                      events={filteredEvents}
                      onSelectEvent={handleSelectEvent}
                      fatigueDimSources={fatigueDimSources}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(o) => !o && handleCloseCreateDialog()}>
        <DialogContent data-flip-to="btn-create-event" className="sm:max-w-[425px] glass-panel border-foreground/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Plus data-shared-item="icon" className="h-5 w-5" />
              <span data-shared-item="text">Create New Event</span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ev-title" className="text-right">Title</Label>
              <Input id="ev-title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} className="col-span-3 bg-foreground/5 border-foreground/10" autoComplete="off" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ev-type" className="text-right">Type</Label>
              <Select value={newEvent.source} onValueChange={v => setNewEvent({ ...newEvent, source: v })}>
                <SelectTrigger className="col-span-3 bg-foreground/5 border-foreground/10"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="glass-panel border-foreground/10">
                  {Object.entries(sourceLabels).map(([k, { label }]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ev-start" className="text-right">Start</Label>
              <Input id="ev-start" type="time" value={newEvent.startTime} onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} className="col-span-3 bg-foreground/5 border-foreground/10" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ev-end" className="text-right">End</Label>
              <Input id="ev-end" type="time" value={newEvent.endTime} onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} className="col-span-3 bg-foreground/5 border-foreground/10" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitCreateEvent} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event detail modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
        <div data-flip-to={selectedEvent ? `event-${selectedEvent.id}` : ''} data-state="open" className="modal-flip-target glass-panel rounded-3xl shadow-2xl border border-foreground/10 w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <h3 data-shared-item="text" className="text-xl font-bold leading-none tracking-tight">{selectedEvent.title}</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2 rounded-full hover:bg-foreground/10" onClick={handleCloseSelectedEvent}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-foreground/5 p-3 rounded-xl">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {format(selectedEvent.start, 'EEEE, MMMM d')}
                  {!selectedEvent.allDay && ` • ${format(selectedEvent.start, 'p')} – ${format(selectedEvent.end, 'p')}`}
                </span>
              </div>
              <Badge variant="secondary" className="px-3 py-1 font-medium rounded-full" style={{ backgroundColor: `${selectedEvent.color}20`, color: selectedEvent.color }}>
                {sourceLabels[selectedEvent.source]?.icon} {sourceLabels[selectedEvent.source]?.label}
              </Badge>
              {selectedEvent.metadata?.description && (
                <div className="bg-foreground/5 p-4 rounded-xl text-sm text-muted-foreground leading-relaxed">
                  {selectedEvent.metadata.description}
                </div>
              )}
            </div>
            <div className="bg-foreground/5 p-4 flex justify-end border-t border-foreground/10">
              <Button onClick={handleCloseSelectedEvent} className="rounded-xl px-6">Close</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
