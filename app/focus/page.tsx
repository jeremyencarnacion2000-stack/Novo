'use client';

import React, { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, SkipForward, Settings } from 'lucide-react';
import { usePomodoroTimer } from '@/hooks/use-pomodoro-timer';
import { motion } from 'framer-motion';

export default function FocusPage() {
    const {
        timeLeft,
        isRunning,
        sessionType,
        pomodoroCount,
        start,
        pause,
        stop,
        skip,
        getProgress,
    } = usePomodoroTimer();

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = getProgress();

    return (
        <DashboardShell>
            <div className="flex flex-col gap-6 md:gap-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                            Focus Mode
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {sessionType === 'work'
                                ? 'Deep work session'
                                : 'Take a break and recharge'}
                        </p>
                    </div>
                    <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>

                {/* Main Timer Card */}
                <Card className="border-2">
                    <CardContent className="pt-12 pb-12">
                        <div className="flex flex-col items-center gap-8">
                            {/* Session Type Badge */}
                            <Badge
                                variant={sessionType === 'work' ? 'default' : 'secondary'}
                                className="text-lg px-6 py-2"
                            >
                                {sessionType === 'work' ? '🎯 Focus Session' : '☕ Break Time'}
                            </Badge>

                            {/* Timer Display */}
                            <motion.div
                                className="relative"
                                animate={{ scale: isRunning ? [1, 1.02, 1] : 1 }}
                                transition={{ repeat: isRunning ? Infinity : 0, duration: 2 }}
                            >
                                <div className="text-8xl md:text-9xl font-bold tracking-tight text-center font-mono">
                                    {formatTime(timeLeft)}
                                </div>
                            </motion.div>

                            {/* Progress Bar */}
                            <div className="w-full max-w-md">
                                <Progress value={progress} className="h-3" />
                                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                                    <span>{Math.round(progress)}%</span>
                                    <span>{formatTime(timeLeft)} remaining</span>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-3">
                                {!isRunning ? (
                                    <Button
                                        size="lg"
                                        onClick={start}
                                        className="px-8"
                                    >
                                        <Play className="h-5 w-5 mr-2" />
                                        Start
                                    </Button>
                                ) : (
                                    <Button
                                        size="lg"
                                        onClick={pause}
                                        variant="secondary"
                                        className="px-8"
                                    >
                                        <Pause className="h-5 w-5 mr-2" />
                                        Pause
                                    </Button>
                                )}

                                <Button
                                    size="lg"
                                    onClick={stop}
                                    variant="outline"
                                >
                                    <Square className="h-5 w-5 mr-2" />
                                    Stop
                                </Button>

                                <Button
                                    size="lg"
                                    onClick={skip}
                                    variant="outline"
                                >
                                    <SkipForward className="h-5 w-5 mr-2" />
                                    Skip
                                </Button>
                            </div>

                            {/* Pomodoro Counter */}
                            <div className="flex items-center gap-2 mt-4">
                                <span className="text-sm text-muted-foreground">Pomodoros:</span>
                                <div className="flex gap-1">
                                    {[...Array(4)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-3 h-3 rounded-full ${i < pomodoroCount % 4
                                                    ? 'bg-primary'
                                                    : 'bg-secondary'
                                                }`}
                                        />
                                    ))}
                                </div>
                                <span className="text-sm font-medium ml-2">
                                    {pomodoroCount % 4}/4
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Today</CardDescription>
                            <CardTitle className="text-2xl">0h 0m</CardTitle>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>This Week</CardDescription>
                            <CardTitle className="text-2xl">0h 0m</CardTitle>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Streak</CardDescription>
                            <CardTitle className="text-2xl">0 days 🔥</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                {/* Task Selection (Placeholder) */}
                <Card>
                    <CardHeader>
                        <CardTitle>What are you working on?</CardTitle>
                        <CardDescription>
                            Select a task to track your time
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="justify-start w-full">
                                Select task...
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardShell>
    );
}
