'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Bot, ChevronRight, Sparkles, Brain, Zap, Terminal } from 'lucide-react'
import { ChatInput } from './chat-input'
import { Message } from './message'
import { useChatbot } from './context'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ChatbotSidebar() {
    const {
        messages,
        sendMessage,
        isLoading,
        isTyping,
        streamingMessage,
        sidebarCollapsed,
        setSidebarCollapsed
    } = useChatbot()

    // Cognitive State Logic
    const [cognitiveState, setCognitiveState] = useState<'IDLE' | 'ANALYZING' | 'PROPOSING' | 'EXECUTING'>('IDLE')

    useEffect(() => {
        if (!isLoading && !isTyping) {
            setCognitiveState('IDLE')
            return
        }

        if (isTyping) {
            // Simulate cognitive phases based on timing or message content if possible
            // For now, we cycle through them or just show "Thinking"
            setCognitiveState('ANALYZING')
            const timer = setTimeout(() => setCognitiveState('PROPOSING'), 1500)
            return () => clearTimeout(timer)
        }
    }, [isLoading, isTyping])

    // Cognitive State Colors
    const stateColors = {
        IDLE: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
        ANALYZING: 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse',
        PROPOSING: 'bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.6)]',
        EXECUTING: 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse',
        RESULT: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
    }

    return (
        <div className="fixed right-0 top-0 bottom-0 z-50 flex pointer-events-none">
            {/* Toggle Button (Visible when collapsed) */}
            <div className={`pointer-events-auto transition-all duration-300 ${sidebarCollapsed ? 'translate-x-0' : 'translate-x-full'}`}>
                <Button
                    onClick={() => setSidebarCollapsed(false)}
                    className="fixed right-6 bottom-6 h-14 w-14 rounded-full shadow-2xl bg-[#0B0B0F] border border-indigo-500/30 hover:bg-[#15151A] hover:scale-105 transition-all group"
                >
                    <div className="absolute inset-0 rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/20 blur-md transition-all" />
                    <Bot className="h-6 w-6 text-indigo-400 relative z-10" />
                </Button>
            </div>

            {/* Sidebar Panel - Cognitive Layer */}
            <div
                className={`pointer-events-auto w-[400px] bg-[#0B0B0F]/90 backdrop-blur-2xl border-l border-white/10 flex flex-col transition-transform duration-300 ease-out bg-noise ${sidebarCollapsed ? 'translate-x-full' : 'translate-x-0'
                    } ${cognitiveState !== 'IDLE' ? 'shadow-glow-lg border-indigo-500/30' : 'shadow-2xl'
                    }`}
            >
                {/* Header */}
                <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-[#0B0B0F]/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                            <Bot className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                                NOVO AI
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/5 text-muted-foreground font-mono">
                                    v2.0
                                </span>
                            </h2>
                            <div className="flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${stateColors[cognitiveState as keyof typeof stateColors] || stateColors.IDLE}`} />
                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                                    {cognitiveState}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarCollapsed(true)}
                        className="text-muted-foreground hover:text-white hover:bg-white/5 rounded-full"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>

                {/* Cognitive Visualization (Header Overlay) */}
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-50" />

                {cognitiveState !== 'IDLE' && (
                    <div className="absolute top-14 left-0 right-0 h-0.5 bg-indigo-500/20 overflow-hidden z-10">
                        <div className="h-full bg-indigo-500 animate-progress-indeterminate shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                    </div>
                )}

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-6 pb-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-[400px] text-center space-y-6 opacity-0 animate-in fade-in zoom-in-95 duration-700 fill-mode-forwards delay-100">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full animate-pulse-slow group-hover:bg-indigo-500/20 transition-all duration-1000" />
                                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-white/5 flex items-center justify-center backdrop-blur-md relative z-10 shadow-2xl group-hover:scale-105 transition-transform duration-500">
                                        <Brain className="h-8 w-8 text-indigo-400/50" />
                                    </div>
                                </div>
                                <div className="space-y-2 max-w-[240px]">
                                    <p className="text-xs font-mono text-indigo-400/80 tracking-widest uppercase">System Ready</p>
                                    <p className="text-[10px] text-muted-foreground/50 font-mono">
                                        Cognitive layer active. Awaiting input.
                                    </p>
                                </div>
                            </div>
                        )}

                        {messages.map((message) => (
                            <Message
                                key={message.id}
                                message={message}
                                onCopy={() => { }}
                                onRetry={() => { }}
                                onLike={() => { }}
                                onDislike={() => { }}
                            />
                        ))}

                        {streamingMessage && (
                            <Message
                                message={streamingMessage}
                                onCopy={() => { }}
                                onRetry={() => { }}
                                onLike={() => { }}
                                onDislike={() => { }}
                            />
                        )}
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 bg-[#0B0B0F]/80 backdrop-blur-xl border-t border-white/5 relative z-20">
                    <ChatInput onSend={sendMessage} disabled={isLoading} />
                </div>
            </div>
        </div>
    )
}
