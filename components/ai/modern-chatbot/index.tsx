'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ChatbotProvider, useChatbot } from './context';
import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { Sparkles, Maximize2, Minimize2, Plus, MessageSquare, Search, X, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

export function ModernChatbot() {
    return (
        <ChatbotProvider>
            <ChatbotContent />
        </ChatbotProvider>
    );
}

function ChatbotContent() {
    const { createConversation, sidebarCollapsed } = useChatbot();
    const containerRef = useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)

    const toggleFullscreen = useCallback(async () => {
        if (!containerRef.current) return

        try {
            if (!document.fullscreenElement) {
                await containerRef.current.requestFullscreen()
                setIsFullscreen(true)
            } else {
                await document.exitFullscreen()
                setIsFullscreen(false)
            }
        } catch (err) {
            console.error('Fullscreen toggle failed:', err)
        }
    }, [])

    return (
        <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-transparent">
            {/* Noise Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none z-0 mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
                }}
            />

            {/* Glass Background */}
            <div className="absolute inset-0 bg-[#060608] z-0" />

            {/* Premium Dynamic Ambient Glow Orbs */}
            <div className="absolute top-[-10%] left-[-15%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[130px] pointer-events-none z-0 animate-pulse" style={{ animationDuration: '10s' }} />
            <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none z-0" />
            <div className="absolute top-[25%] right-[20%] w-[35%] h-[35%] rounded-full bg-primary/5 blur-[100px] pointer-events-none z-0" />

            {/* Ultra-fine Accent Grid Overlay */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.025]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(var(--primary-rgb), 0.25) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(var(--primary-rgb), 0.25) 1px, transparent 1px)
                    `,
                    backgroundSize: '48px 48px'
                }}
            />

            {/* Content Container */}
            <div className="relative z-10 flex h-full w-full bg-transparent overflow-hidden">
                {/* Sidebar - desktop only */}
                <div className={`hidden md:flex flex-shrink-0 h-full transition-all duration-500 ease-in-out ${sidebarCollapsed ? 'w-16' : 'w-72 lg:w-80'}`}>
                    <Sidebar />
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col relative min-w-0 min-h-0 overflow-hidden bg-black/20">
                    {/* Header */}
                    <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-[#0B0B0F]/90 backdrop-blur-xl z-30 shadow-sm">
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Back to Dashboard on Mobile */}
                            <Link href="/" className="md:hidden p-2 -ml-2 text-white/40 hover:text-white transition-colors">
                                <Home className="w-5 h-5" />
                            </Link>

                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                <Sparkles className="h-4 w-4 text-primary" />
                            </div>
                            <h1 className="text-xs sm:text-sm font-bold tracking-widest uppercase text-white/90 truncate max-w-[120px] sm:max-w-none">
                                AI Assistant
                            </h1>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                            {/* Mobile New Chat Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={createConversation}
                                className="md:hidden h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>

                            {/* Mobile History Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsMobileDrawerOpen(true)}
                                className="md:hidden h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
                            >
                                <MessageSquare className="h-4 w-4" />
                            </Button>

                            {/* Smart Mode Indicator - Hidden on very small screens if needed, or compact */}
                            <div className="hidden xs:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-bold tracking-tighter text-primary uppercase">Safe Mode</span>
                            </div>

                            {/* Fullscreen Toggle */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleFullscreen}
                                className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                            >
                                {isFullscreen ? (
                                    <Minimize2 className="h-4 w-4" />
                                ) : (
                                    <Maximize2 className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Drawer Overlay */}
                    <AnimatePresence>
                        {isMobileDrawerOpen && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsMobileDrawerOpen(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                                />
                                <motion.div
                                    initial={{ x: '-100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '-100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="absolute top-0 left-0 bottom-0 w-[85%] max-w-xs bg-[#050505] z-50 md:hidden flex flex-col border-r border-white/10"
                                >
                                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                                        <h2 className="text-xs font-bold text-white/90 tracking-widest uppercase italic">Historial</h2>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsMobileDrawerOpen(false)}
                                            className="h-8 w-8 text-white/40 hover:text-white"
                                        >
                                            <X className="w-5 h-5" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 overflow-hidden" onClick={(e) => {
                                        // Close drawer when a conversation is selected
                                        if ((e.target as HTMLElement).closest('[data-conversation-item]')) {
                                            setTimeout(() => setIsMobileDrawerOpen(false), 300);
                                        }
                                    }}>
                                        <Sidebar />
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Messages & Input - Filling available space */}
                    <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
                        <ChatArea />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ModernChatbot;
