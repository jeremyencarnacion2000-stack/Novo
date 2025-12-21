'use client';

import React, { useState } from 'react';

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

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskText.trim()) {
            addTask(newTaskText);
            setNewTaskText('');
        }
    };

    return (
        <div className="flex flex-col gap-6 md:gap-8 max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        Focus Mode
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {mode === 'work'
                            ? 'Deep work session'
                            : 'Take a break and recharge'}
                    </p>
                </div>
                <FocusSettings />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Timer Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-2 shadow-sm">
                        <CardContent className="pt-12 pb-12">
                            <div className="flex flex-col items-center gap-8">
                                {/* Session Type Badge */}
                                <Badge
                                    variant={mode === 'work' ? 'default' : 'secondary'}
                                    className="text-lg px-6 py-2 transition-colors duration-300"
                                >
                                    {mode === 'work' ? '🎯 Focus Session' : (mode === 'shortBreak' ? '☕ Short Break' : '🌴 Long Break')}
                                </Badge>

                                {/* Timer Display */}
                                <motion.div
                                    className="relative"
                                    animate={{ scale: isActive ? [1, 1.02, 1] : 1 }}
                                    transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
                                >
                                    <div className="text-8xl md:text-9xl font-bold tracking-tight text-center font-mono tabular-nums">
                                        {formatTime(time)}
                                    </div>
                                </motion.div>

                                {/* Progress Bar */}
                                <div className="w-full max-w-md space-y-2">
                                    <Progress value={progress} className="h-3" />
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>{Math.round(progress)}%</span>
                                        <span>{mode === 'work' ? 'Stay focused' : 'Relax'}</span>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-4">
                                    <Button
                                        size="lg"
                                        onClick={toggleTimer}
                                        className={`px-8 h-14 text-lg rounded-full transition-all ${isActive ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-105'}`}
                                    >
                                        {isActive ? (
                                            <>
                                                <Pause className="h-6 w-6 mr-2" />
                                                Pause
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-6 w-6 mr-2" />
                                                Start
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={resetTimer}
                                        className="h-14 w-14 rounded-full"
                                        title="Reset Timer"
                                    >
                                        <Square className="h-5 w-5" />
                                    </Button>

                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={skipTimer}
                                        className="h-14 w-14 rounded-full"
                                        title="Skip Session"
                                    >
                                        <SkipForward className="h-5 w-5" />
                                    </Button>
                                </div>

                                {/* Pomodoro Counter */}
                                <div className="flex items-center gap-3 mt-4 bg-muted/30 px-4 py-2 rounded-full">
                                    <span className="text-sm font-medium text-muted-foreground">Session:</span>
                                    <div className="flex gap-1.5">
                                        {[...Array(4)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-3 h-3 rounded-full transition-all duration-300 ${i < pomodoroCount % 4
                                                    ? 'bg-primary scale-110'
                                                    : 'bg-muted-foreground/20'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-sm font-medium ml-2 text-foreground">
                                        {pomodoroCount % 4}/4
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Cards Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardDescription>Today</CardDescription>
                                <CardTitle className="text-xl">{(pomodoroCount * 25 / 60).toFixed(1)}h</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardDescription>Focus</CardDescription>
                                <CardTitle className="text-xl">{pomodoroCount}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardDescription>Streak</CardDescription>
                                <CardTitle className="text-xl">🔥 3</CardTitle>
                            </CardHeader>
                        </Card>
                    </div>
                </div>

                {/* Task Column */}
                <div className="space-y-6">
                    <Card className="h-full flex flex-col border-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                Tasks
                            </CardTitle>
                            <CardDescription>Select a task to track your focus</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-4">
                            <form onSubmit={handleAddTask} className="flex gap-2">
                                <Input
                                    placeholder="Add a new task..."
                                    value={newTaskText}
                                    onChange={(e) => setNewTaskText(e.target.value)}
                                    className="bg-muted/50"
                                />
                                <Button type="submit" size="icon" disabled={!newTaskText.trim()}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </form>

                            <ScrollArea className="flex-1 pr-4 -mr-4 h-[300px] lg:h-auto">
                                <div className="space-y-2">
                                    {tasks.length === 0 && (
                                        <div className="text-center text-muted-foreground py-8 text-sm">
                                            No tasks yet. Add one to get started!
                                        </div>
                                    )}
                                    {tasks.map(task => (
                                        <TiltCard
                                            key={task.id}
                                            className={`group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${selectedTaskId === task.id ? 'bg-primary/5 border-primary ring-1 ring-primary/20' : 'bg-card hover:bg-accent/50'}`}
                                            onClick={() => setSelectedTaskId(task.id)}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTaskCompletion(task.id);
                                                }}
                                                className={`shrink-0 ${task.completed ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                            >
                                                {task.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                            </button>
                                            <span className={`flex-1 text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                                                {task.text}
                                            </span>
                                            {selectedTaskId === task.id && (
                                                <Badge variant="secondary" className="text-[10px] h-5">Active</Badge>
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

