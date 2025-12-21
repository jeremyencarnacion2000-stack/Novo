'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    TrendingUp,
    Target,
    Clock,
    CheckSquare,
    Flame,
    BarChart3,
    Calendar,
    Award,
} from 'lucide-react';

interface ProductivityStats {
    period: string;
    productivityScore: number;
    summary: {
        tasks: {
            total: number;
            completed: number;
            completionRate: number;
        };
        projects: {
            active: number;
            completed: number;
            totalTasks: number;
            completedTasks: number;
        };
        focus: {
            totalMinutes: number;
            totalHours: number;
            sessions: number;
            avgQuality: number;
        };
        habits: {
            total: number;
            avgCompletionRate: number;
            topPerformers: Array<{ name: string; rate: number }>;
        };
        goals: {
            total: number;
            avgProgress: number;
        };
    };
    dailyStats: Array<{
        date: string;
        tasksCompleted: number;
        tasksCreated: number;
        focusMinutes: number;
        focusSessions: number;
    }>;
    streaks: {
        current: number;
        longest: number;
    };
}

export default function StatsPage() {
    const [stats, setStats] = useState<ProductivityStats | null>(null);
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/stats/productivity?period=${period}`);
                if (response.ok) {
                    const data = await response.json();
                    setStats(data);
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [period]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-500';
        if (score >= 60) return 'text-yellow-500';
        if (score >= 40) return 'text-orange-500';
        return 'text-red-500';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Needs Work';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Unable to load statistics</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        Productivity Statistics
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Your performance overview
                    </p>
                </div>
                <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                    <TabsList>
                        <TabsTrigger value="day">Today</TabsTrigger>
                        <TabsTrigger value="week">Week</TabsTrigger>
                        <TabsTrigger value="month">Month</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Productivity Score Card */}
            <Card className="border-2">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Productivity Score</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-5xl font-bold ${getScoreColor(stats.productivityScore)}`}>
                                    {stats.productivityScore}
                                </span>
                                <span className="text-2xl text-muted-foreground">/100</span>
                            </div>
                            <Badge variant="secondary" className="mt-2">
                                {getScoreLabel(stats.productivityScore)}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <Flame className="h-8 w-8 mx-auto text-orange-500" />
                                <p className="text-2xl font-bold">{stats.streaks.current}</p>
                                <p className="text-xs text-muted-foreground">Day Streak</p>
                            </div>
                            <div className="text-center">
                                <Award className="h-8 w-8 mx-auto text-yellow-500" />
                                <p className="text-2xl font-bold">{stats.streaks.longest}</p>
                                <p className="text-xs text-muted-foreground">Best Streak</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Tasks */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-blue-500" />
                            Tasks
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.summary.tasks.completed}/{stats.summary.tasks.total}
                        </div>
                        <Progress
                            value={stats.summary.tasks.completionRate}
                            className="h-2 mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.summary.tasks.completionRate}% completion rate
                        </p>
                    </CardContent>
                </Card>

                {/* Focus Time */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4 text-purple-500" />
                            Focus Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.summary.focus.totalHours}h
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {stats.summary.focus.sessions} sessions
                        </p>
                        {stats.summary.focus.avgQuality > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Avg quality: {stats.summary.focus.avgQuality}/5
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Habits */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            Habits
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.summary.habits.avgCompletionRate}%
                        </div>
                        <Progress
                            value={stats.summary.habits.avgCompletionRate}
                            className="h-2 mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.summary.habits.total} habits tracked
                        </p>
                    </CardContent>
                </Card>

                {/* Goals */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Target className="h-4 w-4 text-red-500" />
                            Goals
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.summary.goals.avgProgress}%
                        </div>
                        <Progress
                            value={stats.summary.goals.avgProgress}
                            className="h-2 mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.summary.goals.total} active goals
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Projects Overview */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Projects Overview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold">{stats.summary.projects.active}</p>
                            <p className="text-sm text-muted-foreground">Active</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold">{stats.summary.projects.completed}</p>
                            <p className="text-sm text-muted-foreground">Completed</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold">{stats.summary.projects.totalTasks}</p>
                            <p className="text-sm text-muted-foreground">Total Tasks</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold">{stats.summary.projects.completedTasks}</p>
                            <p className="text-sm text-muted-foreground">Tasks Done</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Daily Activity Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Daily Activity
                    </CardTitle>
                    <CardDescription>Tasks and focus time over time</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-48 flex items-end gap-1">
                        {stats.dailyStats.slice(-14).map((day, i) => {
                            const maxTasks = Math.max(...stats.dailyStats.map(d => d.tasksCompleted), 1);
                            const height = (day.tasksCompleted / maxTasks) * 100;
                            return (
                                <div
                                    key={day.date}
                                    className="flex-1 flex flex-col items-center gap-1"
                                >
                                    <div
                                        className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                                        style={{ height: `${Math.max(height, 4)}%` }}
                                        title={`${day.tasksCompleted} tasks on ${day.date}`}
                                    />
                                    <span className="text-[10px] text-muted-foreground rotate-45 origin-left">
                                        {new Date(day.date).getDate()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Top Habits */}
            {stats.summary.habits.topPerformers.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Top Performing Habits</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.summary.habits.topPerformers.map((habit, i) => (
                                <div key={habit.name} className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-muted-foreground">
                                        #{i + 1}
                                    </span>
                                    <div className="flex-1">
                                        <p className="font-medium">{habit.name}</p>
                                        <Progress value={habit.rate} className="h-2 mt-1" />
                                    </div>
                                    <span className="font-medium">{Math.round(habit.rate)}%</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

