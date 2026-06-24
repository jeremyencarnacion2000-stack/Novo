'use client';

import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Bot, Sparkles, Calendar, FolderPlus } from 'lucide-react';
import { useChatbot } from './context';
import { Message as ChatMessage } from './message';
import { ChatInput } from './chat-input';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';

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

    // The safe-area bottom padding: composer height + 32px breathing room + env()
    // Falls back to 144px (≈ standard composer height) before the ResizeObserver fires.
    const safeAreaStyle: React.CSSProperties = {
        paddingBottom: 'calc(var(--composer-h, 144px) + 32px + env(safe-area-inset-bottom, 0px))',
    };

    return (
        <div className="flex-1 flex flex-col relative min-h-0 bg-transparent overflow-hidden">
            {/* Messages scroll area — only scrollable region, geometry never changes */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar min-h-0 relative"
                data-lenis-prevent
            >
                {!isChatActive ? (
                    /* Welcome screen: absolute-fill so it reliably centers
                       regardless of how the flex parent resolves min-height. */
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 py-6 sm:py-10 overflow-hidden" style={safeAreaStyle}>
                        <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500 w-full max-w-3xl">
                            <div className="relative w-28 h-28 flex items-center justify-center mb-3 select-none pointer-events-none">
                                <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse" style={{ animationDuration: '4s' }} />
                                <div className="absolute w-22 h-22 border border-dashed border-primary/30 rounded-full animate-spin" style={{ animationDuration: '30s' }} />
                                <div className="absolute w-18 h-18 border border-dotted border-primary/20 rounded-full animate-spin" style={{ animationDuration: '15s', animationDirection: 'reverse' }} />
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-primary/60 shadow-[0_0_24px_var(--primary-glow)] animate-pulse flex items-center justify-center">
                                    <Bot className="w-4.5 h-4.5 text-black stroke-[2.5]" />
                                </div>
                            </div>

                            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
                                <span className="bg-gradient-to-r from-primary via-primary/50 to-white bg-clip-text text-transparent">Welcome back,</span>{' '}
                                <span className="text-white">{firstName}!</span>
                            </h2>
                            <p className="text-white/40 text-[10px] sm:text-xs font-semibold tracking-widest uppercase mb-6">
                                How can I help you organize your day?
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-2xl mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                                {[
                                    { text: "Crear una tarea", description: "Organiza tu día al instante", icon: Sparkles },
                                    { text: "Crear un proyecto", description: "Define objetivos y fases", icon: FolderPlus },
                                    { text: "Crear una rutina", description: "Crea hábitos productivos", icon: Calendar }
                                ].map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => sendMessage(suggestion.text)}
                                        className="flex items-center gap-3 p-3 bg-white/[0.01] hover:bg-primary/[0.03] border border-white/5 hover:border-primary/20 rounded-2xl transition-all duration-300 text-left group shadow-lg"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-105 transition-transform duration-300">
                                            <suggestion.icon className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-white/80 group-hover:text-primary transition-colors">{suggestion.text}</div>
                                            <div className="text-[10px] text-white/30 truncate mt-0.5">{suggestion.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
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
