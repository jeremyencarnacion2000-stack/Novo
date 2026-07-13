'use client'

import React, { useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, format,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { springConfig } from '@/lib/design-tokens'

interface MiniCalendarProps {
  selected: Date
  onSelect: (date: Date) => void
}

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export function MiniCalendar({ selected, onSelect }: MiniCalendarProps) {
  const [viewDate, setViewDate] = React.useState(selected)

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewDate)
    const monthEnd = endOfMonth(viewDate)
    const start = startOfWeek(monthStart, { weekStartsOn: 1 })
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [viewDate])

  return (
    <div className="rounded-[20px] border border-foreground/[0.06] p-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(20,16,28,0.95) 0%, rgba(10,8,16,0.98) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className="w-8 h-8 rounded-full border border-foreground/10 flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-foreground/25 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground/90 tracking-wide">
          {format(viewDate, 'MMM yyyy')}
        </span>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="w-8 h-8 rounded-full border border-foreground/10 flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-foreground/25 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-bold tracking-widest text-foreground/25 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewDate)
          const today = isToday(day)
          const sel = isSameDay(day, selected)

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={cn(
                'relative w-full aspect-square flex items-center justify-center text-sm font-medium rounded-full transition-all duration-200',
                !inMonth && 'text-foreground/10',
                inMonth && !today && !sel && 'text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06]',
                sel && !today && 'bg-primary text-primary-foreground',
                today && 'text-primary-foreground font-bold',
              )}
            >
              {today && (
                <span
                  className="absolute inset-0 rounded-full bg-primary"
                  style={{ boxShadow: '0 0 16px rgba(124,58,237,0.5), 0 0 4px rgba(124,58,237,0.8)' }}
                />
              )}
              <span className="relative z-10">{format(day, 'd')}</span>
            </button>
          )
        })}
      </div>

      {/* Top accent glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)' }}
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-8 rounded-full pointer-events-none blur-xl opacity-30"
        style={{ background: 'rgba(124,58,237,0.6)' }}
      />
    </div>
  )
}
