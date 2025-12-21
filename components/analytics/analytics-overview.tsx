'use client';

import React, { useState, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from 'lucide-react';

interface AnalyticsOverviewProps {
    data: any[];
    metrics: any;
}

type MetricType = 'time' | 'productivity' | 'completions';
type ViewMode = 'monthly' | 'weekly';

export function AnalyticsOverview({ data, metrics }: AnalyticsOverviewProps) {
    const [selectedMonth, setSelectedMonth] = useState(() => {
        return new Date().toLocaleString('en-US', { month: 'short' });
    });
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('time');
    const [viewMode, setViewMode] = useState<ViewMode>('monthly');

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Filter data based on selected month and view mode
    const filteredData = useMemo(() => {
        if (!data) return [];

        // First filter by month
        const monthData = data.filter(item => {
            return item.date.startsWith(selectedMonth);
        });

        // Then apply view mode filter
        if (viewMode === 'weekly') {
            // Get last 7 days of the month
            return monthData.slice(-7);
        }

        return monthData;
    }, [data, selectedMonth, viewMode]);

    // Calculate dynamic stats based on filtered data
    const currentStats = useMemo(() => {
        if (filteredData.length === 0) {
            return {
                totalTime: 0,
                productivity: 0,
                completions: 0,
            };
        }

        const totalTime = filteredData.reduce((acc, curr) => acc + curr.totalTimeSpent, 0);
        const totalProductivity = filteredData.reduce((acc, curr) => acc + curr.productivityScore, 0);
        const avgProductivity = totalProductivity / filteredData.length;
        const totalCompletions = filteredData.reduce((acc, curr) =>
            acc + (curr.tasksCompleted || 0) + (curr.routinesCompleted || 0) + (curr.habitsCompleted || 0), 0);

        return {
            totalTime: Math.round(totalTime),
            productivity: Math.round(avgProductivity),
            completions: totalCompletions,
        };
    }, [filteredData]);

    // Get data key and unit based on selected metric
    const getChartConfig = () => {
        switch (selectedMetric) {
            case 'time':
                return { dataKey: 'totalTimeSpent', unit: 'hrs', label: 'Time Spent' };
            case 'productivity':
                return { dataKey: 'productivityScore', unit: '%', label: 'Productivity' };
            case 'completions':
                return { dataKey: 'totalCompletions', unit: '', label: 'Completions' };
        }
    };

    const chartData = useMemo(() => {
        return filteredData.map(item => ({
            ...item,
            totalCompletions: (item.tasksCompleted || 0) + (item.routinesCompleted || 0) + (item.habitsCompleted || 0)
        }));
    }, [filteredData]);

    const chartConfig = getChartConfig();

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-800/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-xl text-white">
                    <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
                    <p className="text-lg font-bold">
                        {payload[0].value} <span className="text-xs font-normal text-slate-300">{chartConfig.unit}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full rounded-[40px] bg-white/5 backdrop-blur-[40px] border border-white/20 p-6 md:p-8 text-white shadow-2xl overflow-hidden relative transition-all duration-500 group">
            {/* Background Accents for Liquid Glass Effect */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-indigo-500/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-purple-500/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-[20%] left-[30%] w-[40%] h-[40%] bg-emerald-500/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Overview</h2>
                        <p className="text-white/40 text-sm mt-1 font-medium uppercase tracking-wider">{chartConfig.label} Trends</p>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-5 py-2 text-sm font-bold flex items-center gap-2 cursor-pointer hover:bg-white/20 transition-all hover:scale-105 active:scale-95 outline-none shadow-lg">
                                <span>{viewMode === 'monthly' ? 'Monthly' : 'Weekly'}</span>
                                <ChevronDown className="w-4 h-4 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900/80 backdrop-blur-2xl border-white/10 text-white min-w-[140px] rounded-2xl p-2 shadow-2xl">
                            <DropdownMenuItem
                                onClick={() => setViewMode('monthly')}
                                className="hover:bg-white/10 focus:bg-white/10 cursor-pointer rounded-xl py-2 font-medium"
                            >
                                Monthly View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setViewMode('weekly')}
                                className="hover:bg-white/10 focus:bg-white/10 cursor-pointer rounded-xl py-2 font-medium"
                            >
                                Weekly View
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Chart Area */}
                <div className="h-[240px] w-full mb-8 relative">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.4)" />
                                        <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
                                    </linearGradient>
                                </defs>
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2, strokeDasharray: '6 6' }}
                                />
                                <Area
                                    key={`${selectedMetric}-${viewMode}`}
                                    type="monotone"
                                    dataKey={chartConfig.dataKey}
                                    stroke="#6366f1"
                                    strokeWidth={4}
                                    fill="url(#chartGradient)"
                                    animationDuration={1500}
                                    activeDot={{
                                        r: 8,
                                        fill: "#fff",
                                        stroke: "#6366f1",
                                        strokeWidth: 4,
                                        className: "shadow-2xl"
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-white/20">
                            <p className="font-medium tracking-widest uppercase text-xs">No data for {selectedMonth}</p>
                        </div>
                    )}
                </div>

                {/* Month Selector */}
                <div className="flex justify-between items-center mb-10 px-2 overflow-x-auto no-scrollbar gap-4 pb-2">
                    {months.map((month) => (
                        <button
                            key={month}
                            onClick={() => setSelectedMonth(month)}
                            className={cn(
                                "text-xs font-bold transition-all duration-300 px-4 py-2 rounded-full whitespace-nowrap uppercase tracking-tighter",
                                selectedMonth === month
                                    ? "bg-white text-indigo-600 shadow-[0_10px_20px_rgba(255,255,255,0.2)] scale-110"
                                    : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {month}
                        </button>
                    ))}
                </div>

                {/* Summary Stats - Interactive Buttons */}
                <div className="grid grid-cols-3 gap-4 mt-auto">
                    {/* Stat 1: Total Time */}
                    <button
                        onClick={() => setSelectedMetric('time')}
                        className={cn(
                            "rounded-[24px] p-5 border text-center transition-all duration-500 relative overflow-hidden group/btn",
                            selectedMetric === 'time'
                                ? "bg-white/15 backdrop-blur-md border-white/30 transform scale-105 shadow-2xl ring-1 ring-white/20"
                                : "bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20"
                        )}
                    >
                        <div className={cn(
                            "absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 transition-opacity duration-500",
                            selectedMetric === 'time' && "opacity-100"
                        )} />
                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors relative z-10", selectedMetric === 'time' ? "text-white" : "text-white/40")}>Active Hours</p>
                        <p className="text-2xl md:text-3xl font-black relative z-10">
                            {currentStats.totalTime} <span className="text-xs font-bold text-white/40 ml-1">Hr</span>
                        </p>
                    </button>

                    {/* Stat 2: Productivity */}
                    <button
                        onClick={() => setSelectedMetric('productivity')}
                        className={cn(
                            "rounded-[24px] p-5 border text-center transition-all duration-500 relative overflow-hidden group/btn",
                            selectedMetric === 'productivity'
                                ? "bg-white/15 backdrop-blur-md border-white/30 transform scale-105 shadow-2xl ring-1 ring-white/20"
                                : "bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20"
                        )}
                    >
                        <div className={cn(
                            "absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 transition-opacity duration-500",
                            selectedMetric === 'productivity' && "opacity-100"
                        )} />
                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors relative z-10", selectedMetric === 'productivity' ? "text-white" : "text-white/40")}>Productivity</p>
                        <p className="text-3xl md:text-4xl font-black relative z-10">
                            {currentStats.productivity}%
                        </p>
                    </button>

                    {/* Stat 3: Completions */}
                    <button
                        onClick={() => setSelectedMetric('completions')}
                        className={cn(
                            "rounded-[24px] p-5 border text-center transition-all duration-500 relative overflow-hidden group/btn",
                            selectedMetric === 'completions'
                                ? "bg-white/15 backdrop-blur-md border-white/30 transform scale-105 shadow-2xl ring-1 ring-white/20"
                                : "bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20"
                        )}
                    >
                        <div className={cn(
                            "absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 transition-opacity duration-500",
                            selectedMetric === 'completions' && "opacity-100"
                        )} />
                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors relative z-10", selectedMetric === 'completions' ? "text-white" : "text-white/40")}>Completions</p>
                        <p className="text-2xl md:text-3xl font-black relative z-10">
                            {currentStats.completions}
                        </p>
                    </button>
                </div>
            </div>
        </div>
    );
}
