'use client';

import React from 'react';
import { Send, Paperclip, Mic, Loader2 } from 'lucide-react';
import { useChatbot } from './context';

export function ChatInput() {
    const { sendMessage, isLoading, currentConversationId, createConversation } = useChatbot();
    const [input, setInput] = React.useState('');
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        // Create conversation if none exists
        if (!currentConversationId) {
            createConversation();
            // Wait a bit for the conversation to be created
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const message = input;
        setInput('');
        await sendMessage(message);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    return (
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-6 px-6">
            <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSubmit} className="relative">
                    <div className="relative flex items-end gap-2 bg-secondary border border-input rounded-2xl p-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring transition-all">
                        {/* Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu mensaje..."
                            className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none resize-none px-3 py-2 max-h-40 min-h-[2.5rem]"
                            rows={1}
                            disabled={isLoading}
                        />

                        {/* Actions */}
                        <div className="flex items-center gap-1 pb-2">
                            <button
                                type="button"
                                className="p-2 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
                                title="Adjuntar archivo"
                                disabled={isLoading}
                            >
                                <Paperclip className="w-5 h-5 text-muted-foreground" />
                            </button>

                            <button
                                type="button"
                                className="p-2 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
                                title="Grabación de voz"
                                disabled={isLoading}
                            >
                                <Mic className="w-5 h-5 text-muted-foreground" />
                            </button>

                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="p-2 bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Enviar mensaje"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5 text-primary-foreground" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Character count */}
                    {input.length > 0 && (
                        <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground">
                            {input.length} caracteres
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
