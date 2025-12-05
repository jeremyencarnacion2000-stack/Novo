'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
    LayoutDashboard,
    Calendar,
    CheckSquare,
    KanbanSquare,
    TrendingUp,
    GraduationCap,
    Briefcase,
    BookOpen,
    Sparkles,
    Heart,
    Settings,
    Timer,
    Bot,
    BarChart3,
    Plus,
    Play,
    Search,
} from 'lucide-react';
import './command-palette.css';

interface CommandItem {
    id: string;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    onSelect: () => void;
    keywords?: string[];
}

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const router = useRouter();

    // CMD+K / CTRL+K shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const navigate = (path: string) => {
        router.push(path);
        setOpen(false);
    };

    const quickActions: CommandItem[] = [
        {
            id: 'new-task',
            title: 'Create new task',
            icon: <Plus className="h-4 w-4" />,
            onSelect: () => navigate('/checklist'),
        },
        {
            id: 'start-focus',
            title: 'Start focus session',
            icon: <Play className="h-4 w-4" />,
            onSelect: () => navigate('/focus'),
        },
        {
            id: 'new-project',
            title: 'Create new project',
            icon: <Plus className="h-4 w-4" />,
            onSelect: () => navigate('/projects'),
        },
    ];

    const pages: CommandItem[] = [
        {
            id: 'dashboard',
            title: 'Dashboard',
            subtitle: 'Overview and stats',
            icon: <LayoutDashboard className="h-4 w-4" />,
            onSelect: () => navigate('/'),
            keywords: ['home', 'overview'],
        },
        {
            id: 'today',
            title: 'Today',
            subtitle: 'Your daily tasks',
            icon: <Calendar className="h-4 w-4" />,
            onSelect: () => navigate('/today'),
            keywords: ['tasks', 'daily'],
        },
        {
            id: 'calendar',
            title: 'Calendar',
            subtitle: 'Events and deadlines',
            icon: <Calendar className="h-4 w-4" />,
            onSelect: () => navigate('/calendar'),
            keywords: ['events', 'schedule'],
        },
        {
            id: 'checklist',
            title: 'Daily Checklist',
            subtitle: 'Task list',
            icon: <CheckSquare className="h-4 w-4" />,
            onSelect: () => navigate('/checklist'),
            keywords: ['tasks', 'todo'],
        },
        {
            id: 'projects',
            title: 'Projects',
            subtitle: 'Kanban board',
            icon: <KanbanSquare className="h-4 w-4" />,
            onSelect: () => navigate('/projects'),
            keywords: ['kanban', 'board'],
        },
        {
            id: 'trackers',
            title: 'Trackers',
            subtitle: 'Habits and metrics',
            icon: <TrendingUp className="h-4 w-4" />,
            onSelect: () => navigate('/trackers'),
            keywords: ['habits', 'metrics'],
        },
        {
            id: 'school',
            title: 'School',
            subtitle: 'Courses and GPA',
            icon: <GraduationCap className="h-4 w-4" />,
            onSelect: () => navigate('/school'),
            keywords: ['courses', 'grades', 'gpa'],
        },
        {
            id: 'business',
            title: 'Novo Business',
            subtitle: 'CRM and clients',
            icon: <Briefcase className="h-4 w-4" />,
            onSelect: () => navigate('/business'),
            keywords: ['crm', 'clients', 'leads'],
        },
        {
            id: 'library',
            title: 'Reading Library',
            subtitle: 'Books and articles',
            icon: <BookOpen className="h-4 w-4" />,
            onSelect: () => navigate('/library'),
            keywords: ['books', 'reading'],
        },
        {
            id: 'spiritual',
            title: 'Spiritual',
            subtitle: 'Gratitude and goals',
            icon: <Sparkles className="h-4 w-4" />,
            onSelect: () => navigate('/spiritual'),
            keywords: ['gratitude', 'meditation'],
        },
        {
            id: 'appearance',
            title: 'Appearance',
            subtitle: 'Self care tracking',
            icon: <Heart className="h-4 w-4" />,
            onSelect: () => navigate('/appearance'),
            keywords: ['skincare', 'wellness'],
        },
        {
            id: 'focus',
            title: 'Focus Mode',
            subtitle: 'Pomodoro timer',
            icon: <Timer className="h-4 w-4" />,
            onSelect: () => navigate('/focus'),
            keywords: ['pomodoro', 'timer', 'concentrate'],
        },
        {
            id: 'ai',
            title: 'AI Assistant',
            subtitle: 'Chat with AI',
            icon: <Bot className="h-4 w-4" />,
            onSelect: () => navigate('/ai'),
            keywords: ['chat', 'assistant'],
        },
        {
            id: 'analytics',
            title: 'Analytics',
            subtitle: 'Productivity insights',
            icon: <BarChart3 className="h-4 w-4" />,
            onSelect: () => navigate('/analytics'),
            keywords: ['stats', 'insights'],
        },
        {
            id: 'settings',
            title: 'Settings',
            subtitle: 'Preferences and config',
            icon: <Settings className="h-4 w-4" />,
            onSelect: () => navigate('/settings'),
            keywords: ['preferences', 'config'],
        },
    ];

    return (
        <Command.Dialog
            open={open}
            onOpenChange={setOpen}
            label="Global Command Menu"
            className="command-palette"
        >
            <div className="command-header">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Command.Input
                    placeholder="Search or type a command..."
                    value={search}
                    onValueChange={setSearch}
                    className="command-input"
                />
            </div>

            <Command.List className="command-list">
                <Command.Empty className="command-empty">
                    <div className="text-center py-6 text-muted-foreground">
                        No results found.
                    </div>
                </Command.Empty>

                {!search && (
                    <>
                        <Command.Group heading="Quick Actions" className="command-group">
                            {quickActions.map((action) => (
                                <Command.Item
                                    key={action.id}
                                    onSelect={action.onSelect}
                                    className="command-item"
                                >
                                    {action.icon}
                                    <span>{action.title}</span>
                                </Command.Item>
                            ))}
                        </Command.Group>

                        <Command.Separator className="command-separator" />
                    </>
                )}

                <Command.Group heading="Pages" className="command-group">
                    {pages.map((page) => (
                        <Command.Item
                            key={page.id}
                            onSelect={page.onSelect}
                            keywords={page.keywords}
                            className="command-item"
                        >
                            {page.icon}
                            <div className="flex-1">
                                <div className="font-medium">{page.title}</div>
                                {page.subtitle && (
                                    <div className="text-xs text-muted-foreground">
                                        {page.subtitle}
                                    </div>
                                )}
                            </div>
                        </Command.Item>
                    ))}
                </Command.Group>
            </Command.List>

            <div className="command-footer">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <kbd>↑↓</kbd> Navigate
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd>↵</kbd> Select
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd>Esc</kbd> Close
                    </span>
                </div>
            </div>
        </Command.Dialog>
    );
}
