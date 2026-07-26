'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_GLOW: Record<OrbState, string> = {
    idle: 'bg-primary/10 scale-100',
    listening: 'bg-primary/40 scale-110 animate-pulse',
    thinking: 'bg-primary/30 scale-125 animate-pulse',
    speaking: 'bg-primary/35 scale-115 animate-pulse',
};

const SIZE: Record<'sm' | 'md' | 'lg', { outer: string; inner: string }> = {
    sm: { outer: 'w-8 h-8', inner: 'w-6 h-6' },
    md: { outer: 'w-16 h-16', inner: 'w-12 h-12' },
    lg: { outer: 'w-32 h-32', inner: 'w-24 h-24' },
};

export function GlowingOrb({
    state = 'idle',
    size = 'md',
    className,
}: {
    state?: OrbState;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const { outer, inner } = SIZE[size];
    const engaged = state !== 'idle';

    return (
        <div className={cn('relative flex items-center justify-center', outer, className)}>
            <div className={cn('absolute inset-0 rounded-full blur-2xl transition-all duration-1000', STATE_GLOW[state])} />
            <div
                className={cn(
                    'relative rounded-full overflow-hidden transition-transform duration-700 shadow-[0_0_40px_rgba(var(--primary-rgb),0.4)]',
                    inner,
                    state === 'thinking' ? 'scale-110' : state === 'listening' || state === 'speaking' ? 'scale-105' : 'scale-100'
                )}
            >
                <div
                    className={cn(
                        'absolute inset-0 opacity-90',
                        engaged && 'animate-[spin_4s_linear_infinite]'
                    )}
                    style={{
                        background: 'conic-gradient(from 0deg, var(--primary), rgba(var(--primary-rgb), 0.4), var(--primary))'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-white/40 to-transparent mix-blend-overlay" />
                <div className="absolute inset-[3%] rounded-full bg-gradient-to-b from-white/30 to-transparent backdrop-blur-sm border border-white/20" />
            </div>
        </div>
    );
}
