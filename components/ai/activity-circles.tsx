'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ActivityCirclesProps {
    className?: string
    data?: {
        label: string
        value: string
        unit: string
        color: string
        size: number
        x: number
        y: number
    }[]
}

export function ActivityCircles({ className, data = [] }: ActivityCirclesProps) {
    // Default demo data if none provided
    const items = data.length > 0 ? data : [
        { label: 'Calories intake', value: '1.875', unit: 'kcal', color: '#FFD600', size: 180, x: 60, y: 40 },
        { label: 'Calories burned', value: '850', unit: 'kcal', color: '#FF5C5C', size: 140, x: 40, y: 65 },
        { label: 'Activity time', value: '2.30', unit: 'hours', color: '#1A1A1A', size: 100, x: 40, y: 30 },
    ]

    return (
        <div className={cn("relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden", className)}>
            {/* Background Blobs */}
            <div className="absolute inset-0 pointer-events-none">
                {items.map((item, i) => (
                    <motion.div
                        key={`blob-${i}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.4 }}
                        transition={{ duration: 1.5, delay: i * 0.2, ease: "easeOut" }}
                        className="absolute rounded-full blur-[60px]"
                        style={{
                            width: item.size * 1.5,
                            height: item.size * 1.5,
                            backgroundColor: item.color,
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    />
                ))}
            </div>

            {/* Interactive Circles */}
            <div className="relative w-full h-full">
                {items.map((item, i) => (
                    <motion.div
                        key={`circle-${i}`}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                        className="absolute flex flex-col items-center justify-center rounded-full glass-blur border border-white/20 shadow-xl"
                        style={{
                            width: item.size,
                            height: item.size,
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: item.color === '#1A1A1A' ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        <span className={cn(
                            "text-2xl font-black tracking-tight",
                            item.color === '#1A1A1A' ? "text-white" : "text-foreground"
                        )}>
                            {item.value}
                        </span>
                        <span className={cn(
                            "text-[10px] uppercase font-bold tracking-widest opacity-60",
                            item.color === '#1A1A1A' ? "text-white/60" : "text-foreground/60"
                        )}>
                            {item.unit}
                        </span>
                    </motion.div>
                ))}
            </div>

            {/* Legend */}
            <div className="absolute bottom-6 left-8 flex flex-col gap-2">
                {items.map((item, i) => (
                    <div key={`legend-${i}`} className="flex items-center gap-3">
                        <div className="h-2 w-8 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
