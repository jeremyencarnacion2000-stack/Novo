'use client';

import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Play, Pause, Square, SkipForward, Plus, CheckCircle2, Circle, Target, Coffee, Trees, Flame } from 'lucide-react';
import { useFocus } from '@/lib/focus-context';
import { FocusSettings } from '@/components/focus/focus-settings';
import { useAnalytics } from '@/hooks/use-swr';
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
    
    // Fetch real focus time from analytics using SWR
    const { data: analyticsData } = useAnalytics();
    
    const todayFocusTimeStr = analyticsData?.focusTime || '0.0h';
    const streakDays = analyticsData?.streak || 0;

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
                    <div
                        className="relative rounded-[28px] border border-foreground/[0.07] p-8"
                        style={{
                            background: 'rgba(255,255,255,0.015)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                    >
                        <GlassSurface
                            radius={28}
                            depth={12}
                            blur={1}
                            strength={50}
                            chromaticAberration={14}
                            backgroundColor="transparent"
                            elevation="low"
                            aria-hidden
                            className="pointer-events-none"
                            style={{ position: 'absolute', inset: '-3px', zIndex: 0, borderRadius: 'inherit' }}
                        />
                        {/* Grain noise overlay */}
                        <div 
                            className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                            }}
                        />

                        <div className="relative z-10 flex flex-col items-center gap-6">
                            {/* Session Type Badge */}
                            <Badge
                                variant={mode === 'work' ? 'default' : 'secondary'}
                                className="text-base px-5 py-1.5 transition-colors duration-300 gap-1.5"
                            >
                                {mode === 'work' ? <Target className="w-4 h-4" /> : (mode === 'shortBreak' ? <Coffee className="w-4 h-4" /> : <Trees className="w-4 h-4" />)}
                                {mode === 'work' ? 'Focus Session' : (mode === 'shortBreak' ? 'Short Break' : 'Long Break')}
                            </Badge>

                            {/* Timer Display */}
                            <motion.div
                                className="relative"
                                animate={{ scale: isActive ? [1, 1.02, 1] : 1 }}
                                transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
                            >
                                <div className="text-6xl sm:text-7xl md:text-9xl font-bold tracking-tight text-center font-mono tabular-nums">
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
                    </div>

                    {/* Stats Cards Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div
                            className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] hover:border-foreground/[0.11] transition-all duration-400 p-4 cursor-default group"
                            style={{
                                background: 'rgba(255,255,255,0.015)',
                                backdropFilter: 'blur(12px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                            }}
                        >
                            <p className="text-[10px] font-black tracking-widest uppercase text-foreground/40 group-hover:text-foreground/60 transition-colors">Deep work today</p>
                            <p className="text-xl font-black text-foreground mt-1.5">{todayFocusTimeStr}</p>
                            <p className="text-[9px] text-foreground/30 font-medium mt-1">
                                {parseFloat(todayFocusTimeStr) > 0 ? 'above yesterday\'s session' : 'establish focus index'}
                            </p>
                        </div>
                        <div
                            className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] hover:border-foreground/[0.11] transition-all duration-400 p-4 cursor-default group"
                            style={{
                                background: 'rgba(255,255,255,0.015)',
                                backdropFilter: 'blur(12px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                            }}
                        >
                            <p className="text-[10px] font-black tracking-widest uppercase text-foreground/40 group-hover:text-foreground/60 transition-colors">Sessions completed</p>
                            <p className="text-xl font-black text-foreground mt-1.5">{pomodoroCount}</p>
                            <p className="text-[9px] text-foreground/30 font-medium mt-1">
                                {pomodoroCount > 0 ? 'building consistency momentum' : 'no sessions registered today'}
                            </p>
                        </div>
                        <div
                            className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] hover:border-foreground/[0.11] transition-all duration-400 p-4 cursor-default group"
                            style={{
                                background: 'rgba(255,255,255,0.015)',
                                backdropFilter: 'blur(12px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                            }}
                        >
                            <p className="text-[10px] font-black tracking-widest uppercase text-foreground/40 group-hover:text-foreground/60 transition-colors">Active streak</p>
                            <p className="text-xl font-black text-foreground mt-1.5 flex items-center gap-1"><Flame className="w-4 h-4 text-orange-400" /> {streakDays}d</p>
                            <p className="text-[9px] text-foreground/30 font-medium mt-1">
                                {streakDays > 0 ? 'maintaining execution fidelity' : 'start a streak today'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Task Column */}
                <div className="space-y-6">
                    <div
                        className="h-full flex flex-col relative overflow-hidden rounded-[28px] border border-foreground/[0.07] p-4"
                        style={{
                            background: 'rgba(255,255,255,0.015)',
                            backdropFilter: 'blur(12px)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                    >
                        <div className="p-0 pb-4">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                Tasks
                            </h2>
                            <p className="text-xs text-foreground/40 mt-1">Select a task to track your focus</p>
                        </div>
                        <div className="flex-1 flex flex-col gap-4">
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
                                        <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
                                            <div
                                                className="w-10 h-10 rounded-xl border border-primary/15 flex items-center justify-center"
                                                style={{ background: 'rgba(99,102,241,0.06)' }}
                                            >
                                                <CheckCircle2 className="h-4 w-4 text-primary/50" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-muted-foreground">
                                                    No task selected for this session
                                                </p>
                                                <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">
                                                    Linking a task lets Novo attribute this focus time to your
                                                    completion rate and improve future scheduling.
                                                </p>
                                            </div>
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

