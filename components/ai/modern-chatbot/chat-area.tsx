'use client';

import React, { useRef, useEffect } from 'react';
import { Bot, Sparkles, Calendar, FolderPlus } from 'lucide-react';
import { useChatbot } from './context';
import { Message as ChatMessage } from './message';
import { ChatInput } from './chat-input';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';

export function ChatArea() {
    const { messages, isLoading, streamingMessage, sendMessage } = useChatbot();
    const { data: session } = useSession();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevLengthRef = useRef(0);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior });
        });
    };

    useEffect(() => {
        const currentLength = messages.length;
        if (currentLength === 0) { prevLengthRef.current = 0; return; }
        const isHistoryLoad = currentLength - prevLengthRef.current > 1;
        scrollToBottom(isHistoryLoad ? 'instant' : 'smooth');
        prevLengthRef.current = currentLength;
    }, [messages]);

    useEffect(() => {
        if (streamingMessage) scrollToBottom('smooth');
    }, [streamingMessage]);

    const isChatActive = messages.length > 0 || streamingMessage !== null;
    const firstName = session?.user?.name ? session.user.name.split(' ')[0] : 'Alex';

    return (
        <div className="flex-1 flex flex-col relative min-h-0 bg-transparent overflow-hidden">
            {/* Messages scroll area — always flex-1, never changes */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar min-h-0 relative" data-lenis-prevent>
                {!isChatActive ? (
                    /* Welcome screen: centered inside the scroll area */
                    <div className="min-h-full flex flex-col items-center justify-center p-4 py-6 sm:py-10">
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

                            <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                                <ChatInput variant="center" />
                            </div>

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
                    /* Messages list */
                    <div className="w-full max-w-4xl mx-auto px-2 sm:px-6 pt-6 pb-10">
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
              The outer div is ALWAYS in the flex layout as flex-shrink-0.
              When inactive → height collapses to 0 (overflow-hidden + h-0).
              When active   → height auto, content visible.
              This prevents the scroll area from changing height when isChatActive
              toggles, eliminating the layout shift on history load.
            */}
            <div
                className={cn(
                    'flex-shrink-0 overflow-hidden transition-none z-20',
                    isChatActive ? 'h-auto' : 'h-0'
                )}
            >
                <div
                    className="p-3 pb-6 md:pb-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent border-t border-white/5"
                    style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
                >
                    <ChatInput variant="bottom" />
                </div>
            </div>
        </div>
    );
}

export default ChatArea;
