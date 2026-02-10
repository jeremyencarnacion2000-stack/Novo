'use client';

import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, SkipForward, Plus, CheckCircle2, Circle } from 'lucide-react';
import { useFocus } from '@/lib/focus-context';
import { FocusSettings } from '@/components/focus/focus-settings';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TiltCard } from '@/components/ui/tilt-card';

export default function FocusPage() {
    const {
        time,
        isActive,
        mode,
        pomodoroCount,
        progress,
        toggleTimer,
        resetTimer,
        skipTimer,
        formatTime,
        tasks,
        addTask,
        selectedTaskId,
        setSelectedTaskId,
        toggleTaskCompletion,
        deleteTask
    } = useFocus();

    const [newTaskText, setNewTaskText] = useState('');
    const [todayFocusTime, setTodayFocusTime] = useState(0);

    // Fetch real focus time from analytics
    useEffect(() => {
        async function fetchStats() {
            try {
                const response = await fetch('/api/analytics?days=1');
                if (response.ok) {
                    const data = await response.json();
                    // Find today's data in dailyData
                    const today = new Date().toISOString().split('T')[0];
                    const todayData = data.dailyData.find((d: any) => d.date.startsWith(today));
                    if (todayData) {
                        setTodayFocusTime(todayData.totalTime);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch focus stats:', error);
            }
        }
        fetchStats();
        // Refresh stats periodically if active
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, [isActive]);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskText.trim()) {
            addTask(newTaskText);
            setNewTaskText('');
        }
    };

    return (
        <div className="flex flex-col gap-4 md:gap-6 max-w-5xl mx-auto w-full -mt-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        Focus Mode
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {mode === 'work'
                            ? 'Deep work session'
                            : 'Take a break and recharge'}
                    </p>
                </div>
                <FocusSettings />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Timer Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-2 shadow-sm bg-card/50 backdrop-blur-sm">
                        <CardContent className="pt-8 pb-8">
                            <div className="flex flex-col items-center gap-6">
                                {/* Session Type Badge */}
                                <Badge
                                    variant={mode === 'work' ? 'default' : 'secondary'}
                                    className="text-base px-5 py-1.5 transition-colors duration-300"
                                >
                                    {mode === 'work' ? '🎯 Focus Session' : (mode === 'shortBreak' ? '☕ Short Break' : '🌴 Long Break')}
                                </Badge>

                                {/* Timer Display */}
                                <motion.div
                                    className="relative"
                                    animate={{ scale: isActive ? [1, 1.02, 1] : 1 }}
                                    transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
                                >
                                    <div className="text-7xl md:text-9xl font-bold tracking-tight text-center font-mono tabular-nums">
                                        {formatTime(time)}
                                    </div>
                                </motion.div>

                                {/* Progress Bar */}
                                <div className="w-full max-w-md space-y-2">
                                    <Progress value={progress} className="h-2.5" />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{Math.round(progress)}%</span>
                                        <span>{mode === 'work' ? 'Stay focused' : 'Relax'}</span>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-4">
                                    <Button
                                        size="lg"
                                        onClick={toggleTimer}
                                        className={`px-8 h-12 text-base rounded-full transition-all ${isActive ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-105'}`}
                                    >
                                        {isActive ? (
                                            <>
                                                <Pause className="h-5 w-5 mr-2" />
                                                Pause
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-5 w-5 mr-2" />
                                                Start
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={resetTimer}
                                        className="h-12 w-12 rounded-full"
                                        title="Reset Timer"
                                    >
                                        <Square className="h-4 w-4" />
                                    </Button>

                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={skipTimer}
                                        className="h-12 w-12 rounded-full"
                                        title="Skip Session"
                                    >
                                        <SkipForward className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Pomodoro Counter */}
                                <div className="flex items-center gap-3 mt-2 bg-muted/30 px-4 py-1.5 rounded-full">
                                    <span className="text-xs font-medium text-muted-foreground">Session:</span>
                                    <div className="flex gap-1.5">
                                        {[...Array(4)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i < pomodoroCount % 4
                                                    ? 'bg-primary scale-110'
                                                    : 'bg-muted-foreground/20'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs font-medium ml-1 text-foreground">
                                        {pomodoroCount % 4}/4
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Cards Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card className="bg-card/50">
                            <CardHeader className="p-4 pb-2">
                                <CardDescription className="text-xs">Today</CardDescription>
                                <CardTitle className="text-lg">{(todayFocusTime / 3600).toFixed(1)}h</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card className="bg-card/50">
                            <CardHeader className="p-4 pb-2">
                                <CardDescription className="text-xs">Focus</CardDescription>
                                <CardTitle className="text-lg">{pomodoroCount}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card className="bg-card/50">
                            <CardHeader className="p-4 pb-2">
                                <CardDescription className="text-xs">Streak</CardDescription>
                                <CardTitle className="text-lg">🔥 3</CardTitle>
                            </CardHeader>
                        </Card>
                    </div>
                </div>

                {/* Task Column */}
                <div className="space-y-6">
                    <Card className="h-full flex flex-col border-2 bg-card/50 backdrop-blur-sm">
                        <CardHeader className="p-4">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                Tasks
                            </CardTitle>
                            <CardDescription className="text-xs">Select a task to track your focus</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-4 p-4 pt-0">
                            <form onSubmit={handleAddTask} className="flex gap-2">
                                <Input
                                    placeholder="Add a new task..."
                                    value={newTaskText}
                                    onChange={(e) => setNewTaskText(e.target.value)}
                                    className="bg-muted/50 h-9 text-sm"
                                />
                                <Button type="submit" size="icon" className="h-9 w-9" disabled={!newTaskText.trim()}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </form>

                            <ScrollArea className="flex-1 pr-4 -mr-4 h-[250px] lg:h-[350px]">
                                <div className="space-y-2">
                                    {tasks.length === 0 && (
                                        <div className="text-center text-muted-foreground py-8 text-xs">
                                            No tasks yet. Add one to get started!
                                        </div>
                                    )}
                                    {tasks.map(task => (
                                        <TiltCard
                                            key={task.id}
                                            className={`group flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${selectedTaskId === task.id ? 'bg-primary/5 border-primary ring-1 ring-primary/20' : 'bg-card hover:bg-accent/50'}`}
                                            onClick={() => setSelectedTaskId(task.id)}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTaskCompletion(task.id);
                                                }}
                                                className={`shrink-0 ${task.completed ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                            >
                                                {task.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                            </button>
                                            <span className={`flex-1 text-xs font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                                                {task.text}
                                            </span>
                                            {selectedTaskId === task.id && (
                                                <Badge variant="secondary" className="text-[9px] h-4 px-1">Active</Badge>
                                            )}
                                        </TiltCard>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

