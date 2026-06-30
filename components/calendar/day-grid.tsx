'use client';

import React, { useRef, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { CalendarEvent } from './month-grid';

const HOUR_START   = 6;
const HOUR_END     = 23;
const PX_PER_HOUR  = 72;

interface DayGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  fatigueDimSources?: string[];
}

export function DayGrid({ currentDate, events, onSelectEvent, fatigueDimSources = [] }: DayGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - HOUR_START) * PX_PER_HOUR;
    }
  }, []);

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const allEvents = events.filter((e) => isSameDay(e.start, currentDate));
  const allDayEvents = allEvents.filter((e) => e.allDay);
  const dayEvents = allEvents.filter((e) => !e.allDay);

  const getEventStyle = (ev: CalendarEvent) => {
    const startH = ev.start.getHours() + ev.start.getMinutes() / 60;
    const endH   = ev.end.getHours()   + ev.end.getMinutes()   / 60;
    const top    = Math.max(startH - HOUR_START, 0) * PX_PER_HOUR;
    const height = Math.max((Math.min(endH, HOUR_END) - Math.max(startH, HOUR_START)) * PX_PER_HOUR, 24);
    return { top, height };
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ viewTransitionName: `cal-day-${format(currentDate, 'yyyy-MM-dd')}` } as React.CSSProperties}
    >
      {/* Day header */}
      <div className="shrink-0 pb-3 border-b border-white/5 mb-1">
        <h3 className="text-lg font-bold text-foreground">
          {format(currentDate, 'EEEE, MMMM d')}
        </h3>
        <p className="text-xs text-muted-foreground">{allEvents.length} event{allEvents.length !== 1 ? 's' : ''} today</p>
      </div>

      {/* All-day events banner */}
      {allDayEvents.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-2 pb-3 mb-1 border-b border-white/5">
          {allDayEvents.map((ev) => (
            <button
              key={ev.id}
              onClick={() => onSelectEvent(ev)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold truncate max-w-[200px] transition-opacity hover:opacity-80"
              style={{
                backgroundColor: `${ev.color}22`,
                borderLeft: `3px solid ${ev.color}`,
                color: ev.color,
              }}
            >
              {ev.title}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className="relative grid grid-cols-[56px_1fr]"
          style={{ height: `${(HOUR_END - HOUR_START) * PX_PER_HOUR}px` }}
        >
          {/* Hour labels column */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute text-[9px] text-right pr-3 w-full text-muted-foreground/60"
                style={{ top: `${(h - HOUR_START) * PX_PER_HOUR - 7}px` }}
              >
                {format(new Date().setHours(h, 0, 0, 0), 'ha')}
              </div>
            ))}
          </div>

          {/* Events column */}
          <div className="relative border-l border-white/5">
            {/* Grid lines */}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute w-full border-t border-white/[0.04]"
                style={{ top: `${(h - HOUR_START) * PX_PER_HOUR}px` }}
              />
            ))}

            {/* Events */}
            {dayEvents.map((ev) => {
              const { top, height } = getEventStyle(ev);
              const dimmed = fatigueDimSources.includes(ev.source);
              return (
                <button
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className="absolute left-2 right-2 rounded-xl px-3 py-2 text-left overflow-hidden transition-opacity hover:brightness-125"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: `${ev.color}22`,
                    borderLeft: `4px solid ${ev.color}`,
                    color: ev.color,
                    opacity: dimmed ? 0.25 : 1,
                  }}
                >
                  <p className="text-xs font-bold truncate">{ev.title}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">
                    {format(ev.start, 'p')} – {format(ev.end, 'p')}
                  </p>
                  {ev.metadata?.description && height > 60 && (
                    <p className="text-[10px] opacity-50 mt-1 line-clamp-2 leading-relaxed">
                      {ev.metadata.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
