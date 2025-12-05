'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useChatbot } from './context';
import { Message } from './message';

export function ChatArea() {
    const { messages, isTyping, retryMessage, likeMessage, dislikeMessage } = useChatbot();
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleCopy = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-md px-6">
                        <h2 className="text-2xl font-bold text-foreground mb-2">¡Bienvenido!</h2>
                        <p className="text-muted-foreground">
                            Comienza una conversación para empezar a chatear con la IA.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="pb-32">
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

                    {isTyping && (
                        <div className="flex gap-4 px-6 py-6 bg-accent/20">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-semibold text-foreground">AI</span>
                                    <span className="text-xs text-muted-foreground">pensando...</span>
                                </div>
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            )}
        </div>
    );
}
