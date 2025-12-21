'use client';

import React from 'react';
import { ChatbotProvider } from './context';
import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { Sparkles } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

export function ModernChatbot() {
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';

    return (
        <ChatbotProvider>
            <div
                className="fixed inset-0 overflow-hidden z-10 bg-[#0B0B0F] transition-all duration-300 ease-in-out m-4 rounded-[40px] border border-white/5 shadow-2xl"
                style={{
                    left: isCollapsed ? 'var(--sidebar-width-icon)' : 'var(--sidebar-width)'
                }}
            >
                {/* Noise Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none z-0 mix-blend-overlay"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
                    }}
                />

                {/* Glass Background - Consistent across the whole section */}
                <div className="absolute inset-0 bg-[#0B0B0F]/80 backdrop-blur-2xl z-0" />

                {/* Content Container */}
                <div className="relative z-10 flex h-full w-full bg-transparent">
                    {/* Sidebar - Con scroll independiente */}
                    <Sidebar />

                    {/* Main Chat Area - Con scroll independiente */}
                    <div className="flex-1 flex flex-col relative min-w-0 min-h-0">
                        {/* Header - Fijo */}
                        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <h1 className="text-lg font-semibold tracking-tight text-white/90">AI Chat</h1>
                            </div>

                            {/* Smart Mode Indicator */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                                <Sparkles className="h-4 w-4 text-violet-400" />
                                <span className="text-xs font-medium text-violet-300">Modo Inteligente</span>
                            </div>
                        </div>

                        {/* Messages & Input - Managed by ChatArea */}
                        <ChatArea />
                    </div>
                </div>
            </div>
        </ChatbotProvider>
    );
}

export default ModernChatbot;
