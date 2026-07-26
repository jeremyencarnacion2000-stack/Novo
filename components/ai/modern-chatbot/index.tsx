'use client';

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useChatbot } from './context';
import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { ChatInput } from './chat-input';
import { DesktopHero, MobileHero, VoiceListeningOverlay } from './welcome-hero';
import {
  Maximize2, Minimize2, Plus,
  X, Home, PanelLeft, Brain
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

interface ModernChatbotProps {
    // Provided when this is rendered inside the mobile fullscreen chat sheet
    // (components/mobile-nav.tsx) instead of the /ai desktop page — the
    // "back" affordance should close that sheet, not navigate to "/".
    onMobileClose?: () => void;
}

// No <ChatbotProvider> here on purpose — one already wraps the whole app in
// app/client-layout.tsx's AppProviders. This used to nest a second, isolated
// provider instance, which silently disconnected /ai's conversation state
// from other useChatbot() consumers. Relying on the single app-root provider
// is what lets the mobile chat sheet below share real state with the rest of
// the app.
export function ModernChatbot({ onMobileClose }: ModernChatbotProps = {}) {
    return <ChatbotContent onMobileClose={onMobileClose} />;
}

function ChatbotContent({ onMobileClose }: ModernChatbotProps) {
    const { createConversation, sendMessage, messages, streamingMessage } = useChatbot();
    const containerRef = useRef<HTMLDivElement>(null)
    const composerRef = useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [isVoiceListening, setIsVoiceListening] = useState(false)

    const isChatActive = messages.length > 0 || streamingMessage !== null

    // The composer is one persistent element regardless of hero/chat state
    // (matching the PulseChat reference — a single floating input, not a
    // different-looking one embedded in the hero). ChatArea's own scroll
    // container reads --composer-h to size its bottom safe-area padding;
    // setting it here on containerRef works because CSS custom properties
    // inherit down through descendants regardless of component boundaries.
    useLayoutEffect(() => {
        const composer = composerRef.current
        const container = containerRef.current
        if (!composer || !container) return
        const apply = () => container.style.setProperty('--composer-h', `${composer.offsetHeight}px`)
        apply()
        const ro = new ResizeObserver(apply)
        ro.observe(composer)
        return () => ro.disconnect()
    }, [])

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

    // Sync with the real orb state instead of trusting the local toggle to
    // stay correct on its own (same pattern chat-area.tsx already uses) — if
    // the real connection fails (denied mic permission, etc.) the hero's
    // voice CTA should fall back to idle, not stay stuck on "listening".
    useEffect(() => {
        const handleStateChange = (e: any) => {
            const state = e.detail?.state || 'idle'
            setIsVoiceListening(state === 'listening' || state === 'speaking')
        }
        window.addEventListener('gemini-live-state-change', handleStateChange)
        return () => window.removeEventListener('gemini-live-state-change', handleStateChange)
    }, [])

    return (
        <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
            {/* Dynamic ambient bottom glow matching the user's accent color setting */}
            <div
                className="absolute bottom-0 left-0 right-0 h-[65vh] pointer-events-none -z-0 opacity-80"
                style={{
                    background: 'linear-gradient(to top, rgba(var(--primary-rgb), 0.28) 0%, rgba(var(--primary-rgb), 0.08) 50%, transparent 100%)'
                }}
            />

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
                                className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-[var(--background)]/98 z-50 flex flex-col border-r border-white/[0.06] shadow-2xl backdrop-blur-3xl"
                            >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary-glow)]" />
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
                                    <Sidebar embedded />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* ── Main area ─────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col relative min-w-0 min-h-0 overflow-hidden">

                    {/* Header — no bar/divider, just the floating buttons over
                        the same gradient background as the rest of the page */}
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 z-30">
                        <div className="flex items-center gap-2.5">
                            {/* Drawer toggle */}
                            <button
                                onClick={() => setIsDrawerOpen(true)}
                                className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
                                title="Ver historial"
                            >
                                <PanelLeft className="w-4 h-4" />
                            </button>
                            {/* Back on mobile — closes the flip sheet if we're inside
                                one, otherwise (direct /ai visit) navigates home */}
                            {onMobileClose ? (
                                <button onClick={onMobileClose} className="md:hidden p-1.5 text-white/30 hover:text-white transition-colors">
                                    <Home className="w-4 h-4" />
                                </button>
                            ) : (
                                <Link href="/" className="md:hidden p-1.5 text-white/30 hover:text-white transition-colors">
                                    <Home className="w-4 h-4" />
                                </Link>
                            )}
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
                                <span className="hidden sm:inline">Nuevo chat</span>
                            </button>
                            {/* Cognitive mode pill */}
                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-bold tracking-tight text-primary uppercase">Modo Cognitivo</span>
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
                            // Two heroes, gated by CSS breakpoint (not a JS width
                            // check, to avoid hydration mismatch) — previously
                            // DesktopHero rendered unconditionally here regardless
                            // of viewport, and MobileHero lived unreachably inside
                            // ChatArea (which only mounts once isChatActive is
                            // already true, so its own !isChatActive branch could
                            // never fire). Real mobile users never saw MobileHero.
                            <div key="hero" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <div className="md:hidden flex-1 flex flex-col min-h-0">
                                    <MobileHero
                                        // sendMessage already auto-creates a conversation when
                                        // none is active — calling createConversation() first
                                        // raced it: sendMessage's useCallback closure still saw
                                        // the pre-update (null) currentConversationId by the time
                                        // the setTimeout fired, so it created a SECOND conversation
                                        // for the message, leaving the first one an orphaned empty
                                        // "Nueva conversación" in the sidebar.
                                        onChipClick={(text) => sendMessage(text)}
                                        onVoiceClick={toggleVoice}
                                        isVoiceListening={isVoiceListening}
                                    />
                                </div>
                                <div className="hidden md:flex flex-1 flex-col min-h-0">
                                    <DesktopHero
                                        onChipClick={(text) => sendMessage(text)}
                                    />
                                </div>
                            </div>
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

                    {/* Persistent composer — one input surface for both the hero
                        and active-chat states, docked at the bottom always.
                        A short fade behind it keeps messages from ending
                        abruptly under the card without boxing the card itself
                        into an edge-to-edge bar. */}
                    <div ref={composerRef} className="flex-shrink-0 z-20 relative">
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent pointer-events-none" />
                        <div className="relative px-3 sm:px-6 pt-4 pb-6 md:pb-4">
                            <ChatInput variant="bottom" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ModernChatbot;
