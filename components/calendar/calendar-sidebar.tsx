import React from "react"
import { Button } from "@/components/ui/button"
import { MiniCalendar } from "@/components/calendar/mini-calendar"
import { Plus } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

interface CalendarSidebarProps {
    date: Date;
    onDateChange: (date: Date | undefined) => void;
    filters: Record<string, boolean>;
    onToggleFilter: (key: string) => void;
    sourceLabels: Record<string, { label: string; color: string; icon: string }>;
    onCreateEvent: () => void;
}

export function CalendarSidebar({
    date,
    onDateChange,
    filters,
    onToggleFilter,
    sourceLabels,
    onCreateEvent
}: CalendarSidebarProps) {
    return (
        <div className="w-full lg:w-[280px] flex flex-col gap-6 shrink-0">
            {/* Create Event Button */}
            <Button
                data-flip-from="btn-create-event"
                onClick={onCreateEvent}
                className="w-full h-12 rounded-2xl shadow-lg shadow-primary/20 text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
                <Plus data-shared-item="icon" className="mr-2 h-5 w-5" /> <span data-shared-item="text">Create Event</span>
            </Button>

            {/* Mini Calendar */}
            <MiniCalendar
                selected={date}
                onSelect={(d) => onDateChange(d)}
            />

            {/* My Calendars Filters */}
            <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">My calendars</h3>
                </div>
                <div className="space-y-3">
                    {Object.entries(sourceLabels).map(([key, { label, color }]) => (
                        <div key={key} className="flex items-center space-x-3 group cursor-pointer" onClick={() => onToggleFilter(key)}>
                            <div className="relative flex items-center justify-center">
                                <Checkbox
                                    id={`filter-${key}`}
                                    checked={filters[key]}
                                    onCheckedChange={() => onToggleFilter(key)}
                                    className="h-5 w-5 rounded-md border-2 transition-all data-[state=checked]:border-transparent"
                                    style={{
                                        borderColor: color,
                                        backgroundColor: filters[key] ? color : 'transparent'
                                    }}
                                />
                            </div>
                            <label
                                htmlFor={`filter-${key}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer group-hover:text-foreground transition-colors text-muted-foreground"
                            >
                                {label}
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
