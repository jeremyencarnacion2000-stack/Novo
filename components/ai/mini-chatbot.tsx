'use client';

import React, { useState, useEffect } from 'react';
import { useChatbot } from './modern-chatbot/context';
import './mini-chatbot.css';

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function MiniChatbot() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
    const { sendMessage, isLoading } = useChatbot();

    // Detectar hora del día
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
        // Actualizar cada minuto
        const interval = setInterval(updateTimeOfDay, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const message = input;
        setInput('');
        await sendMessage(message);
        // Colapsar después de enviar
        setTimeout(() => setIsExpanded(false), 2000);
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

    // Renderizar ojos según hora del día
    const renderEyes = () => {
        if (timeOfDay === 'night') {
            // Mostrar Z Z Z Z dormido
            return (
                <div className="sleeping-z">
                    <div className="z z-1">Z</div>
                    <div className="z z-2">Z</div>
                    <div className="z z-3">Z</div>
                    <div className="z z-4">Z</div>
                </div>
            );
        }

        // Ojos normales con diferentes expresiones
        return (
            <>
                {/* Ojos normales */}
                <div className={`eyes ${timeOfDay}`}>
                    <span className="eye" />
                    <span className="eye" />
                </div>

                {/* Ojos felices (on hover) */}
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

    return (
        <div className="mini-chatbot-container">
            {/* 15 hover areas in 5x3 grid */}
            <div className="hover-grid">
                {[...Array(15)].map((_, i) => (
                    <div key={i} className="hover-area" />
                ))}
            </div>

            {/* Main chatbot card */}
            <label className="container-wrap">
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
                                    <button type="button" title="Adjuntar archivo">
                                        <svg viewBox="0 0 24 24" height={18} width={18} xmlns="http://www.w3.org/2000/svg">
                                            <path d="M7 8v8a5 5 0 1 0 10 0V6.5a3.5 3.5 0 1 0-7 0V15a2 2 0 0 0 4 0V8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="none" />
                                        </svg>
                                    </button>
                                    <button type="button" title="Agregar imagen">
                                        <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                                            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm0 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zm0-8h6m-3-3v6" />
                                        </svg>
                                    </button>
                                    <button type="button" title="Búsqueda web">
                                        <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10m-2.29-2.333A17.9 17.9 0 0 1 8.027 13H4.062a8.01 8.01 0 0 0 5.648 6.667M10.03 13c.151 2.439.848 4.73 1.97 6.752A15.9 15.9 0 0 0 13.97 13zm9.908 0h-3.965a17.9 17.9 0 0 1-1.683 6.667A8.01 8.01 0 0 0 19.938 13M4.062 11h3.965A17.9 17.9 0 0 1 9.71 4.333A8.01 8.01 0 0 0 4.062 11m5.969 0h3.938A15.9 15.9 0 0 0 12 4.248A15.9 15.9 0 0 0 10.03 11m4.259-6.667A17.9 17.9 0 0 1 15.973 11h3.965a8.01 8.01 0 0 0-5.648-6.667" />
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
    );
}
