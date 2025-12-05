'use client';

import React from 'react';
import { ChatbotProvider } from './context';
import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { ChatInput } from './chat-input';
import { ModelSelector } from './model-selector';

export function ModernChatbot() {
    return (
        <ChatbotProvider>
            <div className="flex h-full bg-background text-foreground">
                {/* Sidebar */}
                <Sidebar />

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col relative">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-semibold">AI Chat</h1>
                        </div>

                        <ModelSelector />
                    </div>

                    {/* Messages */}
                    <ChatArea />

                    {/* Input */}
                    <ChatInput />
                </div>

                {/* Artifacts Panel - Por implementar en P2 */}
                {/* <ArtifactPanel /> */}
            </div>
        </ChatbotProvider>
    );
}

export default ModernChatbot;
