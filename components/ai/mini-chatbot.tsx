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

import { useChatbot } from './modern-chatbot/context';

export function MiniChatbot() {
    const { setSidebarCollapsed, sidebarCollapsed } = useChatbot();
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');

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

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
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

    const [isHidden, setIsHidden] = useState(true);
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

                {/* Main chatbot card - Now a trigger for the sidebar */}
                <div
                    className="container-wrap cursor-pointer"
                    onClick={toggleSidebar}
                    title="Abrir NOVO AI"
                >
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
                    </div>
                </div>
            </div>
        </>
    );
}
