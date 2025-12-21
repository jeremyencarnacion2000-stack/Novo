'use client';

import React, { useState, useEffect, useRef } from 'react';
import './mini-chatbot.css';
import './mini-chatbot-hidden.css';

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ConversationData {
    id: string;
    title: string;
    messages: ChatMessage[];
    updatedAt: string;
}

export function MiniChatbot() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isHidden, setIsHidden] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Detect time of day
    useEffect(() => {
        const updateTimeOfDay = () => {
            const hour = new Date().getHours();

            if (hour >= 6 && hour < 12) {
                setTimeOfDay('morning');
            } else if (hour >= 12 && hour < 18) {
                setTimeOfDay('afternoon');
            } else if (hour >= 18 && hour < 22) {
                setTimeOfDay('evening');
            } else {
                setTimeOfDay('night');
            }
        };

        updateTimeOfDay();
        const interval = setInterval(updateTimeOfDay, 60000);
        return () => clearInterval(interval);
    }, []);

    // Load conversation from database on mount
    useEffect(() => {
        async function loadConversation() {
            try {
                const response = await fetch('/api/ai-conversations');
                if (response.ok) {
                    const conversations: ConversationData[] = await response.json();
                    // Load most recent conversation
                    if (conversations.length > 0) {
                        const latest = conversations[0];
                        setConversationId(latest.id);
                        const loadedMessages = Array.isArray(latest.messages)
                            ? latest.messages.map((m: any) => ({
                                ...m,
                                timestamp: new Date(m.timestamp)
                            }))
                            : [];
                        setMessages(loadedMessages);
                    }
                }
            } catch (error) {
                // Silently fail - user might not be logged in
            }
        }
        loadConversation();
    }, []);

    // Save conversation to database
    const saveConversation = async (newMessages: ChatMessage[]) => {
        try {
            if (conversationId) {
                // Update existing conversation
                await fetch(`/api/ai-conversations/${conversationId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: newMessages,
                        title: newMessages[0]?.content?.slice(0, 50) || 'Chat Session'
                    })
                });
            } else {
                // Create new conversation
                const response = await fetch('/api/ai-conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: newMessages,
                        title: newMessages[0]?.content?.slice(0, 50) || 'Chat Session'
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    setConversationId(data.id);
                }
            }
        } catch (error) {
            // Silently fail - conversation will be saved next time
        }
    };

    // Get selected model from main chatbot (stored in localStorage)
    const getSelectedModel = () => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('modern-chatbot-selected-model') || 'grok-beta';
        }
        return 'grok-beta';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || timeOfDay === 'night') return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);

        try {
            const selectedModel = getSelectedModel();
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: input,
                    model: selectedModel,
                    history: messages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    systemPrompt: 'Eres un asistente útil y amigable. Responde de manera concisa en español.',
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: data.message || data.response || 'I received your message.',
                    timestamp: new Date()
                };
                const allMessages = [...updatedMessages, assistantMessage];
                setMessages(allMessages);
                await saveConversation(allMessages);
            } else {
                // Add error message
                const errorMessage: ChatMessage = {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.',
                    timestamp: new Date()
                };
                setMessages([...updatedMessages, errorMessage]);
            }
        } catch (error) {
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: 'Connection error. Please try again.',
                timestamp: new Date()
            };
            setMessages([...updatedMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearConversation = async () => {
        setMessages([]);
        if (conversationId) {
            try {
                await fetch(`/api/ai-conversations/${conversationId}`, {
                    method: 'DELETE'
                });
                setConversationId(null);
            } catch (error) {
                // Silently fail
            }
        }
    };

    const getPlaceholder = () => {
        switch (timeOfDay) {
            case 'morning':
                return '¡Buenos días! ☀️';
            case 'afternoon':
                return '¡Buenas tardes! 🌤️';
            case 'evening':
                return '¡Buenas noches! 🌅';
            case 'night':
                return 'Zzz... 😴';
            default:
                return 'Escribe algo...';
        }
    };

    // Render eyes based on time of day
    const renderEyes = () => {
        if (timeOfDay === 'night') {
            return (
                <div className="sleeping-z">
                    <div className="z z-1">Z</div>
                    <div className="z z-2">Z</div>
                    <div className="z z-3">Z</div>
                    <div className="z z-4">Z</div>
                </div>
            );
        }

        return (
            <>
                <div className={`eyes ${timeOfDay}`}>
                    <span className="eye" />
                    <span className="eye" />
                </div>
                <div className="eyes happy">
                    <svg fill="none" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z" />
                    </svg>
                    <svg fill="none" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z" />
                    </svg>
                </div>
            </>
        );
    };

    const toggleHidden = () => {
        setIsHidden(!isHidden);
    };

    return (
        <>
            {/* Arrow toggle when hidden */}
            <button
                className={`mini-chatbot-toggle ${isHidden ? 'visible' : ''}`}
                onClick={toggleHidden}
                title="Mostrar chatbot"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            <div className={`mini-chatbot-container ${isHidden ? 'hidden' : ''}`}>
                {/* Close button (arrow pointing back) */}
                <button
                    className="mini-chatbot-close"
                    onClick={toggleHidden}
                    title="Ocultar chatbot"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                {/* 15 hover areas in 5x3 grid */}
                <div className="hover-grid">
                    {[...Array(15)].map((_, i) => (
                        <div key={i} className="hover-area" />
                    ))}
                </div>

                {/* Main chatbot card */}
                <label className={`container-wrap ${/* Simulated state for visual demo - in real app this would come from context */ 'idle'}`}>
                    <input
                        type="checkbox"
                        checked={isExpanded}
                        onChange={(e) => setIsExpanded(e.target.checked)}
                    />

                    <div className={`card ${timeOfDay}`}>
                        {/* Animated background balls */}
                        <div className="background-blur-balls">
                            <div className="balls">
                                <span className="ball rosa" />
                                <span className="ball violet" />
                                <span className="ball green" />
                                <span className="ball cyan" />
                            </div>
                        </div>

                        {/* Face/Eyes */}
                        <div className="content-card">
                            <div className="background-blur-card">
                                {renderEyes()}
                            </div>
                        </div>

                        {/* Chat interface (when expanded) */}
                        <div className="container-ai-chat">
                            {/* Chat messages */}
                            {messages.length > 0 && (
                                <div className="chat-messages">
                                    {messages.slice(-5).map((msg, idx) => (
                                        <div key={idx} className={`chat-message ${msg.role}`}>
                                            <span>{msg.content.slice(0, 100)}{msg.content.length > 100 ? '...' : ''}</span>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}

                            <form className="chat" onSubmit={handleSubmit}>
                                <div className="chat-bot">
                                    <textarea
                                        placeholder={getPlaceholder()}
                                        name="chat_bot"
                                        id="chat_bot"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSubmit(e);
                                            }
                                        }}
                                        disabled={isLoading || timeOfDay === 'night'}
                                    />
                                </div>

                                <div className="options">
                                    <div className="btns-add">
                                        <button type="button" title="Limpiar chat" onClick={clearConversation}>
                                            <svg viewBox="0 0 24 24" height={18} width={18} xmlns="http://www.w3.org/2000/svg">
                                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="none" />
                                            </svg>
                                        </button>
                                        <button type="button" title="Adjuntar archivo">
                                            <svg viewBox="0 0 24 24" height={18} width={18} xmlns="http://www.w3.org/2000/svg">
                                                <path d="M7 8v8a5 5 0 1 0 10 0V6.5a3.5 3.5 0 1 0-7 0V15a2 2 0 0 0 4 0V8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="none" />
                                            </svg>
                                        </button>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={isLoading || !input.trim() || timeOfDay === 'night'}
                                        title={timeOfDay === 'night' ? 'El bot está durmiendo... 😴' : 'Enviar mensaje'}
                                    >
                                        <i>
                                            {isLoading ? (
                                                <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                            ) : (
                                                <svg viewBox="0 0 512 512">
                                                    <path d="M473 39.05a24 24 0 0 0-25.5-5.46L47.47 185h-.08a24 24 0 0 0 1 45.16l.41.13l137.3 58.63a16 16 0 0 0 15.54-3.59L422 80a7.07 7.07 0 0 1 10 10L226.66 310.26a16 16 0 0 0-3.59 15.54l58.65 137.38c.06.2.12.38.19.57c3.2 9.27 11.3 15.81 21.09 16.25h1a24.63 24.63 0 0 0 23-15.46L478.39 64.62A24 24 0 0 0 473 39.05" fill="currentColor" />
                                                </svg>
                                            )}
                                        </i>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </label>
            </div>
        </>
    );
}
