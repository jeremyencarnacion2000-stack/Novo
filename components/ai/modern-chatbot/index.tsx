'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ChatbotProvider, useChatbot } from './context';
import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { DesktopHero, VoiceListeningOverlay } from './welcome-hero';
import {
  Sparkles, Maximize2, Minimize2, Plus, MessageSquare,
  X, Home, PanelLeft, Brain
} from 'lucide-react';
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
    const { createConversation, messages, streamingMessage } = useChatbot();
    const containerRef = useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [isVoiceListening, setIsVoiceListening] = useState(false)

    const isChatActive = messages.length > 0 || streamingMessage !== null

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

    const toggleVoice = useCallback(() => {
        setIsVoiceListening(v => !v)
        window.dispatchEvent(new CustomEvent('toggle-gemini-live'))
    }, [])

    return (
        <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#060608]">
            {/* Ambient glows */}
            <div className="absolute top-[-10%] left-[-15%] w-[50%] h-[50%] rounded-full bg-primary/8 blur-[130px] pointer-events-none z-0 animate-pulse" style={{ animationDuration: '10s' }} />
            <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-violet-500/5 blur-[120px] pointer-events-none z-0" />

            {/* Voice Overlay */}
            <AnimatePresence>
                {isVoiceListening && (
                    <VoiceListeningOverlay onStop={toggleVoice} />
                )}
            </AnimatePresence>

            {/* Content */}
            <div className="relative z-10 flex h-full w-full overflow-hidden">

                {/* ── Sidebar Drawer (desktop) ───────────────────────────── */}
                <AnimatePresence>
                    {isDrawerOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                key="drawer-backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.22 }}
                                onClick={() => setIsDrawerOpen(false)}
                                className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40"
                            />
                            {/* Panel */}
                            <motion.div
                                key="drawer-panel"
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                                className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-[#030305]/98 z-50 flex flex-col border-r border-white/[0.06] shadow-2xl backdrop-blur-3xl"
                            >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                                    <div className="flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-primary" />
                                        <span className="text-[11px] font-bold text-white/60 tracking-[0.2em] uppercase">Conversations</span>
                                    </div>
                                    <button
                                        onClick={() => setIsDrawerOpen(false)}
                                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-hidden" onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('[data-conversation-item]')) {
                                        setTimeout(() => setIsDrawerOpen(false), 280);
                                    }
                                }}>
                                    <Sidebar />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* ── Main area ─────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col relative min-w-0 min-h-0 overflow-hidden">

                    {/* Header bar */}
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#060608]/90 backdrop-blur-xl z-30">
                        <div className="flex items-center gap-2.5">
                            {/* Drawer toggle */}
                            <button
                                onClick={() => setIsDrawerOpen(true)}
                                className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
                                title="Open history"
                            >
                                <PanelLeft className="w-4 h-4" />
                            </button>
                            {/* Back on mobile */}
                            <Link href="/" className="md:hidden p-1.5 text-white/30 hover:text-white transition-colors">
                                <Home className="w-4 h-4" />
                            </Link>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                                    <Brain className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <span className="text-xs font-bold tracking-widest uppercase text-white/70">Novo AI</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* New chat */}
                            <button
                                onClick={createConversation}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-white/50 hover:text-white hover:bg-white/[0.07] hover:border-white/15 text-xs font-medium transition-all duration-200"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">New chat</span>
                            </button>
                            {/* Cognitive mode pill */}
                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-bold tracking-tight text-primary uppercase">Cognitive Mode</span>
                            </div>
                            {/* Fullscreen */}
                            <button
                                onClick={toggleFullscreen}
                                className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.05] transition-all"
                            >
                                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Hero or Chat */}
                    <AnimatePresence mode="wait">
                        {!isChatActive ? (
                            <DesktopHero key="hero" />
                        ) : (
                            <motion.div
                                key="chat"
                                className="flex-1 flex flex-col min-h-0 overflow-hidden"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <ChatArea />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default ModernChatbot;
