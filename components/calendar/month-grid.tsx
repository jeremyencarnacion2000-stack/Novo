'use client';

import React from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, isToday,
} from 'date-fns';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: string;
  color: string;
  metadata?: any;
}

interface MonthGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (date: Date) => void;
  /** CSS opacity multiplier applied to cognitive-heavy sources during fatigue */
  fatigueDimSources?: string[];
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE = 3;

export function MonthGrid({
  currentDate,
  events,
  onSelectEvent,
  onSelectDay,
  fatigueDimSources = [],
}: MonthGridProps) {
  // Build the 6-week day grid
  const monthStart = startOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(currentDate));

  const days: Date[] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const eventsOnDay = (d: Date) =>
    events.filter((e) => isSameDay(e.start, d) || (e.allDay && e.start <= d && e.end >= d));

  return (
    <div className="flex flex-col h-full select-none">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-2">
            {h}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 w-full gap-px bg-foreground/5 rounded-2xl overflow-hidden border border-foreground/5">
        {days.map((d) => {
          const dayEvents = eventsOnDay(d);
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const overflow = dayEvents.length - MAX_VISIBLE;
          const inMonth = isSameMonth(d, currentDate);
          const today = isToday(d);

          return (
            <div
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className={[
                'relative flex flex-col gap-0.5 p-1 sm:p-1.5 min-h-[48px] sm:min-h-[80px] cursor-pointer transition-colors duration-150',
                'bg-background/60 hover:bg-foreground/[0.04]',
                !inMonth && 'opacity-30',
              ].filter(Boolean).join(' ')}
              style={{ viewTransitionName: `cal-day-${format(d, 'yyyy-MM-dd')}` } as React.CSSProperties}
            >
              {/* Date number */}
              <span
                className={[
                  'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full self-end',
                  today
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/70',
                ].join(' ')}
              >
                {format(d, 'd')}
              </span>

              {/* Event micro-tokens */}
              {visible.map((ev) => {
                const dimmed = fatigueDimSources.includes(ev.source);
                return (
                  <button
                    key={ev.id}
                    data-flip-from={`event-${ev.id}`}
                    onClick={(e) => { e.stopPropagation(); onSelectEvent(ev); }}
                    title={ev.title}
                    className="w-full text-left px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate transition-opacity"
                    style={{
                      backgroundColor: `${ev.color}22`,
                      borderLeft: `3px solid ${ev.color}`,
                      color: ev.color,
                      opacity: dimmed ? 0.25 : 1,
                    }}
                  >
                    <span data-shared-item="text">{ev.title}</span>
                  </button>
                );
              })}

              {overflow > 0 && (
                <span className="text-[9px] text-muted-foreground px-1 font-medium">
                  +{overflow} more
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
