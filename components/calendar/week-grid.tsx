'use client';

import React, { useRef, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { CalendarEvent } from './month-grid';

const HOUR_START = 6;   // 06:00
const HOUR_END   = 23;  // 23:00
const PX_PER_HOUR = 64;

interface WeekGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  fatigueDimSources?: string[];
}

export function WeekGrid({ currentDate, events, onSelectEvent, fatigueDimSources = [] }: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 08:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - HOUR_START) * PX_PER_HOUR;
    }
  }, []);

  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const getEventStyle = (ev: CalendarEvent) => {
    const startH = ev.start.getHours() + ev.start.getMinutes() / 60;
    const endH   = ev.end.getHours()   + ev.end.getMinutes()   / 60;
    const clampedStart = Math.max(startH, HOUR_START);
    const clampedEnd   = Math.min(endH,   HOUR_END);
    const top    = (clampedStart - HOUR_START) * PX_PER_HOUR;
    const height = Math.max((clampedEnd - clampedStart) * PX_PER_HOUR, 20);
    return { top, height };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-foreground/5 shrink-0">
        <div /> {/* time gutter */}
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={[
              'text-center py-2 text-xs font-semibold',
              isToday(d) ? 'text-primary' : 'text-muted-foreground',
            ].join(' ')}
          >
            <div className="uppercase tracking-wider text-[9px]">{format(d, 'EEE')}</div>
            <div className={[
              'mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold',
              isToday(d) ? 'bg-primary text-primary-foreground' : '',
            ].join(' ')}>
              {format(d, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className="grid grid-cols-[48px_repeat(7,1fr)]"
          style={{ height: `${(HOUR_END - HOUR_START) * PX_PER_HOUR}px` }}
        >
          {/* Hour labels */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute text-[9px] text-muted-foreground/60 text-right pr-2 w-full"
                style={{ top: `${(h - HOUR_START) * PX_PER_HOUR - 6}px` }}
              >
                {format(new Date().setHours(h, 0, 0, 0), 'ha')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const dayEvents = events.filter((e) => isSameDay(e.start, d) && !e.allDay);
            return (
              <div key={d.toISOString()} className="relative border-l border-foreground/5">
                {/* Hour grid lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-foreground/[0.04]"
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
                      data-flip-from={`event-${ev.id}`}
                      onClick={() => onSelectEvent(ev)}
                      title={ev.title}
                      className="absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 text-left overflow-hidden transition-opacity hover:brightness-125 text-[10px] font-semibold"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: `${ev.color}28`,
                        borderLeft: `3px solid ${ev.color}`,
                        color: ev.color,
                        opacity: dimmed ? 0.25 : 1,
                      }}
                    >
                      <div data-shared-item="text" className="truncate">{ev.title}</div>
                      <div className="text-[9px] opacity-70">
                        {format(ev.start, 'p')} – {format(ev.end, 'p')}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
