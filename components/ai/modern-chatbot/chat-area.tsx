'use client';

import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { Bot, Sparkles, Calendar, FolderPlus } from 'lucide-react';
import { useChatbot } from './context';
import { Message as ChatMessage } from './message';
import { ChatInput } from './chat-input';
import { MobileHero, VoiceListeningOverlay } from './welcome-hero';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { AnimatePresence } from 'framer-motion';

export function ChatArea() {
    const { messages, isLoading, streamingMessage, sendMessage, currentConversationId } = useChatbot();
    const { data: session } = useSession();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevLengthRef = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const prevConversationIdRef = useRef<string | null>(null);
    // Ref for the composer wrapper — used to measure its real rendered height
    const composerRef = useRef<HTMLDivElement>(null);
    // rAF handle for debounced streaming scroll — prevents firing hundreds of
    // times per second and avoids fighting user-initiated scroll positions.
    const streamingRafRef = useRef<number | null>(null);

    // ── Dynamic safe-area via ResizeObserver ──────────────────────────────────
    // Writes --composer-h onto the scroll container so the padded spacer below
    // the last message always matches the exact rendered composer height.
    useLayoutEffect(() => {
        const composer = composerRef.current;
        const scroller = scrollContainerRef.current;
        if (!composer || !scroller) return;

        const apply = () => {
            scroller.style.setProperty('--composer-h', `${composer.offsetHeight}px`);
        };

        // Apply immediately then observe for resizes (multi-line, attachments, etc.)
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(composer);
        return () => ro.disconnect();
    }, []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (behavior === 'instant') {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            }
        } else {
            requestAnimationFrame(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            });
        }
    }, []);

    // Conversation switch — instant scroll before paint, no reflow
    useLayoutEffect(() => {
        if (currentConversationId !== prevConversationIdRef.current) {
            scrollToBottom('instant');
            prevConversationIdRef.current = currentConversationId;
        }
    }, [currentConversationId, scrollToBottom]);

    // New messages — instant for history loads, smooth for live messages.
    // Also triggers when isLoading flips true (spinner appears before stream starts).
    useEffect(() => {
        const currentLength = messages.length;
        if (currentLength === 0) { prevLengthRef.current = 0; return; }
        const isHistoryLoad = currentLength - prevLengthRef.current > 1;
        scrollToBottom(isHistoryLoad ? 'instant' : 'smooth');
        prevLengthRef.current = currentLength;
    }, [messages, scrollToBottom]);

    // Scroll when loading spinner appears (before stream begins)
    useEffect(() => {
        if (isLoading) scrollToBottom('smooth');
    }, [isLoading, scrollToBottom]);

    // Debounced streaming scroll — cancel any pending rAF before scheduling a
    // new one, so we fire at most once per animation frame during streaming.
    useEffect(() => {
        if (!streamingMessage) return;
        if (streamingRafRef.current !== null) {
            cancelAnimationFrame(streamingRafRef.current);
        }
        streamingRafRef.current = requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            streamingRafRef.current = null;
        });
        return () => {
            if (streamingRafRef.current !== null) {
                cancelAnimationFrame(streamingRafRef.current);
            }
        };
    }, [streamingMessage]);

    const isChatActive = messages.length > 0 || streamingMessage !== null;
    const firstName = session?.user?.name ? session.user.name.split(' ')[0] : 'Alex';
    const [isVoiceListening, setIsVoiceListening] = useState(false);

    const handleVoiceToggle = useCallback(() => {
        setIsVoiceListening(v => !v);
        window.dispatchEvent(new CustomEvent('toggle-gemini-live'));
    }, []);

    // Sync external voice state
    useEffect(() => {
        const handleStateChange = (e: any) => {
            const state = e.detail?.state || 'idle';
            setIsVoiceListening(state === 'listening' || state === 'speaking');
        };
        window.addEventListener('gemini-live-state-change', handleStateChange);
        return () => window.removeEventListener('gemini-live-state-change', handleStateChange);
    }, []);

    // The safe-area bottom padding: composer height + 32px breathing room + env()
    // Falls back to 144px (≈ standard composer height) before the ResizeObserver fires.
    const safeAreaStyle: React.CSSProperties = {
        paddingBottom: 'calc(var(--composer-h, 144px) + 32px + env(safe-area-inset-bottom, 0px))',
    };

    return (
        <div className="flex-1 flex flex-col relative min-h-0 bg-transparent overflow-hidden">
            {/* Full-screen voice overlay (mobile) */}
            <AnimatePresence>
                {isVoiceListening && (
                    <VoiceListeningOverlay onStop={handleVoiceToggle} />
                )}
            </AnimatePresence>

            {/* Messages scroll area */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar min-h-0 relative"
                data-lenis-prevent
            >
                {!isChatActive ? (
                    <>
                        {/* Mobile: gradient DeepSeek-style hero */}
                        <div className="md:hidden absolute inset-0 flex flex-col min-h-0 overflow-hidden">
                            <MobileHero
                                onChipClick={(text) => {
                                    sendMessage(text);
                                }}
                                onVoiceClick={handleVoiceToggle}
                                isVoiceListening={isVoiceListening}
                            />
                        </div>

                        {/* Desktop: simple centered placeholder (DesktopHero is rendered by index.tsx) */}
                        <div className="hidden md:flex absolute inset-0 items-center justify-center">
                            <p className="text-white/10 text-xs tracking-widest uppercase font-medium">Start a conversation above</p>
                        </div>
                    </>
                ) : (
                    /* Messages list — safe area is dynamically measured */
                    <div className="w-full max-w-4xl mx-auto px-2 sm:px-6 pt-6" style={safeAreaStyle}>
                        {messages.map((message) => (
                            <ChatMessage key={message.id} message={message} />
                        ))}
                        {streamingMessage && (
                            <ChatMessage message={streamingMessage} />
                        )}
                        {isLoading && !streamingMessage && (
                            <div className="flex items-center gap-3 p-6 text-primary animate-pulse bg-white/[0.01] border-y border-white/5">
                                <Bot className="w-5 h-5 animate-spin" />
                                <span className="text-xs font-medium tracking-wider uppercase">Pensando...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/*
              ─── Bottom ChatInput ────────────────────────────────────────────────
              composerRef is attached here so ResizeObserver can measure the
              exact rendered height of the input area at all times.
              flex-shrink-0 ensures this never participates in scrolling.
            */}
            <div ref={composerRef} className="flex-shrink-0 z-20">
                <div
                    className="p-3 pb-6 md:pb-3 bg-gradient-to-t from-[#050505] via-[#050505]/95 to-transparent border-t border-white/5"
                    style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
                >
                    <ChatInput variant="bottom" />
                </div>
            </div>
        </div>
    );
}

export default ChatArea;
