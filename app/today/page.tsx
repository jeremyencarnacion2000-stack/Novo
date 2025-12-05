'use client';

import React, { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface IntegratedTask {
    id: string;
    text: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    source: 'routine' | 'project' | 'manual' | 'school';
    sourceId: string;
    dueDate?: string;
    timeOfDay?: string;
    metadata?: {
        projectTitle?: string;
        routineName?: string;
        courseCode?: string;
        category?: string;
    };
}

interface UrgentItem {
    id: string;
    title: string;
    dueDate: string;
    type: string;
    courseName: string;
    courseCode: string;
    urgencyLevel: 'critical' | 'high' | 'medium';
    weight?: number;
}

export default function TodayPage() {
    const { toast } = useToast();
    const [tasks, setTasks] = useState<IntegratedTask[]>([]);
    const [urgentItems, setUrgentItems] = useState<UrgentItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [todayResponse, urgentResponse] = await Promise.all([
                fetch('/api/integration/today'),
                fetch('/api/integration/urgent')
            ]);

            if (todayResponse.ok) {
                const { tasks: todayTasks } = await todayResponse.json();
                setTasks(todayTasks);
            }

            if (urgentResponse.ok) {
                const { urgentItems: urgent } = await urgentResponse.json();
                setUrgentItems(urgent);
            }
        } catch (error) {
            console.error('Error fetching today data:', error);
            toast({
                title: 'Error',
                description: 'Failed to load today tasks',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleToggleComplete = async (task: IntegratedTask) => {
        // Optimistic update
        setTasks(tasks.map(t =>
            t.id === task.id ? { ...t, completed: !t.completed } : t
        ));

        try {
            const response = await fetch('/api/integration/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: task.id, completed: !task.completed })
            });

            if (!response.ok) {
                throw new Error('Sync failed');
            }
        } catch (error) {
            // Revert on error
            setTasks(tasks.map(t =>
                t.id === task.id ? { ...t, completed: task.completed } : t
            ));
            toast({
                title: 'Error',
                description: 'Failed to update task',
                variant: 'destructive',
            });
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'text-red-600 dark:text-red-400';
            case 'medium': return 'text-yellow-600 dark:text-yellow-400';
            default: return 'text-blue-600 dark:text-blue-400';
        }
    };

    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'routine': return '🔄';
            case 'project': return '📋';
            case 'school': return '🎓';
            default: return '✓';
        }
    };

    const getUrgencyColor = (level: string) => {
        switch (level) {
            case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        }
    };

    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    // Group tasks by source and time of day
    const routineTasks = tasks.filter(t => t.source === 'routine');
    const projectTasks = tasks.filter(t => t.source === 'project');
    const schoolTasks = tasks.filter(t => t.source === 'school');
    const manualTasks = tasks.filter(t => t.source === 'manual');

    const morningTasks = routineTasks.filter(t => t.timeOfDay === 'morning');
    const afternoonTasks = routineTasks.filter(t => t.timeOfDay === 'afternoon');
    const eveningTasks = routineTasks.filter(t => t.timeOfDay === 'evening');
    const anytimeTasks = routineTasks.filter(t => t.timeOfDay === 'anytime');

    if (loading) {
        return (
            <DashboardShell>
                <div>Loading...</div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="flex flex-col gap-6 md:gap-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                            Today
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">
                            {completedCount}/{totalCount}
                        </div>
                        <div className="text-sm text-muted-foreground">Tasks completed</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-secondary rounded-full h-3">
                    <div
                        className="bg-primary h-3 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Urgency Panel */}
                {urgentItems.length > 0 && (
                    <Card className="border-orange-200 dark:border-orange-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                                Urgent School Items
                            </CardTitle>
                            <CardDescription>
                                Assignments and exams in the next 72 hours
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {urgentItems.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium">{item.courseCode}: {item.title}</div>
                                            <div className="text-sm text-muted-foreground">
                                                Due: {new Date(item.dueDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <Badge className={getUrgencyColor(item.urgencyLevel)}>
                                            {item.urgencyLevel.toUpperCase()}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Morning Routines */}
                {morningTasks.length > 0 && (
                    <TaskSection
                        title="🌅 Morning Routine"
                        tasks={morningTasks}
                        onToggle={handleToggleComplete}
                        getPriorityColor={getPriorityColor}
                        getSourceIcon={getSourceIcon}
                    />
                )}

                {/* Afternoon Routines */}
                {afternoonTasks.length > 0 && (
                    <TaskSection
                        title="☀️ Afternoon Routine"
                        tasks={afternoonTasks}
                        onToggle={handleToggleComplete}
                        getPriorityColor={getPriorityColor}
                        getSourceIcon={getSourceIcon}
                    />
                )}

                {/* Evening Routines */}
                {eveningTasks.length > 0 && (
                    <TaskSection
                        title="🌙 Evening Routine"
                        tasks={eveningTasks}
                        onToggle={handleToggleComplete}
                        getPriorityColor={getPriorityColor}
                        getSourceIcon={getSourceIcon}
                    />
                )}

                {/* Anytime Tasks */}
                {anytimeTasks.length > 0 && (
                    <TaskSection
                        title="⏰ Anytime"
                        tasks={anytimeTasks}
                        onToggle={handleToggleComplete}
                        getPriorityColor={getPriorityColor}
                        getSourceIcon={getSourceIcon}
                    />
                )}

                {/* Project Tasks */}
                {projectTasks.length > 0 && (
                    <TaskSection
                        title="📋 Projects"
                        tasks={projectTasks}
                        onToggle={handleToggleComplete}
                        getPriorityColor={getPriorityColor}
                        getSourceIcon={getSourceIcon}
                    />
                )}

                {/* School Tasks */}
                {schoolTasks.length > 0 && (
                    <TaskSection
                        title="🎓 School"
                        tasks={schoolTasks}
                        onToggle={handleToggleComplete}
                        getPriorityColor={getPriorityColor}
                        getSourceIcon={getSourceIcon}
                    />
                )}

                {/* Manual Tasks */}
                {manualTasks.length > 0 && (
                    <TaskSection
                        title="✏️ Manual Tasks"
                        tasks={manualTasks}
                        onToggle={handleToggleComplete}
                        getPriorityColor={getPriorityColor}
                        getSourceIcon={getSourceIcon}
                    />
                )}

                {/* Empty State */}
                {totalCount === 0 && (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center py-12">
                                <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-lg font-medium">No tasks for today!</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    You're all caught up 🎉
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardShell>
    );
}

// Task Section Component
function TaskSection({
    title,
    tasks,
    onToggle,
    getPriorityColor,
    getSourceIcon
}: any) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {tasks.map((task: IntegratedTask) => (
                        <div
                            key={task.id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50 transition-colors"
                        >
                            <Checkbox
                                checked={task.completed}
                                onCheckedChange={() => onToggle(task)}
                            />
                            <div className="flex-1">
                                <div className={`${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                                    {getSourceIcon(task.source)} {task.text}
                                </div>
                                {task.metadata && (
                                    <div className="text-xs text-muted-foreground">
                                        {task.metadata.routineName || task.metadata.projectTitle || task.metadata.courseCode}
                                    </div>
                                )}
                            </div>
                            <Badge
                                variant="outline"
                                className={getPriorityColor(task.priority)}
                            >
                                {task.priority}
                            </Badge>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
