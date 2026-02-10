'use client';

import React from 'react';
import { Loader2, ListTodo, Timer, CalendarDays, Sparkles, Lightbulb, MessageSquare } from 'lucide-react';
import { useChatbot } from './context';
import { Message } from './message';
import { ChatInput } from './chat-input';
import { ThinkingIndicator } from './thinking-indicator';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Quick action suggestions
const quickActions = [
    { icon: ListTodo, label: 'Crear una tarea', prompt: 'Ayúdame a crear una nueva tarea para hoy' },
    { icon: Timer, label: 'Iniciar enfoque', prompt: 'Quiero comenzar una sesión de enfoque de 25 minutos' },
    { icon: CalendarDays, label: 'Ver mi agenda', prompt: '¿Qué tengo programado para hoy?' },
    { icon: Lightbulb, label: 'Dame una idea', prompt: 'Dame una idea para ser más productivo hoy' },
];

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '¡Buenos días';
    if (hour >= 12 && hour < 18) return '¡Buenas tardes';
    if (hour >= 18 && hour < 22) return '¡Buenas noches';
    return '¡Hola';
}

export function ChatArea() {
    const { messages, isTyping, streamingMessage, retryMessage, likeMessage, dislikeMessage, statusMessage, sendMessage } = useChatbot();
    const { data: session } = useSession();
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping, streamingMessage]);

    // Listen for follow-up suggestions
    React.useEffect(() => {
        const handleFollowup = (e: CustomEvent) => {
            if (e.detail) {
                sendMessage(e.detail);
            }
        };
        window.addEventListener('chat-followup', handleFollowup as EventListener);
        return () => window.removeEventListener('chat-followup', handleFollowup as EventListener);
    }, [sendMessage]);

    const handleCopy = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleQuickAction = (prompt: string) => {
        sendMessage(prompt);
    };

    const userName = session?.user?.name?.split(' ')[0] || 'Usuario';
    const isChatActive = messages.length > 0 || streamingMessage !== null;

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-transparent">
            {/* Scrollable container */}
            <div className="absolute inset-0 bottom-0">
                <div
                    className={cn(
                        "h-full w-full overflow-y-auto overscroll-contain custom-scrollbar",
                        !isChatActive ? "flex items-center justify-center" : "px-4"
                    )}
                >
                    {!isChatActive ? (
                        <div className="w-full max-w-2xl px-6 py-12 animate-in fade-in zoom-in duration-1000 flex flex-col items-center">
                            {/* Greeting with user name */}
                            <div className="mb-10 text-center">
                                <div className="relative w-24 h-24 mx-auto mb-8 group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700 animate-pulse" />
                                    <div className="relative w-full h-full rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl transform group-hover:scale-110 transition-transform duration-700">
                                        <Sparkles className="w-10 h-10 text-indigo-400 animate-pulse" />
                                    </div>
                                </div>

                                <h2 className="text-5xl font-bold text-white mb-6 tracking-tight">
                                    {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">{userName}</span>! 👋
                                </h2>
                                <p className="text-white/40 text-xl max-w-md mx-auto leading-relaxed font-light">
                                    Soy tu asistente de productividad inteligente. ¿Qué increíble proyecto vamos a avanzar hoy?
                                </p>
                            </div>

                            {/* Centered Input */}
                            <div className="w-full max-w-2xl mx-auto mb-12 transform transition-all duration-700 hover:scale-[1.02]">
                                <ChatInput />
                            </div>

                            {/* Quick actions */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                                {quickActions.map((action, index) => (
                                    <Button
                                        key={index}
                                        variant="outline"
                                        className="h-auto py-5 px-4 flex flex-col items-center gap-3 bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all duration-500 group rounded-2xl backdrop-blur-sm"
                                        onClick={() => handleQuickAction(action.prompt)}
                                    >
                                        <div className="p-2.5 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                                            <action.icon className="w-5 h-5 text-indigo-400 transition-transform group-hover:scale-110" />
                                        </div>
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-white/40 group-hover:text-white/80 transition-colors">{action.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="pb-32 pt-6 max-w-4xl mx-auto w-full">
                            {messages.map((message) => (
                                <Message
                                    key={message.id}
                                    message={message}
                                    onCopy={() => handleCopy(message.content)}
                                    onRetry={() => retryMessage(message.id)}
                                    onLike={() => likeMessage(message.id)}
                                    onDislike={() => dislikeMessage(message.id)}
                                />
                            ))}

                            {/* Streaming message */}
                            {streamingMessage && (
                                <Message
                                    key="streaming"
                                    message={streamingMessage}
                                    onCopy={() => { }}
                                    onRetry={() => { }}
                                    onLike={() => { }}
                                    onDislike={() => { }}
                                />
                            )}

                            {/* Typing indicator */}
                            {isTyping && !streamingMessage && (
                                <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <ThinkingIndicator status={statusMessage} />
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Input - Fixed at bottom */}
            {isChatActive && (
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/40 via-black/20 to-transparent backdrop-blur-sm">
                    <div className="max-w-3xl mx-auto transform transition-all duration-500 hover:scale-[1.01]">
                        <ChatInput />
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-3">
                        {/* Context Memory Indicator */}
                        <div className="flex items-center gap-2 text-[10px] text-white/30" title="Uso de memoria de contexto">
                            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        messages.length > 8 ? "bg-red-500/50" : "bg-indigo-500/50"
                                    )}
                                    style={{ width: `${Math.min((messages.length / 10) * 100, 100)}%` }}
                                />
                            </div>
                            <span>
                                {Math.min(messages.length, 10)}/10
                            </span>
                        </div>
                        <span className="text-white/10">•</span>
                        <p className="text-[10px] text-white/20 font-medium tracking-wide uppercase">
                            AI can make mistakes. Check important info.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
