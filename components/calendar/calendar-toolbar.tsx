import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Local View type — removes dependency on react-big-calendar
export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface CalendarToolbarProps {
    label: string;
    onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
    onView: (view: CalendarView) => void;
    view: CalendarView;
    date: Date;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    onSettingsClick?: () => void;
}

export function CalendarToolbar({
    label,
    onNavigate,
    onView,
    view,
    searchQuery,
    onSearchChange,
    onSettingsClick
}: CalendarToolbarProps) {
    return (
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 w-full">
            {/* Left: Navigation & Title */}
            <div className="flex items-center gap-4 w-full md:w-auto">
                <h2 className="text-2xl font-bold tracking-tight min-w-[200px] text-foreground">{label}</h2>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onNavigate('PREV')} className="h-8 w-8 rounded-full hover:bg-muted">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onNavigate('NEXT')} className="h-8 w-8 rounded-full hover:bg-muted">
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>

                <Button variant="outline" size="sm" onClick={() => onNavigate('TODAY')} className="rounded-full px-4 h-8 text-xs font-medium border-muted-foreground/20">
                    Today
                </Button>
            </div>

            {/* Right: Search, Settings, View Switcher */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <div className="relative hidden md:block w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Find Events & Contacts"
                        className="pl-9 h-9 rounded-full bg-muted/30 border-transparent focus:bg-background transition-all"
                        value={searchQuery}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                    />
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={onSettingsClick}
                >
                    <Settings className="h-5 w-5" />
                </Button>

                <div className="flex items-center bg-muted/30 rounded-full p-1 border border-border/20">
                    {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
                        <button
                            key={v}
                            onClick={() => onView(v)}
                            className={cn(
                                "px-4 py-1.5 text-xs font-medium rounded-full transition-all capitalize",
                                view === v
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
